
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, authorization, x-client-info, apikey",
  "Access-Control-Max-Age": "86400",
};

// Platform account ID to avoid self-transfer
const PLATFORM_STRIPE_ACCOUNT_ID = "acct_1RWAfbLgPKVoUe8t";

serve(async (req) => {
  console.log("Create checkout function called with method:", req.method);
  console.log("Request origin:", req.headers.get("origin"));

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    console.log("Create checkout function started");

    // Check for Stripe secret key first
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not found in environment");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Stripe configuration missing. Please add your Stripe secret key to edge function secrets.",
          details: "Go to Supabase Dashboard → Edge Functions → Settings and add STRIPE_SECRET_KEY"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log("Stripe secret key found, proceeding with request");

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error("Failed to parse request body:", jsonError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid request body - must be valid JSON" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const { jobId } = requestBody;
    console.log("Received job ID:", jobId);

    if (!jobId) {
      console.error("Job ID is required but not provided");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Job ID is required" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get job details
    console.log("Fetching job details for ID:", jobId);
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      console.error("Error fetching job:", jobError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to fetch job: ${jobError.message}` 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!job) {
      console.error("Job not found for ID:", jobId);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Job not found" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log("Job details fetched:", { id: job.id, job_name: job.job_name, price: job.price, company_id: job.company_id });

    // Safe price handling
    let jobPrice;
    try {
      jobPrice = parseFloat(job.price);
      if (isNaN(jobPrice) || jobPrice <= 0) {
        throw new Error("Invalid price value");
      }
    } catch (priceError) {
      console.error("Invalid job price:", job.price, priceError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid or missing price in job data" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Determine if we should use Stripe Connect
    let useStripeConnect = false;
    let connectedStripeAccountId = null;
    let connectedAccountChargesEnabled = false;
    
    if (job.company_id) {
      console.log("Fetching company Stripe account for company_id:", job.company_id);
      const { data: companyProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id, stripe_connected')
        .eq('company_id', job.company_id)
        .eq('stripe_connected', true)
        .single();

      if (profileError) {
        console.warn("Error fetching company profile or company not Stripe connected:", profileError);
      } else if (companyProfile?.stripe_account_id) {
        connectedStripeAccountId = companyProfile.stripe_account_id;
        console.log("Found company Stripe account:", connectedStripeAccountId);
        
        // Check if company account is different from platform account
        if (connectedStripeAccountId !== PLATFORM_STRIPE_ACCOUNT_ID) {
          // Verify the connected account can accept charges
          try {
            const account = await stripe.accounts.retrieve(connectedStripeAccountId);
            connectedAccountChargesEnabled = account.charges_enabled;
            console.log("Connected account charges_enabled:", connectedAccountChargesEnabled);
            
            if (connectedAccountChargesEnabled) {
              useStripeConnect = true;
              console.log('Using Connect account:', connectedStripeAccountId);
            } else {
              console.log('Connected account cannot accept charges, falling back to platform');
            }
          } catch (accountError) {
            console.error('Error checking connected account:', accountError);
            console.log('Falling back to platform account due to account error');
          }
        } else {
          console.log('Company account matches platform account, using platform processing');
        }
      }
    }

    // Calculate amounts in cents
    const totalPriceInCents = Math.round(jobPrice * 100);
    const platformFeeInCents = useStripeConnect ? Math.round(jobPrice * 100 * 0.05) : 0; // 5% platform fee
    
    console.log(`Pricing: Job price $${jobPrice}, Total ${totalPriceInCents} cents, Platform fee: ${platformFeeInCents} cents`);

    if (totalPriceInCents < 50) {
      console.error("Price too low for Stripe (minimum $0.50):", totalPriceInCents);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Job price too low for payment processing (minimum $0.50)" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log("Creating Stripe checkout session");

    // Create checkout session configuration
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: job.job_name || 'Service',
              description: `Service for ${job.client_name || 'Client'}`,
            },
            unit_amount: totalPriceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/`,
      metadata: {
        job_id: jobId,
        client_name: job.client_name || 'Unknown Client',
        original_price: jobPrice.toString(),
        platform_fee_amount: (platformFeeInCents / 100).toString(),
        company_id: job.company_id || '',
        routing_method: useStripeConnect ? 'stripe_connect_direct' : 'platform_only',
      },
    };

    // Add application fee for Stripe Connect
    if (useStripeConnect && platformFeeInCents > 0) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: platformFeeInCents,
      };
      console.log('Using Stripe Connect Direct Charges with application fee:', platformFeeInCents, 'cents');
    }

    try {
      // Create Stripe checkout session - use stripeAccount parameter for Connect
      const session = useStripeConnect && connectedStripeAccountId 
        ? await stripe.checkout.sessions.create(sessionConfig, { 
            stripeAccount: connectedStripeAccountId 
          })
        : await stripe.checkout.sessions.create(sessionConfig);

      console.log("SUCCESS: Stripe session created:", session.id);
      console.log("- Session URL:", session.url);

      // Update job with payment URL
      const { error: updateError } = await supabaseAdmin
        .from('jobs')
        .update({ 
          payment_url: session.url,
          stripe_checkout_url: session.url 
        })
        .eq('id', jobId);

      if (updateError) {
        console.error("Error updating job with payment link:", updateError);
        // Don't fail the whole request if this update fails
        console.log("Continuing despite update error - payment link still generated");
      } else {
        console.log("Job updated with payment URL");
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          url: session.url,
          sessionId: session.id,
          pricing_info: {
            original_price: jobPrice,
            total_price: totalPriceInCents / 100,
            platform_fee: platformFeeInCents / 100,
            connect_used: useStripeConnect
          },
          routing_info: {
            method: useStripeConnect ? 'stripe_connect_direct' : 'platform_only',
            destination_account: useStripeConnect ? connectedStripeAccountId : 'platform',
            application_fee_cents: platformFeeInCents,
            charges_enabled: connectedAccountChargesEnabled
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (stripeError) {
      console.error("STRIPE API ERROR:", stripeError);
      
      // Fallback: Create platform-only session if Connect fails
      if (useStripeConnect) {
        console.log("Stripe Connect failed, falling back to platform processing");
        
        const fallbackConfig = { ...sessionConfig };
        delete fallbackConfig.payment_intent_data;
        
        const fallbackSession = await stripe.checkout.sessions.create(fallbackConfig);
        console.log("FALLBACK SUCCESS: Created platform-only session:", fallbackSession.id);
        
        return new Response(
          JSON.stringify({ 
            success: true,
            url: fallbackSession.url,
            sessionId: fallbackSession.id,
            warning: "Routed to platform account due to Stripe Connect issue"
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      // Re-throw error if not using Connect
      throw stripeError;
    }
  } catch (error) {
    console.error("Error in create-checkout function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Internal server error",
        details: "Check the function logs for more information"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
