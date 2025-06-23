
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if this is an invite link
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('company_id');
    if (companyId) {
      setInviteCompanyId(companyId);
      setIsSignUp(true); // Force sign-up mode for invite links
    }
  }, []);

  const handleInviteUser = async (userId: string, userEmail: string) => {
    if (!inviteCompanyId) return;
    
    console.log('Updating profile for invited user:', userId, 'to company:', inviteCompanyId);
    
    // Wait a moment for the trigger to create the profile
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

        // Handle invite users
        if (data.user && inviteCompanyId) {
          try {
            await handleInviteUser(data.user.id, data.user.email || email);
            
            toast({
              title: "Account created!",
              description: "Welcome to the team! Please check your email to verify your account.",
            });
          } catch (profileError: any) {
            console.error('Invite profile update failed:', profileError);
            toast({
              title: "Account Created",
              description: "Your account was created but there was an issue joining the team. Please contact your team administrator.",
              variant: "destructive",
            });
          }
        } else if (data.user) {
          toast({
            title: "Account created!",
            description: "Your company has been created! Please check your email to verify your account.",
          });
        }
      } else {
        console.log('Starting sign-in process...');
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          console.error('Sign-in error:', error);
          throw error;
        }
        console.log('Sign-in successful');
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <CardTitle className="text-2xl font-bold text-blue-600">
            Bleu Smart Invoice
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
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
          {!inviteCompanyId && (
            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600"
              >
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </Button>
            </div>
          )}
          {inviteCompanyId && (
            <div className="mt-4 text-center">
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
