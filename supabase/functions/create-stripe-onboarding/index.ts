
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
  console.log("Create Stripe onboarding function called with method:", req.method);
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
    console.log("Create Stripe onboarding function started");

    // Check for Stripe secret key first
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not found in environment");
      return new Response(
        JSON.stringify({ 
          error: "Stripe configuration missing. Please add your Stripe secret key to edge function secrets.",
          details: "Go to Supabase Dashboard → Edge Functions → Settings and add STRIPE_SECRET_KEY"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    console.log("Stripe secret key found, proceeding with request");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header provided" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      console.error("User not authenticated:", userError);
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const user = userData.user;
    console.log("Creating Stripe Connect account for user:", user.email);

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    console.log("Created Stripe account:", account.id);

    // Create account link for onboarding
    const origin = req.headers.get("origin") || "http://localhost:5173";
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/profile?stripe_refresh=true`,
      return_url: `${origin}/profile?stripe_success=true`,
      type: "account_onboarding",
    });

    console.log("Created account link:", accountLink.url);

    // Update user profile with Stripe account ID (but not connected yet)
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        stripe_account_id: account.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile with Stripe account:', updateError);
    }

    console.log("Stripe onboarding setup complete, returning URL");

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      account_id: account.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in create-stripe-onboarding function:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error",
      details: "Check the function logs for more information"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
