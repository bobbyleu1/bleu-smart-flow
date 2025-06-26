import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CompanyIdManager } from "./CompanyIdManager";
import { User, Building, Zap, Info } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  company_id: string | null;
  role: string;
  is_demo?: boolean;
  stripe_connected?: boolean;
  created_at: string;
}

export const ProfileTab = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Smart Invoice - Account";
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Only select columns that exist in the profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, company_id, role, created_at')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      // Set default values for missing columns
      const profileWithDefaults = {
        ...data,
        is_demo: user.email === "demo@smartinvoice.com",
        stripe_connected: false
      };

      setProfile(profileWithDefaults);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDemoMode = profile?.is_demo || profile?.email === "demo@smartinvoice.com";

  if (loading) {
    return <div className="flex justify-center p-8">Loading profile...</div>;
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Account</h2>
          <p className="text-gray-600">Manage your account settings</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">Unable to load profile information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account</h2>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Your account details and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Email</Label>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-sm text-gray-900">{profile.email}</span>
                {isDemoMode && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Demo
                  </Badge>
                )}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700">Role</Label>
              <div className="mt-1">
                <Badge variant="outline" className="capitalize">
                  {profile.role.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">Member Since</Label>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-blue-600" />
              <CardTitle>Company Settings</CardTitle>
            </div>
            <CardDescription>Manage your company configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyIdManager 
              userProfile={profile} 
              onCompanyIdGenerated={fetchProfile}
            />
          </CardContent>
        </Card>

        {/* Stripe Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <CardTitle>Payment Integration</CardTitle>
            </div>
            <CardDescription>Connect Stripe to receive payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDemoMode ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  💡 <strong>Demo Mode:</strong> Stripe integration is disabled in demo accounts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stripe Status</span>
                  <Badge 
                    variant={profile.stripe_connected ? "default" : "destructive"}
                    className={profile.stripe_connected ? "bg-green-100 text-green-800" : ""}
                  >
                    {profile.stripe_connected ? "Connected" : "Not Connected"}
                  </Badge>
                </div>
                
                {!profile.stripe_connected && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800 mb-2">
                      ⚠️ Connect your Stripe account to start receiving payments from clients.
                    </p>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      Connect Stripe
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-600" />
              <CardTitle>App Information</CardTitle>
            </div>
            <CardDescription>Version and system details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Version</Label>
              <p className="text-sm text-gray-600 mt-1">v1.0 Beta</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700">Build</Label>
              <p className="text-sm text-gray-600 mt-1">
                Smart Invoice {new Date().getFullYear()}
              </p>
            </div>

            <Separator />
            
            <div className="text-xs text-gray-500">
              <p>© {new Date().getFullYear()} Smart Invoice. All rights reserved.</p>
              <p className="mt-1">Built with React, Supabase, and Stripe.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
