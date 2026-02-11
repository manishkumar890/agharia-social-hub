import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ContactUsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ContactUsDialog = ({ open, onOpenChange }: ContactUsDialogProps) => {
  const { user, profile } = useAuth();
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!query.trim()) {
      toast.error('Please enter your query');
      return;
    }
    if (query.trim().length > 1000) {
      toast.error('Query must be less than 1000 characters');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('contact_queries').insert({
        user_id: user.id,
        full_name: profile?.full_name || null,
        username: profile?.username || null,
        email: profile?.email || null,
        phone: profile?.phone || null,
        query: query.trim(),
      });

      if (error) throw error;

      toast.success('Query submitted successfully! We will get back to you soon.');
      setQuery('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting query:', error);
      toast.error('Failed to submit query');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Priority Support
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={profile?.full_name || ''} disabled className="opacity-70" />
          </div>

          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={profile?.username ? `@${profile.username}` : ''} disabled className="opacity-70" />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ''} disabled className="opacity-70" />
          </div>

          <div className="space-y-2">
            <Label>Mobile</Label>
            <Input value={profile?.phone || ''} disabled className="opacity-70" />
          </div>

          <div className="space-y-2">
            <Label>Your Query <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Describe your issue or question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{query.length}/1000</p>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={submitting || !query.trim()} 
            className="w-full"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Submit Query</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactUsDialog;
