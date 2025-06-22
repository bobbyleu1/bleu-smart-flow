import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, CheckCircle, Clock, XCircle, Link } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreateJobDialog } from "./CreateJobDialog";

interface Job {
  id: string;
  title: string;
  price: number;
  description: string;
  scheduled_date: string;
  is_recurring: boolean;
  status: 'pending' | 'paid' | 'completed';
  stripe_checkout_url: string | null;
  clients: {
    name: string;
    email: string;
  };
}

export const JobsTab = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'completed'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [generatingLinks, setGeneratingLinks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          clients (
            name,
            email
          )
        `)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const generatePaymentLink = async (jobId: string) => {
    setGeneratingLinks(prev => new Set(prev).add(jobId));
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { jobId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment link generated successfully!",
      });

      // Refresh jobs to get the updated stripe_checkout_url
      await fetchJobs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate payment link",
        variant: "destructive",
      });
    } finally {
      setGeneratingLinks(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const copyPaymentLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Success",
        description: "Payment link copied to clipboard!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: string) => {
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

  const filteredJobs = jobs.filter(job => filter === 'all' || job.status === filter);

  if (loading) {
    return <div className="flex justify-center p-8">Loading jobs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jobs</h2>
          <p className="text-gray-600">Manage your service jobs and payments</p>
        </div>
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Job
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'paid', 'completed'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
            className={filter === status ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Jobs Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredJobs.map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    {job.clients.name}
                    {job.is_recurring && (
                      <Badge variant="secondary" className="text-xs">Recurring</Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(job.status)}
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold text-green-600">
                ${job.price.toFixed(2)}
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {job.description}
              </p>
              <div className="text-sm text-gray-500">
                Scheduled: {new Date(job.scheduled_date).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                {job.stripe_checkout_url ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(job.stripe_checkout_url!, '_blank')}
                      className="flex-1"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Open Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyPaymentLink(job.stripe_checkout_url!)}
                    >
                      <Link className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => generatePaymentLink(job.id)}
                    disabled={generatingLinks.has(job.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {generatingLinks.has(job.id) ? "Generating..." : "Generate Link"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-gray-500 mb-4">No jobs found</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Job
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateJobDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onJobCreated={fetchJobs}
      />
    </div>
  );
};
