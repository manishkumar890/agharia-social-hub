import { useState } from 'react';
import { Crown, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    contact: string;
  };
  theme: {
    color: string;
  };
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const PremiumUpgrade = () => {
  const { user, profile } = useAuth();
  const { isPremium, refreshSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!user) {
      toast.error('Please login to continue');
      return;
    }

    setIsLoading(true);

    try {
      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Failed to load payment gateway');
        return;
      }

      // Create order via edge function
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount: 29900 } // Amount in paise (₹299)
      });

      if (error) throw error;

      const options: RazorpayOptions = {
        key: data.key_id,
        amount: 29900,
        currency: 'INR',
        name: 'Agharia Samaj',
        description: 'Premium Lifetime Subscription',
        order_id: data.order_id,
        handler: async (response: RazorpayResponse) => {
          try {
            // Verify payment via edge function
            const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                signature: response.razorpay_signature
              }
            });

            if (verifyError) throw verifyError;

            toast.success('Payment successful! Welcome to Premium!');
            await refreshSubscription();
            setIsOpen(false);
          } catch (err) {
            console.error('Payment verification failed:', err);
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: profile?.full_name || '',
          contact: profile?.phone || ''
        },
        theme: {
          color: '#D97706'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment');
    } finally {
      setIsLoading(false);
    }
  };

  if (isPremium) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
        <Crown className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">Premium Member</span>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Crown className="w-4 h-4" />
          Get Premium
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription>
            Unlock premium features with a one-time payment
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-foreground">₹299</div>
            <div className="text-sm text-muted-foreground">Lifetime Access</div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-sm">60 second story duration (vs 30s)</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-sm">48 hour story visibility (vs 24h)</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-sm">Premium badge on profile</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-sm">Lifetime access - pay once!</span>
            </div>
          </div>
        </div>

        <Button 
          onClick={handlePayment} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Crown className="w-4 h-4 mr-2" />
              Pay ₹299 Now
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PremiumUpgrade;
