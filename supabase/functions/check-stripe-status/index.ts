
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
    console.log("Check Stripe status function started");
    
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
    
    if (userError || !userData.user) {
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
    console.log("Checking Stripe status for user:", user.email);

    // Get user profile with Stripe account ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_account_id, stripe_connected')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_account_id) {
      console.log("No Stripe account found for user");
      return new Response(JSON.stringify({ 
        success: true,
        connected: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
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

    // Check account status with Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    console.log("Stripe account details:", {
      id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled
    });

    const isConnected = account.details_submitted && account.charges_enabled;

    // Update profile if status changed
    if (isConnected !== profile.stripe_connected) {
      console.log("Updating stripe_connected status from", profile.stripe_connected, "to", isConnected);
      
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ 
          stripe_connected: isConnected,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile stripe status:', updateError);
        return new Response(JSON.stringify({ 
          success: false,
          error: "Failed to update profile" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }
    }

    console.log("Stripe status check completed successfully");

    return new Response(JSON.stringify({ 
      success: true,
      connected: isConnected,
      account_id: account.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Check Stripe status error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || "An unexpected error occurred"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
