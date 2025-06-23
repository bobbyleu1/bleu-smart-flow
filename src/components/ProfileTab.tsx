
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

      // Get existing profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        
        if (profileError.code === 'PGRST116') {
          // Profile doesn't exist, this shouldn't happen with the new trigger
          // but we'll handle it as a fallback
          console.log('Profile not found, this indicates the trigger may not be working');
          setError('Profile not found. Please contact support.');
          return;
        }
        
        throw profileError;
      }

      console.log('Profile loaded successfully:', profileData);
      setProfile(profileData);
    } catch (error: any) {
      console.error('Failed to fetch profile:', error);
      setError(error.message || "Failed to load profile data");
      
      toast({
        title: "Profile Loading Issue",
        description: "Could not load profile. Please try refreshing the page.",
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
            <p className="text-red-600 mb-4">{error}</p>
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

      {/* Company ID Manager - only show Generate button for legacy users without company_id */}
      <CompanyIdManager 
        userProfile={profile}
        onCompanyIdGenerated={fetchProfile}
      />
    </div>
  );
};
