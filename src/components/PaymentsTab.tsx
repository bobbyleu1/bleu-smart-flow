
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, DollarSign, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Payment {
  id: string;
  amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  paid_at: string | null;
  card_saved: boolean;
  jobs: {
    title: string;
    job_name: string | null;
    clients: {
      name: string;
    };
  };
}

interface UserProfile {
  company_id: string | null;
}

export const PaymentsTab = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    paidThisMonth: 0,
  });
  const { toast } = useToast();

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }

      setUserProfile(profileData);
      return profileData;
    } catch (error: any) {
      console.error('Failed to fetch user profile:', error);
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive",
      });
      return null;
    }
  };

  const fetchPayments = async () => {
    try {
      const profile = userProfile || await fetchUserProfile();
      
      if (!profile?.company_id) {
        console.log('No company_id found, skipping payments fetch');
        setPayments([]);
        setStats({ totalRevenue: 0, pendingAmount: 0, paidThisMonth: 0 });
        return;
      }

      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          jobs!inner (
            title,
            job_name,
            clients!inner (
              name
            )
          )
        `)
        .eq('jobs.company_id', profile.company_id)
        .order('paid_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      
      // Type assertion to handle the payment_status field
      const typedPayments = (data || []).map(payment => ({
        ...payment,
        payment_status: payment.payment_status as 'pending' | 'paid' | 'failed'
      })) as Payment[];
      
      setPayments(typedPayments);

      const totalRevenue = typedPayments?.reduce((sum, payment) => 
        payment.payment_status === 'paid' ? sum + payment.amount : sum, 0) || 0;
      
      const pendingAmount = typedPayments?.reduce((sum, payment) => 
        payment.payment_status === 'pending' ? sum + payment.amount : sum, 0) || 0;

      const thisMonth = new Date();
      thisMonth.setDate(1);
      const paidThisMonth = typedPayments?.reduce((sum, payment) => {
        if (payment.payment_status === 'paid' && payment.paid_at) {
          const paidDate = new Date(payment.paid_at);
          return paidDate >= thisMonth ? sum + payment.amount : sum;
        }
        return sum;
      }, 0) || 0;

      setStats({ totalRevenue, pendingAmount, paidThisMonth });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const profile = await fetchUserProfile();
      if (profile) {
        await fetchPayments();
      } else {
        setLoading(false);
      }
    };
    
    initialize();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading payments...</div>;
  }

  if (!userProfile?.company_id) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <p className="text-gray-600">Track your payment history and revenue</p>
        </div>
        <Card className="p-12 text-center">
          <CardContent>
            <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Company ID Required</h3>
            <p className="text-gray-600 mb-4">
              You need to generate a Company ID before you can view payments.
            </p>
            <p className="text-sm text-gray-500">
              Go to the Account tab to generate your Company ID first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
        <p className="text-gray-600">Track your payment history and revenue</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${(stats.totalRevenue / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${(stats.pendingAmount / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month 💎</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${(stats.paidThisMonth / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {payments.map((payment) => (
          <Card key={payment.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-medium">{payment.jobs.job_name || payment.jobs.title}</h4>
                      <p className="text-sm text-gray-600">
                        {payment.jobs.clients.name}
                      </p>
                    </div>
                    {payment.card_saved && (
                      <Badge variant="secondary" className="text-xs">
                        💎 Card Saved
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      ${(payment.amount / 100).toFixed(2)}
                    </div>
                    {payment.paid_at && (
                      <div className="text-xs text-gray-500">
                        {new Date(payment.paid_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {getStatusIcon(payment.payment_status)}
                    <Badge className={getStatusColor(payment.payment_status)}>
                      {payment.payment_status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {payments.length === 0 && userProfile?.company_id && (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-gray-500">No payments recorded yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Payments will appear here when clients pay for jobs
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
