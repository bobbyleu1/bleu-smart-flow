
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, CreditCard, FileText, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Payment {
  id: string;
  amount: number;
  payment_status: string;
  paid_at: string | null;
  payment_method: string;
  jobs: {
    title: string;
  };
}

interface RevenueStats {
  totalRevenue: number;
  paidJobs: number;
  stripePayments: number;
  manualPayments: number;
}

export const RevenueTab = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("week");
  const { toast } = useToast();

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          jobs (
            title
          )
        `)
        .eq('payment_status', 'paid')
        .not('paid_at', 'is', null)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch payment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const getDateRange = (period: string) => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0); // Beginning of time
    }

    return { startDate, endDate: now };
  };

  const calculateStats = (period: string): RevenueStats => {
    const { startDate } = getDateRange(period);
    
    const filteredPayments = payments.filter(payment => {
      if (!payment.paid_at) return false;
      const paidDate = new Date(payment.paid_at);
      return paidDate >= startDate;
    });

    const totalRevenue = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const paidJobs = filteredPayments.length;
    const stripePayments = filteredPayments.filter(p => p.payment_method === 'stripe').length;
    const manualPayments = filteredPayments.filter(p => p.payment_method === 'manual').length;

    return {
      totalRevenue,
      paidJobs,
      stripePayments,
      manualPayments,
    };
  };

  const getChartData = () => {
    const now = new Date();
    const days = [];
    
    // Get last 7 days for week view, last 30 days for month view
    const dayCount = activeTab === 'week' ? 7 : activeTab === 'month' ? 30 : 7;
    
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayRevenue = payments
        .filter(payment => {
          if (!payment.paid_at) return false;
          const paidDate = new Date(payment.paid_at);
          return paidDate.toDateString() === date.toDateString();
        })
        .reduce((sum, payment) => sum + payment.amount, 0);

      days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue / 100, // Convert cents to dollars
      });
    }
    
    return days;
  };

  const stats = calculateStats(activeTab);
  const chartData = getChartData();

  if (loading) {
    return <div className="flex justify-center p-8">Loading revenue data...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Revenue Analytics</h2>
        <p className="text-gray-600">Track your payment performance and revenue trends</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <CardTitle className="text-sm font-medium">Paid Jobs</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.paidJobs}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stripe Payments</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.stripePayments}
                </div>
                <div className="text-xs text-muted-foreground">
                  vs {stats.manualPayments} manual
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg per Job</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ${stats.paidJobs > 0 ? ((stats.totalRevenue / 100) / stats.paidJobs).toFixed(2) : '0.00'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Daily Revenue Trend
                </CardTitle>
                <CardDescription>
                  Revenue breakdown for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [`$${value}`, 'Revenue']}
                        labelStyle={{ color: '#374151' }}
                      />
                      <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Method Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Breakdown of payment methods used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">Stripe Payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{stats.stripePayments} jobs</Badge>
                    <span className="text-sm text-gray-600">
                      ${((payments.filter(p => p.payment_method === 'stripe' && new Date(p.paid_at!) >= getDateRange(activeTab).startDate).reduce((sum, p) => sum + p.amount, 0)) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Manual Payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{stats.manualPayments} jobs</Badge>
                    <span className="text-sm text-gray-600">
                      ${((payments.filter(p => p.payment_method === 'manual' && new Date(p.paid_at!) >= getDateRange(activeTab).startDate).reduce((sum, p) => sum + p.amount, 0)) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {payments.length === 0 && (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-gray-500">No payment data available yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Revenue analytics will appear here once you start receiving payments
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
