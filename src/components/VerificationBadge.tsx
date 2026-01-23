import { useState } from 'react';
import { BadgeCheck, ShieldAlert, Crown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';

interface VerificationBadgeProps {
  isPremium: boolean;
  isOwnProfile?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const VerificationBadge = ({ 
  isPremium, 
  isOwnProfile = false,
  size = 'md', 
  className 
}: VerificationBadgeProps) => {
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    setIsProcessing(true);

    try {
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount: 299, currency: 'INR' }
      });

      if (orderError || !orderData?.order) {
        throw new Error('Failed to create order');
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'Agharia Samaj',
        description: 'Premium Lifetime Subscription',
        order_id: orderData.order.id,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
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

            if (verifyError) {
              throw verifyError;
            }

            toast.success('🎉 Welcome to Premium! You are now verified.');
            await refreshSubscription();
            setShowUpgrade(false);
          } catch (err) {
            console.error('Verification error:', err);
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: '',
          contact: ''
        },
        theme: {
          color: '#7c1d1d'
        }
      };

      const RazorpayConstructor = (window as any).Razorpay;
      const razorpay = new RazorpayConstructor(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPremium) {
    return (
      <BadgeCheck
        className={cn(
          sizeClasses[size],
          'text-primary fill-primary/20 inline-block flex-shrink-0',
          className
        )}
      />
    );
  }

  // For free users - show not verified badge
  if (isOwnProfile) {
    return (
      <>
        <button
          onClick={() => setShowUpgrade(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors"
        >
          <ShieldAlert className={cn(sizeClasses.sm, 'text-muted-foreground')} />
          <span>Not Verified</span>
        </button>

        <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Get Verified
              </DialogTitle>
              <DialogDescription>
                Upgrade to Premium to get verified and unlock exclusive features
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display font-bold text-lg">Premium Lifetime</h3>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold text-primary">₹299</p>
                    <p className="text-xs text-muted-foreground line-through">₹999</p>
                  </div>
                </div>

                <ul className="space-y-2 mb-4">
                  {[
                    'Verified badge on your profile',
                    'Extended story duration (60s)',
                    'Stories visible for 48 hours',
                    'Upload videos up to 100MB',
                    'Priority support'
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full gradient-maroon text-primary-foreground"
                  onClick={handlePayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      Get Verified Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // For viewing other users - just show not verified text
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
      <ShieldAlert className={cn(sizeClasses.sm, 'text-muted-foreground')} />
      <span>Not Verified</span>
    </span>
  );
};

export default VerificationBadge;
