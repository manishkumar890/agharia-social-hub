import { useState, useRef } from 'react';
import { BadgeCheck, Crown, Hash, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

interface VIPCardProps {
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  registerNo?: string | null;
  isOwner?: boolean;
}

const VIPCard = ({ fullName, username, avatarUrl, registerNo, isOwner = false }: VIPCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `${username || 'vip'}-card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Card downloaded!');
    } catch (error) {
      toast.error('Failed to download card');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Card Container with 3D perspective */}
      <div 
        className="perspective-1000 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div 
          className={cn(
            "relative w-[300px] h-[180px] sm:w-[320px] sm:h-[190px] transition-all duration-700 transform-style-3d",
            isFlipped && "rotate-y-180"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front of Card */}
          <div 
            ref={cardRef}
            className="absolute inset-0 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl animate-shimmer-border">
              {/* Premium gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-yellow-700 to-amber-950" />
              
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
              
              {/* Pattern overlay */}
              <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI2ZmZiIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNhKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')]" />
              
              {/* Content */}
              <div className="relative z-10 p-4 h-full flex flex-col justify-between text-white">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-300 animate-pulse" />
                    <span className="font-display font-bold text-sm sm:text-base tracking-wide">
                      AGHARIA SAMAJ
                    </span>
                  </div>
                  <div className="px-1.5 py-0.5 bg-yellow-500/30 rounded text-[10px] sm:text-xs font-semibold backdrop-blur-sm border border-yellow-400/30">
                    VIP MEMBER
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full animate-pulse opacity-75" />
                    <Avatar className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-yellow-400 relative">
                      <AvatarImage src={avatarUrl || ''} alt={fullName} />
                      <AvatarFallback className="bg-gradient-to-br from-amber-700 to-amber-900 text-white font-bold text-lg">
                        {fullName?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display font-bold text-base sm:text-lg truncate max-w-[150px] sm:max-w-[170px]">
                        {fullName || 'Member'}
                      </h3>
                      <BadgeCheck className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                    </div>
                    <p className="text-yellow-200/80 text-xs sm:text-sm">@{username || 'user'}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end text-[10px] sm:text-xs text-yellow-200/70">
                  <div className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    <span>{registerNo || 'AS00000'}</span>
                  </div>
                </div>
              </div>
              
              {/* Holographic effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-yellow-300/5 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Back of Card */}
          <div 
            className="absolute inset-0"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-amber-900 to-yellow-900" />
              
              {/* Content */}
              <div className="relative z-10 p-3 sm:p-4 h-full flex flex-col justify-center text-white">
                <h4 className="text-[10px] sm:text-xs font-bold text-yellow-300 tracking-wider text-center mb-1.5 uppercase">Premium Benefits</h4>
                <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                  <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <BadgeCheck className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[9px] text-yellow-200 leading-tight">Verified Badge</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <BadgeCheck className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[9px] text-yellow-200 leading-tight">60s Stories</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <BadgeCheck className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[9px] text-yellow-200 leading-tight">48h Visibility</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <BadgeCheck className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[9px] text-yellow-200 leading-tight">100 MB Uploads</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <BadgeCheck className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[9px] text-yellow-200 leading-tight">Priority Support</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[9px] text-yellow-200 leading-tight">AI Assistant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {isOwner && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDownload}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Tap card to flip
      </p>
    </div>
  );
};

export default VIPCard;
