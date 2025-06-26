
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

    console.log("Job details fetched:", { id: job.id, job_name: job.job_name, price: job.price });

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

    // Apply 5% platform fee and convert to cents (round to nearest cent)
    const jobPriceWithFee = Math.round(jobPrice * 1.05 * 100);
    console.log("Original job price:", jobPrice);
    console.log("Job price with 5% fee in cents:", jobPriceWithFee);

    if (jobPriceWithFee < 50) {
      console.error("Price too low for Stripe (minimum $0.50):", jobPriceWithFee);
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

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: job.job_name || 'Service',
              description: `Service for ${job.client_name || 'Client'} (includes 5% platform fee)`,
            },
            unit_amount: jobPriceWithFee,
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
        platform_fee_percentage: "5",
      },
    });

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
