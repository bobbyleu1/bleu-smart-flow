import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string;
}

interface UserProfile {
  company_id: string | null;
  is_demo?: boolean;
}

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated: () => void;
  userProfile: UserProfile | null;
  isDemoMode?: boolean;
}

export const CreateJobDialog = ({ 
  open, 
  onOpenChange, 
  onJobCreated, 
  userProfile, 
  isDemoMode = false 
}: CreateJobDialogProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    client_id: "",
    price: "",
    phone_number: "",
    description: "",
    scheduled_date: new Date().toISOString().split('T')[0],
    is_recurring: false,
    frequency: "weekly",
  });
  const { toast } = useToast();

  const fetchClients = async () => {
    if (!userProfile?.company_id) {
      console.log('No company_id available for fetching clients');
      setClients([]);
      return;
    }

    console.log('Fetching clients for job creation...');
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('company_id', userProfile.company_id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching clients:', error);
        throw error;
      }
      
      console.log('Clients fetched for job creation:', data);
      setClients(data || []);
    } catch (error: any) {
      console.error('Failed to fetch clients:', error);
      toast({
        title: "Error",
        description: "Failed to fetch clients",
        variant: "destructive",
      });
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    if (open && userProfile?.company_id) {
      fetchClients();
    }
    
    if (open) {
      setFormData({
        title: "",
        client_id: "",
        price: "",
        phone_number: "",
        description: "",
        scheduled_date: new Date().toISOString().split('T')[0],
        is_recurring: false,
        frequency: "weekly",
      });
    }
  }, [open, userProfile?.company_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile?.company_id) {
      console.error('No company_id available for job creation');
      toast({
        title: "Error",
        description: "Company ID is required to create jobs. Please check your profile settings.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Job title is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.client_id) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const selectedClient = clients.find(client => client.id === formData.client_id);
    if (!selectedClient) {
      console.error('Selected client not found:', formData.client_id);
      toast({
        title: "Error",
        description: "Selected client not found",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    console.log('Creating job with data:', {
      title: formData.title.trim(),
      client_id: formData.client_id,
      client_name: selectedClient.name,
      price: parseFloat(formData.price),
      phone_number: formData.phone_number.trim() || null,
      company_id: userProfile.company_id,
      description: formData.description.trim() || null,
      scheduled_date: formData.scheduled_date,
      is_recurring: formData.is_recurring,
      frequency: formData.is_recurring ? formData.frequency : null,
      status: isDemoMode ? 'test' : 'pending'
    });

    try {
      const jobData = {
        title: formData.title.trim(),
        job_name: formData.title.trim(),
        client_name: selectedClient.name,
        price: parseFloat(formData.price),
        phone_number: formData.phone_number.trim() || null,
        company_id: userProfile.company_id,
        status: isDemoMode ? 'test' : 'pending' as const,
        description: formData.description.trim() || null,
        scheduled_date: formData.scheduled_date,
        is_recurring: formData.is_recurring,
        frequency: formData.is_recurring ? formData.frequency : null,
        client_id: formData.client_id
      };

      console.log('Inserting job data into database:', jobData);

      const { data, error } = await supabase
        .from('jobs')
        .insert([jobData])
        .select();

      if (error) {
        console.error('Job insertion error details:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Job created successfully:', data);

      toast({
        title: "Success",
        description: isDemoMode 
          ? "Demo job created successfully (no payment link will be generated)" 
          : "Job created successfully",
      });

      setFormData({
        title: "",
        client_id: "",
        price: "",
        phone_number: "",
        description: "",
        scheduled_date: new Date().toISOString().split('T')[0],
        is_recurring: false,
        frequency: "weekly",
      });

      onJobCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Detailed error creating job:', {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        userProfile,
        formData,
        selectedClient
      });
      
      toast({
        title: "Error",
        description: error.message || "Failed to create job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile?.company_id) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Add a new service job for your client
          </DialogDescription>
        </DialogHeader>

        {isDemoMode && (
          <Alert className="border-yellow-300 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Demo Mode: Jobs created will be marked as test jobs and won't generate real payment links.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Weekly Lawn Care"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="client">Client *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              required
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={loadingClients ? "Loading clients..." : "Select a client"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} ({client.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clients.length === 0 && !loadingClients && (
              <p className="text-sm text-gray-500 mt-1">
                No clients found. Please add a client first in the Clients tab.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="price">Price ($) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              placeholder="e.g., +1 (555) 123-4567"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              SMS notifications will be sent to this number when payment links are generated
            </p>
          </div>

          <div>
            <Label htmlFor="scheduled_date">Scheduled Date *</Label>
            <Input
              id="scheduled_date"
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the job details..."
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_recurring"
              checked={formData.is_recurring}
              onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
            />
            <Label htmlFor="is_recurring">Recurring Job</Label>
          </div>

          {formData.is_recurring && (
            <div>
              <Label htmlFor="frequency">Frequency *</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                required
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || clients.length === 0 || !userProfile?.company_id}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
