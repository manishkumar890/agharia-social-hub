import { useState, useEffect } from 'react';
import { Crown, Check, Loader2, BadgeCheck, Clock, Video, Sparkles, Shield, Star, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
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
  modal?: {
    confirm_close?: boolean;
    escape?: boolean;
    backdropclose?: boolean;
  };
  readonly?: {
    contact?: boolean;
    email?: boolean;
    name?: boolean;
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
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Preload Razorpay script when dialog opens
  useEffect(() => {
    if (open && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);
      script.onerror = () => setIsScriptLoaded(false);
      document.body.appendChild(script);
    } else if (window.Razorpay) {
      setIsScriptLoaded(true);
    }
  }, [open]);

  const handlePayment = async () => {
    if (!user) {
      toast.error('Please login to continue');
      return;
    }

    if (!isScriptLoaded && !window.Razorpay) {
      toast.error('Payment gateway is loading, please try again');
      return;
    }

    setIsLoading(true);

    try {
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
        },
        modal: {
          confirm_close: true,
          escape: false,
          backdropclose: false
        },
        readonly: {
          contact: true,
          name: true
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[calc(100%-24px)] max-w-md translate-x-[-50%] translate-y-[-50%] duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
        >
          {/* Custom Close Button - Big with red background, inside the card */}
          <DialogPrimitive.Close className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2">
            <X className="w-5 h-5 text-white" strokeWidth={2.5} />
          </DialogPrimitive.Close>

          {/* Animated border wrapper */}
          <div className="relative rounded-3xl overflow-hidden">
            {/* Animated gradient border */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 animate-shimmer-border" />
            
            {/* Inner content with gap for border visibility */}
            <div className="relative m-[2px] rounded-[22px] overflow-hidden bg-card">
              {/* Premium Header with gradient */}
              <div className="relative bg-gradient-to-br from-primary via-primary/90 to-amber-700 p-5 sm:p-6 text-primary-foreground">
                <div className="absolute inset-0 bg-[url('/sambalpuri-pattern.jpg')] opacity-10 mix-blend-overlay" />
                
                {/* Sparkle effects */}
                <div className="absolute top-2 right-4 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
                <div className="absolute top-8 right-8 w-1.5 h-1.5 bg-amber-200 rounded-full animate-pulse delay-300" />
                <div className="absolute bottom-4 left-6 w-1 h-1 bg-yellow-200 rounded-full animate-pulse delay-500" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl shadow-lg">
                      <Crown className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold tracking-tight">Get Premium</h2>
                      <p className="text-sm opacity-90">Agharia Samaj VIP Member</p>
                    </div>
                  </div>
                  
                  {/* Price badge */}
                  <div className="mt-4 flex items-end gap-2 flex-wrap">
                    <span className="text-4xl font-display font-bold drop-shadow-sm">₹299</span>
                    <span className="text-lg line-through opacity-60 mb-1">₹999</span>
                    <span className="bg-gradient-to-r from-yellow-400 to-amber-400 text-primary px-3 py-1 rounded-full text-xs font-bold mb-1 shadow-md">
                      70% OFF
                    </span>
                  </div>
                  <p className="text-sm opacity-80 mt-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    One-time payment • Lifetime access
                  </p>
                </div>
              </div>

              {/* Benefits Grid */}
              <div className="p-4 sm:p-5 bg-card">
                <h3 className="font-display font-semibold text-foreground mb-3 text-sm">Premium Benefits</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {premiumBenefits.map((benefit) => (
                    <div 
                      key={benefit.title}
                      className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 hover:from-primary/5 hover:to-primary/10 transition-all duration-300 border border-border/50"
                    >
                      <div className="p-1.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex-shrink-0">
                        <benefit.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm text-foreground truncate">{benefit.title}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Button 
                  onClick={handlePayment} 
                  disabled={isLoading}
                  className="w-full mt-5 h-12 text-base font-bold rounded-xl bg-gradient-to-r from-primary via-primary to-amber-700 hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
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
                <div className="flex items-center justify-center gap-4 mt-4 text-[10px] sm:text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-green-600" />
                    </div>
                    <span>Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-green-600" />
                    </div>
                    <span>Instant Activation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default PremiumUpgradeDialog;
