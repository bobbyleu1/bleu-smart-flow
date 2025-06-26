
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set page title
    document.title = "Smart Invoice - Login";
    
    // Check if this is an invite link
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('company_id');
    if (companyId) {
      setInviteCompanyId(companyId);
      setIsSignUp(true); // Force sign-up mode for invite links
    }
  }, []);

  const ensureUserProfile = async (userId: string, userEmail: string) => {
    console.log('Ensuring user profile exists for:', userId);
    
    try {
      // First try to get existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching existing profile:', fetchError);
        throw fetchError;
      }

      if (existingProfile) {
        if (existingProfile.company_id) {
          console.log('Profile exists with company_id:', existingProfile.company_id);
          return existingProfile.company_id;
        } else {
          // Profile exists but no company_id, generate one
          const newCompanyId = crypto.randomUUID();
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ company_id: newCompanyId })
            .eq('id', userId);

          if (updateError) {
            console.error('Error updating profile with company_id:', updateError);
            throw updateError;
          }

          console.log('Updated profile with new company_id:', newCompanyId);
          return newCompanyId;
        }
      } else {
        // Profile doesn't exist, create one
        const newCompanyId = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail,
            company_id: newCompanyId,
            role: 'invoice_owner'
          });

        if (insertError) {
          console.error('Error creating new profile:', insertError);
          throw insertError;
        }

        console.log('Created new profile with company_id:', newCompanyId);
        return newCompanyId;
      }
    } catch (error) {
      console.error('Failed to ensure user profile:', error);
      throw error;
    }
  };

  const handleInviteUser = async (userId: string, userEmail: string) => {
    if (!inviteCompanyId) return;
    
    console.log('Updating profile for invited user:', userId, 'to company:', inviteCompanyId);
    
    // Wait a moment for the profile to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update the user's profile to join the invite company
    const { error } = await supabase
      .from('profiles')
      .update({ 
        company_id: inviteCompanyId,
        role: 'teammate'
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile for invite:', error);
      throw error;
    }

    console.log('Profile updated for invite successfully');
  };

  const handleDemoMode = async () => {
    setDemoLoading(true);
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
      
      toast({
        title: "Demo Mode Activated",
        description: "Welcome to Smart Invoice demo! Payments are disabled in demo mode.",
      });
    } catch (error: any) {
      console.error('Demo mode error:', error);
      toast({
        title: "Demo Error",
        description: "Failed to start demo mode. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        console.log('Starting sign-up process...');
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          console.error('Sign-up error:', error);
          throw error;
        }

        console.log('Sign-up successful, user:', data.user?.id);

        // Ensure user profile is created with company_id
        if (data.user) {
          try {
            // Wait for auth to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Ensure profile exists and has company_id
            await ensureUserProfile(data.user.id, data.user.email || email);
            
            // Handle invite users
            if (inviteCompanyId) {
              await handleInviteUser(data.user.id, data.user.email || email);
              
              toast({
                title: "Account created!",
                description: "Welcome to the team! Please check your email to verify your account.",
              });
            } else {
              toast({
                title: "Account created!",
                description: "Your company has been created! Please check your email to verify your account.",
              });
            }
          } catch (profileError: any) {
            console.error('Profile creation/update failed:', profileError);
            toast({
              title: "Account Created",
              description: "Your account was created but there was an issue setting up your profile. Please contact support if you encounter issues.",
              variant: "destructive",
            });
          }
        }
      } else {
        console.log('Starting sign-in process...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error('Sign-in error:', error);
          throw error;
        }
        
        console.log('Sign-in successful');
        
        // Ensure profile exists for existing users who might not have company_id
        if (data.user) {
          try {
            await ensureUserProfile(data.user.id, data.user.email || email);
          } catch (profileError) {
            console.error('Failed to ensure profile on login:', profileError);
            // Don't block login for this
          }
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: "Error",
        description: error.message || "Authentication failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <CardTitle className="text-2xl font-bold text-blue-600">
            Smart Invoice
          </CardTitle>
          <CardDescription>
            {inviteCompanyId 
              ? "Join your team" 
              : isSignUp 
                ? "Create your business account" 
                : "Sign in to your dashboard"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 h-11"
              disabled={loading}
            >
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
          
          {!inviteCompanyId && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleDemoMode}
                disabled={demoLoading}
                className="w-full h-11"
              >
                {demoLoading ? "Starting Demo..." : "💡 Try Demo Mode"}
              </Button>
              
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-blue-600"
                >
                  {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
                </Button>
              </div>
            </>
          )}
          
          {inviteCompanyId && (
            <div className="text-center">
              <p className="text-sm text-gray-600">
                You've been invited to join a company team
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
