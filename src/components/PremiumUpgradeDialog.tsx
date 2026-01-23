import { useState } from 'react';
import { Crown, Check, Loader2, BadgeCheck, Clock, Video, Sparkles, Shield, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const premiumBenefits = [
  {
    icon: BadgeCheck,
    title: 'Verified Badge',
    description: 'Gold verification tick on your profile'
  },
  {
    icon: Clock,
    title: '60s Stories',
    description: 'Double the story duration (vs 30s)'
  },
  {
    icon: Sparkles,
    title: '48h Visibility',
    description: 'Stories visible for 2 days (vs 24h)'
  },
  {
    icon: Video,
    title: '100MB Uploads',
    description: 'Upload larger videos and media'
  },
  {
    icon: Shield,
    title: 'VIP Card',
    description: 'Digital Agharia Samaj membership card'
  },
  {
    icon: Star,
    title: 'Priority Support',
    description: 'Get help faster from our team'
  }
];

const PremiumUpgradeDialog = ({ open, onOpenChange }: PremiumUpgradeDialogProps) => {
  const { user, profile } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);

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
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Failed to load payment gateway');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount: 29900 }
      });

      if (error || !data?.order_id) {
        console.error('Order creation error:', error, data);
        throw new Error('Failed to create order');
      }

      const options: RazorpayOptions = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Agharia Samaj',
        description: 'Premium Lifetime Subscription',
        order_id: data.order_id,
        handler: async (response: RazorpayResponse) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                user_id: user.id,
                amount: 299
              }
            });

            if (verifyError) throw verifyError;

            toast.success('🎉 Welcome to Premium! You are now verified.');
            await refreshSubscription();
            onOpenChange(false);
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
          color: '#7c1d1d'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0">
        {/* Premium Header with gradient */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground">
          <div className="absolute inset-0 bg-[url('/sambalpuri-pattern.jpg')] opacity-10 mix-blend-overlay" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Get Premium</h2>
                <p className="text-sm opacity-90">Agharia Samaj VIP Member</p>
              </div>
            </div>
            
            {/* Price badge */}
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-display font-bold">₹299</span>
              <span className="text-lg line-through opacity-60 mb-1">₹999</span>
              <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium mb-1">
                70% OFF
              </span>
            </div>
            <p className="text-sm opacity-80 mt-1">One-time payment • Lifetime access</p>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Premium Benefits</h3>
          <div className="grid grid-cols-2 gap-3">
            {premiumBenefits.map((benefit) => (
              <div 
                key={benefit.title}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <benefit.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <Button 
            onClick={handlePayment} 
            disabled={isLoading}
            className="w-full mt-6 h-12 text-base font-semibold gradient-maroon hover:opacity-90 transition-opacity"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Crown className="w-5 h-5 mr-2" />
                Get Verified Now - ₹299
              </>
            )}
          </Button>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Secure Payment</span>
            </div>
            <div className="flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Instant Activation</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PremiumUpgradeDialog;
