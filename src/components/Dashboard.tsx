
import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => {
    fetchUserProfile();
  }, [session]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id, is_demo, stripe_connected')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setUserProfile({ company_id: null, is_demo: false, stripe_connected: false });
        return;
      }

      setUserProfile(data || { company_id: null, is_demo: false, stripe_connected: false });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setUserProfile({ company_id: null, is_demo: false, stripe_connected: false });
    } finally {
      setLoading(false);
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
                <Button variant="link" className="p-0 ml-2 h-auto text-orange-600 underline">
                  Connect Stripe
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
