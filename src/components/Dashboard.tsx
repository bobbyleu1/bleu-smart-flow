import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JobsTab } from "./JobsTab";
import { ClientsTab } from "./ClientsTab";
import { PaymentsTab } from "./PaymentsTab";
import { RevenueTab } from "./RevenueTab";
import { ProfileTab } from "./ProfileTab";
import { LogOut, Receipt, AlertTriangle } from "lucide-react";

interface DashboardProps {
  session: Session;
}

interface UserProfile {
  company_id: string | null;
  is_demo?: boolean;
  stripe_connected?: boolean;
}

export const Dashboard = ({ session }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState("jobs");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUserProfile();
    
    // Check Stripe status on component mount (in case user just returned from Stripe)
    checkStripeStatusOnLoad();
  }, [session]);

  const ensureProfileHasCompanyId = async (userId: string, userEmail: string) => {
    console.log('Ensuring profile has company_id for user:', userId);
    
    try {
      // Check if profile exists and has company_id
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, company_id, email')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching profile:', fetchError);
        throw fetchError;
      }

      if (!profile) {
        // Profile doesn't exist, create one
        const newCompanyId = crypto.randomUUID();
        console.log('Creating missing profile with company_id:', newCompanyId);
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail,
            company_id: newCompanyId,
            role: 'invoice_owner'
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }

        console.log('Profile created successfully');
        return newCompanyId;
      } else if (!profile.company_id) {
        // Profile exists but no company_id
        const newCompanyId = crypto.randomUUID();
        console.log('Updating profile with company_id:', newCompanyId);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            company_id: newCompanyId,
            email: userEmail // Ensure email is updated
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          throw updateError;
        }

        console.log('Profile updated with company_id successfully');
        return newCompanyId;
      } else {
        console.log('Profile already has company_id:', profile.company_id);
        return profile.company_id;
      }
    } catch (error) {
      console.error('Failed to ensure profile has company_id:', error);
      throw error;
    }
  };

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile...');
      
      // First ensure the user has a proper profile with company_id
      await ensureProfileHasCompanyId(session.user.id, session.user.email || '');
      
      // Now fetch the profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id, is_demo, stripe_connected')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        
        // If we still can't fetch, create a basic profile object
        setUserProfile({ 
          company_id: crypto.randomUUID(), 
          is_demo: false, 
          stripe_connected: false 
        });
        return;
      }

      console.log('Profile data fetched:', data);
      setUserProfile(data || { company_id: null, is_demo: false, stripe_connected: false });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      
      // Fallback: create a basic profile to prevent app crashes
      setUserProfile({ 
        company_id: crypto.randomUUID(), 
        is_demo: false, 
        stripe_connected: false 
      });
      
      toast({
        title: "Profile Setup",
        description: "There was an issue with your profile setup. A new company has been created for you.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkStripeStatusOnLoad = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) return;

      const { data, error } = await supabase.functions.invoke('check-stripe-status', {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });
      
      if (error) {
        console.error('Error checking Stripe status:', error);
        return;
      }

      if (data?.connected) {
        console.log('Stripe is connected, refreshing profile');
        // Refresh profile to get updated stripe_connected status
        await fetchUserProfile();
      }
    } catch (error) {
      console.error('Failed to check Stripe status:', error);
    }
  };

  const connectStripe = async () => {
    console.log('Connect Stripe from banner clicked');
    if (!userProfile) {
      console.error('No profile found');
      toast({
        title: "Error",
        description: "Profile not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    setConnectingStripe(true);
    try {
      console.log('Invoking stripe-connect function from banner...');
      
      // Get the current user's token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('No active session found');
      }

      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });
      
      console.log('Banner function response:', { data, error });
      
      if (error) {
        console.error('Stripe Connect function error from banner:', error);
        toast({
          title: "Connection Error",
          description: `Failed to connect to Stripe: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!data) {
        console.error('No data returned from function');
        toast({
          title: "Error",
          description: "No response from Stripe connection service.",
          variant: "destructive",
        });
        return;
      }

      // Check if the response indicates an error
      if (data.success === false) {
        console.error('Function returned error from banner:', data.error);
        toast({
          title: "Stripe Connection Failed",
          description: data.error || "Failed to connect Stripe account",
          variant: "destructive",
        });
        return;
      }

      console.log('Stripe Connect function success from banner:', data);
      
      if (data.url) {
        console.log('Redirecting to Stripe onboarding from banner:', data.url);
        toast({
          title: "Redirecting to Stripe",
          description: "Opening Stripe account setup...",
        });
        // Redirect to Stripe Connect onboarding
        window.location.href = data.url;
      } else {
        console.error('No URL in successful response from banner:', data);
        toast({
          title: "Setup Error",
          description: "Stripe account was created but no setup URL was provided.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error connecting Stripe from banner:', error);
      toast({
        title: "Connection Failed",
        description: `Failed to connect Stripe account: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const isDemoMode = userProfile?.is_demo || session.user.email === "demo@smartinvoice.com";
  const needsStripeConnection = !isDemoMode && !userProfile?.stripe_connected;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Smart Invoice
                {isDemoMode && (
                  <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    Demo
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500">
                Welcome back, {session.user.email}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {isDemoMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <Alert className="border-yellow-300 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                💡 <strong>Demo Mode</strong> – Payments are disabled in this account. This is for testing purposes only.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {needsStripeConnection && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <Alert className="border-orange-300 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                ⚠️ <strong>Please connect your Stripe account to start receiving payments.</strong> 
                <Button 
                  variant="link" 
                  className="p-0 ml-2 h-auto text-orange-600 underline"
                  onClick={connectStripe}
                  disabled={connectingStripe}
                >
                  {connectingStripe ? "Redirecting..." : "Connect Stripe"}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="profile">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <JobsTab userProfile={userProfile} isDemoMode={isDemoMode} />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab />
          </TabsContent>

          <TabsContent value="revenue">
            <RevenueTab />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
