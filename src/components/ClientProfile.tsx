
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MapPin, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface Job {
  id: string;
  title: string;
  job_name: string | null;
  price: number;
  scheduled_date: string;
  status: 'pending' | 'paid' | 'completed' | 'test' | null;
  payments: Payment[];
}

interface Payment {
  id: string;
  amount: number;
  payment_status: string;
  paid_at: string | null;
  payment_method: string | null;
}

interface ClientProfileProps {
  clientId: string;
  onBack: () => void;
}

export const ClientProfile = ({ clientId, onBack }: ClientProfileProps) => {
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClientData = async () => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          *,
          payments (*)
        `)
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: false });

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch client data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const calculateTotalRevenue = () => {
    return jobs
      .filter(job => job.status === 'paid')
      .reduce((total, job) => total + job.price, 0);
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading client profile...</div>;
  }

  if (!client) {
    return <div className="flex justify-center p-8">Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
          <p className="text-gray-600">Client Profile</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-gray-500" />
            <span>{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-500" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span>{client.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <DollarSign className="w-4 h-4" />
            <span>Total Revenue: ${calculateTotalRevenue().toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Job History</h3>
        {jobs.length === 0 ? (
          <Card className="p-8 text-center">
            <CardContent>
              <p className="text-gray-500">No jobs found for this client</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{job.job_name || job.title}</CardTitle>
                      <CardDescription>
                        Scheduled: {new Date(job.scheduled_date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600 mb-2">
                        ${job.price.toFixed(2)}
                      </div>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {job.payments && job.payments.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Payment History</h4>
                      <div className="space-y-2">
                        {job.payments.map((payment) => (
                          <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium">${(payment.amount / 100).toFixed(2)}</div>
                              <div className="text-sm text-gray-600">
                                {payment.payment_method || 'card'} • {payment.payment_status}
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : 'Not paid'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No payment records</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
