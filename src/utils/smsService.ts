
import { supabase } from "@/integrations/supabase/client";

export interface SMSRequest {
  phoneNumber: string;
  message: string;
  jobId?: string;
}

export const sendSMSNotification = async ({ phoneNumber, message, jobId }: SMSRequest): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`[SMS Service] Attempting to send SMS to ${phoneNumber}`);
    console.log(`[SMS Service] Message: ${message}`);
    console.log(`[SMS Service] Job ID: ${jobId}`);

    // Call the SMS edge function
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        phoneNumber,
        message,
        jobId
      }
    });

    if (error) {
      console.error('[SMS Service] Error sending SMS:', error);
      return { success: false, error: error.message };
    }

    console.log('[SMS Service] SMS sent successfully:', data);
    return { success: true };
  } catch (error: any) {
    console.error('[SMS Service] Failed to send SMS:', error);
    return { success: false, error: error.message };
  }
};

export const formatPaymentLinkSMS = (paymentUrl: string, jobTitle: string, clientName: string, amount: number): string => {
  return `Hi ${clientName}! Your payment link for "${jobTitle}" ($${amount.toFixed(2)}) is ready: ${paymentUrl}`;
};
