
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, authorization, x-client-info, apikey",
  "Access-Control-Max-Age": "86400",
};

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

    // Fetch the company's Stripe account ID from profiles table
    let companyStripeAccountId = null;
    if (job.company_id) {
      console.log("Fetching company Stripe account for company_id:", job.company_id);
      const { data: companyProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id, stripe_connected')
        .eq('company_id', job.company_id)
        .eq('stripe_connected', true)
        .single();

      if (profileError) {
        console.error("Error fetching company profile:", profileError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Company not found or Stripe not connected. Please ensure the company has connected their Stripe account." 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      if (!companyProfile?.stripe_account_id) {
        console.error("Company does not have Stripe account connected");
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Company Stripe account not found. Please connect Stripe first." 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      companyStripeAccountId = companyProfile.stripe_account_id;
      console.log("Found company Stripe account:", companyStripeAccountId);
    } else {
      console.warn("Job does not have company_id, using platform account");
    }

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

    console.log("Creating Stripe checkout session");

    // Convert to cents and calculate platform fee (5%)
    const jobPriceInCents = Math.round(jobPrice * 100);
    const platformFeeInCents = Math.round(jobPriceInCents * 0.05);
    const totalAmountInCents = jobPriceInCents;

    console.log("Original job price:", jobPrice);
    console.log("Job price in cents:", jobPriceInCents);
    console.log("Platform fee (5%) in cents:", platformFeeInCents);
    console.log("Total amount in cents:", totalAmountInCents);

    if (totalAmountInCents < 50) {
      console.error("Price too low for Stripe (minimum $0.50):", totalAmountInCents);
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
            unit_amount: totalAmountInCents,
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
      },
    };

    // Add Stripe Connect configuration if company has connected account
    if (companyStripeAccountId) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: platformFeeInCents,
        transfer_data: {
          destination: companyStripeAccountId,
        },
      };
      console.log("Using Stripe Connect with destination:", companyStripeAccountId, "and platform fee:", platformFeeInCents);
    } else {
      console.log("Using platform account (no Stripe Connect)");
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(
      sessionConfig,
      companyStripeAccountId ? { stripeAccount: companyStripeAccountId } : undefined
    );

    console.log("Stripe session created:", session.id);

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
        sessionId: session.id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
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
