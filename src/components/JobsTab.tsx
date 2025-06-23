import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, CheckCircle, Clock, XCircle, Link, DollarSign, RotateCcw, Building } from "lucide-react";
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

interface UserProfile {
  company_id: string | null;
}

export const JobsTab = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'completed'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [generatingLinks, setGeneratingLinks] = useState<Set<string>>(new Set());
  const [markingAsPaid, setMarkingAsPaid] = useState<Set<string>>(new Set());
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

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it using the database function
        console.log('Profile not found, creating new profile...');
        
        const { data: newCompanyId, error: createError } = await supabase
          .rpc('ensure_user_profile', {
            user_id: user.id,
            user_email: user.email || ''
          });

        if (createError) {
          console.error('Error creating profile:', createError);
          throw createError;
        }

        // Return the new profile data
        setUserProfile({ company_id: newCompanyId });
        
        toast({
          title: "Profile Created",
          description: "Your profile has been set up successfully!",
        });
        
        return { company_id: newCompanyId };
      } else if (error) {
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

  const fetchJobs = async () => {
    console.log('Fetching jobs...');
    try {
      const profile = userProfile || await fetchUserProfile();
      
      if (!profile?.company_id) {
        console.log('No company_id found, skipping job fetch');
        setJobs([]);
        return;
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          clients!inner (
            name,
            email
          )
        `)
        .eq('clients.company_id', profile.company_id)
        .order('scheduled_date', { ascending: false });

      if (error) {
        console.error('Error fetching jobs:', error);
        throw error;
      }
      
      console.log('Jobs fetched successfully:', data);
      setJobs(data || []);
    } catch (error: any) {
      console.error('Failed to fetch jobs:', error);
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
    const initialize = async () => {
      const profile = await fetchUserProfile();
      if (profile) {
        await fetchJobs();
      } else {
        setLoading(false);
      }
    };
    
    initialize();
  }, []);

  const generatePaymentLink = async (jobId: string) => {
    console.log('Generating payment link for job:', jobId);
    setGeneratingLinks(prev => new Set(prev).add(jobId));
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { jobId }
      });

      if (error) {
        console.error('Error generating payment link:', error);
        throw error;
      }

      console.log('Payment link generated successfully:', data);

      toast({
        title: "Success",
        description: "Payment link generated successfully!",
      });

      // Refresh jobs to get the updated stripe_checkout_url
      await fetchJobs();
    } catch (error: any) {
      console.error('Failed to generate payment link:', error);
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

  const markAsPaid = async (job: Job) => {
    console.log('Marking job as paid:', job.id);
    setMarkingAsPaid(prev => new Set(prev).add(job.id));
    
    try {
      // Update job status to paid
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update({ status: 'paid' })
        .eq('id', job.id);

      if (jobUpdateError) {
        console.error('Error updating job status:', jobUpdateError);
        throw jobUpdateError;
      }

      // Create payment record
      const paymentData = {
        job_id: job.id,
        amount: job.price,
        payment_status: 'paid' as const,
        paid_at: new Date().toISOString(),
        card_saved: false,
        payment_method: 'manual'
      };

      console.log('Creating payment record:', paymentData);

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData);

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
        throw paymentError;
      }

      console.log('Job marked as paid successfully');

      toast({
        title: "Success",
        description: "Job marked as paid successfully!",
      });

      // Refresh jobs to get the updated status
      await fetchJobs();
    } catch (error: any) {
      console.error('Failed to mark job as paid:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark job as paid",
        variant: "destructive",
      });
    } finally {
      setMarkingAsPaid(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.id);
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
      console.error('Failed to copy link:', error);
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

  // Show company ID required message if user doesn't have one
  if (!userProfile?.company_id) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jobs</h2>
          <p className="text-gray-600">Manage your service jobs and payments</p>
        </div>
        <Card className="p-12 text-center">
          <CardContent>
            <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Company ID Required</h3>
            <p className="text-gray-600 mb-4">
              You need to generate a Company ID before you can create jobs.
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
                  <CardTitle className="text-lg flex items-center gap-2">
                    {job.title}
                    {job.is_recurring && (
                      <span title="Recurring job">
                        <RotateCcw className="w-4 h-4 text-blue-600" />
                      </span>
                    )}
                  </CardTitle>
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
              <div className="space-y-2">
                {job.status !== 'paid' && (
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
                )}
                {job.status !== 'paid' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsPaid(job)}
                    disabled={markingAsPaid.has(job.id)}
                    className="w-full border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <DollarSign className="w-4 h-4 mr-1" />
                    {markingAsPaid.has(job.id) ? "Marking as Paid..." : "Mark as Paid"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredJobs.length === 0 && userProfile?.company_id && (
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
        userProfile={userProfile}
      />
    </div>
  );
};
