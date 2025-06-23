import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CompanyIdManager } from "./CompanyIdManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  company_id: string | null;
  role?: string;
}

export const ProfileTab = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProfile = async () => {
    console.log('Fetching user profile...');
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user found');
        throw new Error('No authenticated user found');
      }

      console.log('Authenticated user found:', user.id);

      // Try to get existing profile with retries for new users
      let profileData = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!profileData && attempts < maxAttempts) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError);
          throw profileError;
        }

        profileData = data;
        
        if (!profileData && attempts < maxAttempts - 1) {
          console.log(`Profile not found, waiting before retry ${attempts + 1}/${maxAttempts}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        attempts++;
      }

      // If still no profile exists after retries, create one as fallback
      if (!profileData) {
        console.log('No profile found after retries, creating fallback profile for user:', user.id);
        const newCompanyId = crypto.randomUUID();
        
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              email: user.email,
              company_id: newCompanyId,
              role: 'invoice_owner'
            }
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating fallback profile:', insertError);
          
          // One more attempt to fetch in case it was created elsewhere
          const { data: finalAttempt } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (finalAttempt) {
            profileData = finalAttempt;
          } else {
            throw insertError;
          }
        } else {
          profileData = newProfile;
          console.log('Fallback profile created with company_id:', newProfile);
          
          toast({
            title: "Profile Setup Complete",
            description: "Your profile and company have been set up successfully!",
          });
        }
      }

      console.log('Profile loaded successfully:', profileData);
      setProfile(profileData);
    } catch (error: any) {
      console.error('Failed to fetch profile:', error);
      setError(error.message || "Failed to load profile data");
      
      toast({
        title: "Profile Loading Issue",
        description: "Could not load profile. Please try again or refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
          <p className="text-gray-600">Manage your account and company settings</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600 mb-4">Could not load profile. Please try again or refresh the page.</p>
            <button 
              onClick={fetchProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
        <p className="text-gray-600">Manage your account and company settings</p>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-gray-500" />
              <span>{profile?.email}</span>
            </div>
            {profile?.role && (
              <div className="text-sm text-gray-600">
                Role: {profile.role === 'invoice_owner' ? 'Company Owner' : 'Team Member'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company ID Manager */}
      <CompanyIdManager 
        userProfile={profile}
        onCompanyIdGenerated={fetchProfile}
      />
    </div>
  );
};
