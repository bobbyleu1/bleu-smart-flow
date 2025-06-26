
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, authorization, x-client-info, apikey",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  console.log("SMS function called with method:", req.method);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    console.log("SMS function started");

    const requestBody = await req.json();
    const { phoneNumber, message, jobId } = requestBody;

    console.log("SMS request details:", { 
      phoneNumber: phoneNumber ? `${phoneNumber.substring(0, 3)}***` : 'none', 
      messageLength: message?.length || 0,
      jobId 
    });

    if (!phoneNumber || !message) {
      console.error("Phone number and message are required");
      return new Response(
        JSON.stringify({ error: "Phone number and message are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Check for Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      console.log("Twilio credentials found, sending SMS via Twilio");
      
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        const formData = new FormData();
        formData.append('From', twilioPhoneNumber);
        formData.append('To', phoneNumber);
        formData.append('Body', message);

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
          },
          body: formData,
        });

        const responseData = await response.json();

        if (response.ok) {
          console.log("SMS sent successfully via Twilio:", responseData.sid);
          return new Response(
            JSON.stringify({ 
              success: true, 
              provider: "twilio",
              messageId: responseData.sid 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } else {
          console.error("Twilio API error:", responseData);
          throw new Error(`Twilio error: ${responseData.message}`);
        }
      } catch (twilioError) {
        console.error("Failed to send SMS via Twilio:", twilioError);
        // Fall back to console log
      }
    }

    // Check for Vonage credentials
    const vonageApiKey = Deno.env.get("VONAGE_API_KEY");
    const vonageApiSecret = Deno.env.get("VONAGE_API_SECRET");

    if (vonageApiKey && vonageApiSecret) {
      console.log("Vonage credentials found, sending SMS via Vonage");
      
      try {
        const vonageUrl = "https://rest.nexmo.com/sms/json";
        
        const vonageData = {
          from: "SmartInvoice",
          to: phoneNumber.replace(/[^\d+]/g, ''), // Clean phone number
          text: message,
          api_key: vonageApiKey,
          api_secret: vonageApiSecret,
        };

        const response = await fetch(vonageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(vonageData),
        });

        const responseData = await response.json();

        if (response.ok && responseData.messages?.[0]?.status === "0") {
          console.log("SMS sent successfully via Vonage:", responseData.messages[0]["message-id"]);
          return new Response(
            JSON.stringify({ 
              success: true, 
              provider: "vonage",
              messageId: responseData.messages[0]["message-id"] 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } else {
          console.error("Vonage API error:", responseData);
          throw new Error(`Vonage error: ${responseData.messages?.[0]?.["error-text"] || "Unknown error"}`);
        }
      } catch (vonageError) {
        console.error("Failed to send SMS via Vonage:", vonageError);
        // Fall back to console log
      }
    }

    // Fallback: Log SMS details to console
    console.log("=== SMS FALLBACK (No API keys configured) ===");
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    console.log(`Job ID: ${jobId || 'N/A'}`);
    console.log("=== END SMS FALLBACK ===");

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: "console",
        message: "SMS logged to console (no SMS service configured)" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in send-sms function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
