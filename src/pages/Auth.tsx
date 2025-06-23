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

  const createUserProfile = async (userId: string, userEmail: string) => {
    console.log('Creating profile for user:', userId);
    
    const newCompanyId = inviteCompanyId || crypto.randomUUID();
    const userRole = inviteCompanyId ? 'teammate' : 'invoice_owner';
    
    console.log('Profile data:', { userId, userEmail, newCompanyId, userRole });

    // Wait a moment to ensure the user is fully authenticated
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          email: userEmail,
          company_id: newCompanyId,
          role: userRole
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Profile creation error:', error);
      
      // If it's a duplicate error, try to fetch existing profile
      if (error.code === '23505') {
        console.log('Profile already exists, fetching existing profile...');
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (fetchError) {
          throw new Error('Failed to create or fetch user profile');
        }
        
        return existingProfile;
      }
      
      throw error;
    }

    console.log('Profile created successfully:', data);
    return data;
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

        // Create profile if user was created successfully
        if (data.user && !data.user.email_confirmed_at) {
          try {
            await createUserProfile(data.user.id, data.user.email || email);
            
            toast({
              title: "Account created!",
              description: inviteCompanyId 
                ? "Welcome to the team! Please check your email to verify your account."
                : "Your company has been created! Please check your email to verify your account.",
            });
          } catch (profileError: any) {
            console.error('Profile creation failed:', profileError);
            toast({
              title: "Account Created",
              description: "Your account was created but profile setup encountered an issue. Please refresh after email verification.",
              variant: "destructive",
            });
          }
        } else if (data.user && data.user.email_confirmed_at) {
          // User is already confirmed, they might be signing in
          toast({
            title: "Welcome!",
            description: "You're now signed in.",
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
