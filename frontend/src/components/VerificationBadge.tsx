import { useState } from 'react';
import { BadgeCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import PremiumUpgradeDialog from '@/components/PremiumUpgradeDialog';

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
  const [showUpgrade, setShowUpgrade] = useState(false);

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

        <PremiumUpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
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
