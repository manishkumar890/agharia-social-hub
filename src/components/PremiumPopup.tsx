import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import PremiumUpgradeDialog from '@/components/PremiumUpgradeDialog';

const PremiumPopup = () => {
  const { user } = useAuth();
  const { isPremium, loading } = useSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const hasShownRef = useRef(false);

  // Play notification sound when popup opens
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      // Ignore audio errors
    }
  };

  useEffect(() => {
    // Show popup for non-premium users after app loads
    if (!loading && user && !isPremium && !hasShownRef.current) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        hasShownRef.current = true;
        playNotificationSound();
      }, 10000); // 10 seconds delay

      return () => clearTimeout(timer);
    }
  }, [loading, user, isPremium]);

  // Don't render anything if premium or still loading
  if (loading || isPremium || !user) {
    return null;
  }

  return <PremiumUpgradeDialog open={isOpen} onOpenChange={setIsOpen} />;
};

export default PremiumPopup;
