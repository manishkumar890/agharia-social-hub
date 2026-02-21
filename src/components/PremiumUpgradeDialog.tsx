import { useState } from 'react';
import { Crown, Check, BadgeCheck, Clock, Video, Sparkles, Shield, Star, X, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const premiumBenefits = [
  {
    icon: BadgeCheck,
    title: 'Verified Badge',
    description: 'Verification tick on your profile'
  },
  {
    icon: Clock,
    title: '60s Stories',
    description: 'Double the story duration with 48h visibility'
  },
  {
    icon: Sparkles,
    title: 'AI Access',
    description: 'Chat with AI assistant anytime'
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

const PAYMENT_LINK = 'https://rzp.io/rzp/aghariasamajvip';

const PremiumUpgradeDialog = ({ open, onOpenChange }: PremiumUpgradeDialogProps) => {
  const handlePayment = () => {
    window.open(PAYMENT_LINK, '_blank');
    onOpenChange(false);
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
          <DialogPrimitive.Close className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2">
            <X className="w-5 h-5 text-white" strokeWidth={2.5} />
          </DialogPrimitive.Close>

          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 animate-shimmer-border" />
            
            <div className="relative m-[2px] rounded-[22px] overflow-hidden bg-card">
              {/* Airplane Animation Banner */}
              <div className="relative h-8 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 overflow-hidden">
                <div className="absolute inset-0 bg-[url('/sambalpuri-pattern.jpg')] opacity-20 mix-blend-overlay" />
                <div className="absolute inset-0 flex items-center">
                  <div className="animate-airplane flex items-center gap-1">
                    <Plane className="w-5 h-5 text-primary rotate-0" />
                    <div className="flex gap-0.5">
                      <div className="w-3 h-0.5 bg-primary/60 rounded-full" />
                      <div className="w-2 h-0.5 bg-primary/40 rounded-full" />
                      <div className="w-1.5 h-0.5 bg-primary/20 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-around pointer-events-none opacity-30">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="w-1 h-1 bg-primary rounded-full" />
                  ))}
                </div>
              </div>

              {/* Premium Header */}
              <div className="relative bg-gradient-to-br from-primary via-primary/90 to-amber-700 p-5 sm:p-6 text-primary-foreground">
                <div className="absolute inset-0 bg-[url('/sambalpuri-pattern.jpg')] opacity-10 mix-blend-overlay" />
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
                  
                  <div className="mt-4 flex items-end gap-2 flex-wrap">
                    <span className="text-4xl font-display font-bold drop-shadow-sm">₹199</span>
                    <span className="text-lg line-through opacity-60 mb-1">₹999</span>
                    <span className="bg-gradient-to-r from-yellow-400 to-amber-400 text-primary px-3 py-1 rounded-full text-xs font-bold mb-1 shadow-md">
                      80% OFF
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
                  className="w-full mt-5 h-12 text-base font-bold rounded-xl bg-gradient-to-r from-primary via-primary to-amber-700 hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  size="lg"
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Pay Now - ₹199
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
