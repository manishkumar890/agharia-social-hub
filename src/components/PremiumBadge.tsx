import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const PremiumBadge = ({ className, size = 'md' }: PremiumBadgeProps) => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <BadgeCheck 
      className={cn(
        sizeClasses[size],
        'text-primary fill-primary/20 inline-block flex-shrink-0',
        className
      )} 
    />
  );
};

export default PremiumBadge;
