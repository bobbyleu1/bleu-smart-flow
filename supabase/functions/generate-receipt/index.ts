
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReceiptData {
  jobId: string;
  sessionId: string;
  amountPaid: number;
  paymentDate: string;
}

const generateReceiptHTML = (job: any, receiptData: ReceiptData) => {
  const baseAmount = job.price;
  const totalAmount = receiptData.amountPaid / 100; // Convert from cents
  const platformFee = totalAmount - baseAmount;
  const paymentDate = new Date(receiptData.paymentDate).toLocaleDateString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .paid-stamp { background: #22c55e; color: white; padding: 10px 20px; border-radius: 5px; font-weight: bold; display: inline-block; margin: 20px 0; }
        .details { margin: 20px 0; }
        .row { display: flex; justify-content: space-between; margin: 10px 0; }
        .total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 10px; }
        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Smart Invoice</h1>
        <h2>Payment Receipt</h2>
        <div class="paid-stamp">✅ PAID</div>
      </div>
      
      <div class="details">
        <div class="row">
          <span><strong>Invoice #:</strong></span>
          <span>${job.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div class="row">
          <span><strong>Date of Payment:</strong></span>
          <span>${paymentDate}</span>
        </div>
        <div class="row">
          <span><strong>Service:</strong></span>
          <span>${job.job_name || 'Service'}</span>
        </div>
        <div class="row">
          <span><strong>Client:</strong></span>
          <span>${job.client_name || 'N/A'}</span>
        </div>
      </div>

      <div class="details">
        <h3>Payment Breakdown</h3>
        <div class="row">
          <span>Service Amount:</span>
          <span>$${baseAmount.toFixed(2)}</span>
        </div>
        <div class="row">
          <span>Processing Fee:</span>
          <span>$${platformFee.toFixed(2)}</span>
        </div>
        <div class="row total">
          <span>Total Paid:</span>
          <span>$${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your payment!</p>
        <p>Receipt ID: ${receiptData.sessionId}</p>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const receiptData: ReceiptData = await req.json();
    console.log("Generating receipt for job:", receiptData.jobId);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', receiptData.jobId)
      .single();

    if (jobError || !job) {
      console.error("Error fetching job:", jobError);
      throw new Error("Job not found");
    }

    // Generate receipt HTML
    const receiptHTML = generateReceiptHTML(job, receiptData);
    
    // Store receipt in database for future access
    const receiptId = crypto.randomUUID();
    const { error: receiptInsertError } = await supabase
      .from('receipts')
      .insert({
        id: receiptId,
        job_id: receiptData.jobId,
        session_id: receiptData.sessionId,
        amount_paid: receiptData.amountPaid,
        receipt_html: receiptHTML,
        created_at: new Date().toISOString()
      });

    if (receiptInsertError) {
      console.error("Error storing receipt:", receiptInsertError);
      // Continue even if storage fails
    }

    // Update job with receipt_id
    await supabase
      .from('jobs')
      .update({ receipt_id: receiptId })
      .eq('id', receiptData.jobId);

    console.log("Receipt generated successfully for job:", receiptData.jobId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        receiptId: receiptId,
        message: "Receipt generated successfully" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error generating receipt:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
