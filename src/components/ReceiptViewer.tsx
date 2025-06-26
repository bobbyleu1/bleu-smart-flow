
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Loader2 } from "lucide-react";

interface ReceiptViewerProps {
  jobId: string;
  receiptId?: string;
  trigger?: React.ReactNode;
}

interface Receipt {
  id: string;
  job_id: string;
  session_id: string;
  amount_paid: number;
  receipt_html: string;
  created_at: string;
}

export const ReceiptViewer = ({ jobId, receiptId, trigger }: ReceiptViewerProps) => {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const fetchReceipt = async () => {
    if (!receiptId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (error) {
        console.error('Error fetching receipt:', error);
        throw new Error('Failed to fetch receipt');
      }

      if (data) {
        setReceipt(data);
      } else {
        throw new Error('Receipt not found');
      }
    } catch (error) {
      console.error('Failed to fetch receipt:', error);
      toast({
        title: "Error",
        description: "Failed to load receipt",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && receiptId) {
      fetchReceipt();
    }
  }, [open, receiptId]);

  const downloadReceipt = () => {
    if (!receipt) return;

    const blob = new Blob([receipt.receipt_html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receipt.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Receipt downloaded successfully",
    });
  };

  const printReceipt = () => {
    if (!receipt) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receipt.receipt_html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (!receiptId) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            View Receipt
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Payment Receipt</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadReceipt}
                disabled={!receipt}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={printReceipt}
                disabled={!receipt}
              >
                Print
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-2">Loading receipt...</span>
            </div>
          ) : receipt ? (
            <div 
              className="border rounded-lg p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: receipt.receipt_html }}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Receipt not available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
