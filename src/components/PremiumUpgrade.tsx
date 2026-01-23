import { useState } from 'react';
import { Crown } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import PremiumUpgradeDialog from '@/components/PremiumUpgradeDialog';

const PremiumUpgrade = () => {
  const { isPremium } = useSubscription();
  const [isOpen, setIsOpen] = useState(false);

  if (isPremium) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
        <Crown className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">Premium Member</span>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Crown className="w-4 h-4" />
        Get Premium
      </Button>
      <PremiumUpgradeDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
};

export default PremiumUpgrade;
