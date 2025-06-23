
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus } from "lucide-react";

interface CompanyIdManagerProps {
  userProfile: {
    id: string;
    company_id: string | null;
  } | null;
  onCompanyIdGenerated: () => void;
}

export const CompanyIdManager = ({ userProfile, onCompanyIdGenerated }: CompanyIdManagerProps) => {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generateCompanyId = async () => {
    if (!userProfile) {
      console.error('No user profile available');
      toast({
        title: "Error",
        description: "User profile not available. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Generate Company ID button clicked for user:', userProfile.id);
    setGenerating(true);
    
    try {
      // Generate a UUID for the company
      const companyId = crypto.randomUUID();
      
      console.log('Generated company ID:', companyId);
      
      // Update the user's profile with the company_id
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', userProfile.id);

      if (error) {
        console.error('Error updating company ID:', error);
        throw error;
      }

      console.log('Company ID saved successfully');
      
      toast({
        title: "Success",
        description: "Company ID created successfully!",
      });

      // Refresh the profile data
      onCompanyIdGenerated();
    } catch (error: any) {
      console.error('Failed to generate company ID:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create company ID. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyCompanyId = async () => {
    if (!userProfile?.company_id) return;
    
    try {
      await navigator.clipboard.writeText(userProfile.company_id);
      toast({
        title: "Success",
        description: "Company ID copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy company ID:', error);
      toast({
        title: "Error",
        description: "Failed to copy company ID",
        variant: "destructive",
      });
    }
  };

  // Debug logging
  console.log('CompanyIdManager rendered with userProfile:', userProfile);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Settings</CardTitle>
        <CardDescription>
          Manage your company identification and team access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {userProfile?.company_id ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Company ID</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                  {userProfile.company_id}
                </code>
                <Button size="sm" variant="outline" onClick={copyCompanyId}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              This ID isolates your company's data and allows you to invite teammates.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Generate a unique Company ID to isolate your data and enable team collaboration.
            </p>
            <Button 
              onClick={generateCompanyId}
              disabled={generating || !userProfile}
              className="bg-blue-600 hover:bg-blue-700"
              type="button"
            >
              <Plus className="w-4 h-4 mr-2" />
              {generating ? "Generating..." : "Generate Company ID"}
            </Button>
            {!userProfile && (
              <p className="text-sm text-amber-600">
                Loading profile data...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
