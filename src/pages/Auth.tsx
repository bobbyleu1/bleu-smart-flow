
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: inviteCompanyId ? 'teammate' : 'invoice_owner',
              company_id: inviteCompanyId || null
            }
          }
        });

        if (error) throw error;

        // If successful sign-up and not an invite, generate company_id
        if (data.user && !inviteCompanyId) {
          console.log('Creating profile with new company_id for user:', data.user.id);
          
          const newCompanyId = crypto.randomUUID();
          
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                email: data.user.email,
                company_id: newCompanyId
              }
            ]);

          if (profileError) {
            console.error('Error creating profile with company_id:', profileError);
          } else {
            console.log('Profile created with company_id:', newCompanyId);
          }
        } else if (data.user && inviteCompanyId) {
          // For invite links, create profile with existing company_id
          console.log('Creating profile with invite company_id for user:', data.user.id);
          
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                email: data.user.email,
                company_id: inviteCompanyId
              }
            ]);

          if (profileError) {
            console.error('Error creating profile with invite company_id:', profileError);
          } else {
            console.log('Profile created with invite company_id:', inviteCompanyId);
          }
        }

        toast({
          title: "Account created!",
          description: inviteCompanyId 
            ? "Welcome to the team! Please check your email to verify your account."
            : "Your company has been created! Please check your email to verify your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
