
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Auth } from "./Auth";
import { Dashboard } from "@/components/Dashboard";
import { LandingPage } from "@/components/LandingPage";
import { Toaster } from "@/components/ui/toaster";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    // Set page title
    document.title = "Smart Invoice - Get Paid Like a Pro";
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUp = () => {
    setShowAuth(true);
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      // Sign in with demo account
      const { error } = await supabase.auth.signInWithPassword({
        email: "demo@smartinvoice.com",
        password: "demo123456",
      });
      
      if (error) {
        // If demo account doesn't exist, create it
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: "demo@smartinvoice.com",
          password: "demo123456",
        });
        
        if (signUpError) {
          throw signUpError;
        }
        
        // Create demo profile if user was created
        if (signUpData.user) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: signUpData.user.id,
              email: "demo@smartinvoice.com",
              company_id: "demo-company-123",
              role: 'invoice_owner',
              is_demo: true
            });
            
          if (profileError) {
            console.error('Demo profile creation error:', profileError);
          }
        }
      }
    } catch (error: any) {
      console.error('Demo mode error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show dashboard if user is logged in
  if (session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Dashboard session={session} />
        <Toaster />
      </div>
    );
  }

  // Show auth page if user clicked sign up
  if (showAuth) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Auth />
        <Toaster />
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-white">
      <LandingPage onSignUp={handleSignUp} onDemo={handleDemo} />
      <Toaster />
    </div>
  );
};

export default Index;
