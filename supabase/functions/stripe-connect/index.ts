
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Stripe Connect function started");
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ 
        success: false,
        error: "No authorization header provided" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
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
      console.error("User authentication error:", userError);
      return new Response(JSON.stringify({ 
        success: false,
        error: "User not authenticated" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;
    console.log("Processing Stripe Connect for user:", user.email);

    // Check if user already has Stripe connected
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_connected, stripe_account_id')
      .eq('id', user.id)
      .single();

    // If user already has a Stripe account, check its status with Stripe API
    if (!profileError && profile?.stripe_account_id) {
      console.log("User has existing Stripe account, checking status:", profile.stripe_account_id);
      
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        console.error("STRIPE_SECRET_KEY not found");
        return new Response(JSON.stringify({ 
          success: false,
          error: "Stripe configuration missing" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      const stripe = new Stripe(stripeKey, {
        apiVersion: "2023-10-16",
      });

      try {
        const account = await stripe.accounts.retrieve(profile.stripe_account_id);
        console.log("Stripe account status:", { 
          id: account.id, 
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled 
        });

        // Update the profile based on Stripe status
        const isConnected = account.details_submitted && account.charges_enabled;
        
        if (isConnected !== profile.stripe_connected) {
          console.log("Updating stripe_connected status to:", isConnected);
          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ 
              stripe_connected: isConnected,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) {
            console.error('Error updating profile stripe status:', updateError);
          }
        }

        if (isConnected) {
          console.log("User already has Stripe connected, redirecting to dashboard");
          return new Response(JSON.stringify({ 
            success: true,
            url: "https://preview--bleu-smart-flow.lovable.app/",
            already_connected: true
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      } catch (stripeError) {
        console.error("Error checking Stripe account status:", stripeError);
        // Continue with creating new account link if there's an error
      }
    }

    // Check Stripe key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not found");
      return new Response(JSON.stringify({ 
        success: false,
        error: "Stripe configuration missing" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    let accountId = profile?.stripe_account_id;

    // Create Stripe Connect account if it doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      console.log("Created Stripe account:", account.id);
      accountId = account.id;

      // Update user profile with Stripe account ID
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ 
          stripe_account_id: account.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile with Stripe account:', updateError);
        // Don't fail the whole process for this error, just log it
      }
    }

    // Create account link for onboarding with fixed URLs
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: "https://preview--bleu-smart-flow.lovable.app/",
      return_url: "https://preview--bleu-smart-flow.lovable.app/",
      type: "account_onboarding",
    });

    console.log("Created account link:", accountLink.url);
    console.log("Stripe Connect process completed successfully");

    return new Response(JSON.stringify({ 
      success: true,
      url: accountLink.url,
      account_id: accountId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Stripe connect error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || "An unexpected error occurred"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
