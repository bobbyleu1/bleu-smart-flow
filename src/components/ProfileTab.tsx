
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
}

export const ProfileTab = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async () => {
    console.log('Fetching user profile...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Try to get existing profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        throw profileError;
      }

      // If no profile exists, create one
      if (!profileData) {
        console.log('Creating new profile for user:', user.id);
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              email: user.email,
              company_id: null
            }
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }

        setProfile(newProfile);
      } else {
        setProfile(profileData);
      }

      console.log('Profile loaded successfully');
    } catch (error: any) {
      console.error('Failed to fetch profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
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
    return <div className="flex justify-center p-8">Loading profile...</div>;
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
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-gray-500" />
            <span>{profile?.email}</span>
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
