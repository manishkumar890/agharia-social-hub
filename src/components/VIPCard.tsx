import { useState, useRef } from 'react';
import { BadgeCheck, Crown, Hash, Download, Sparkles, Clock, Eye, Upload, Headset, Calendar } from 'lucide-react';
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
  dob?: string | null;
  isOwner?: boolean;
  onClose?: () => void;
}

const VIPCard = ({ fullName, username, avatarUrl, registerNo, dob, isOwner = false, onClose }: VIPCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      // Temporarily remove animations and ensure proper rendering
      const card = cardRef.current;
      const originalStyle = card.style.cssText;
      card.style.transform = 'none';
      card.style.backfaceVisibility = 'visible';
      
      // Force all animated elements to be static
      const animatedElements = card.querySelectorAll('[class*="animate"]');
      const originalClasses: string[] = [];
      animatedElements.forEach((el, i) => {
        originalClasses[i] = el.className;
        (el as HTMLElement).style.animation = 'none';
      });

      const canvas = await html2canvas(card, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: card.offsetWidth,
        height: card.offsetHeight,
      });
      
      // Restore original styles
      card.style.cssText = originalStyle;
      animatedElements.forEach((el, i) => {
        (el as HTMLElement).style.animation = '';
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
      {/* Tap instruction above card */}
      <p className="text-xs text-foreground/80 bg-muted/80 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-border/50">
        Tap card to flip
      </p>

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
            className="absolute inset-0 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div ref={cardRef} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              {/* Premium gradient background */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, #78350f, #a16207, #451a03)' }} />
              
              {/* Animated shine effect */}
              <div className="animate-shine" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent)' }} />
              
              {/* Pattern overlay */}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI2ZmZiIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNhKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')" }} />
              
              {/* Content */}
              <div style={{ position: 'relative', zIndex: 10, padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'white', boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Crown className="animate-pulse" style={{ width: '20px', height: '20px', flexShrink: 0, color: '#fde047' }} />
                    <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em', lineHeight: '20px' }}>
                      AGHARIA SAMAJ
                    </span>
                  </div>
                  <div style={{ padding: '2px 8px', backgroundColor: 'rgba(234,179,8,0.3)', borderRadius: '4px', fontSize: '10px', fontWeight: 600, border: '1px solid rgba(250,204,21,0.3)', lineHeight: '16px', whiteSpace: 'nowrap' }}>
                    VIP MEMBER
                  </div>
                </div>

                {/* Main Content */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', flexShrink: 0, width: '68px', height: '68px' }}>
                    <div style={{ position: 'absolute', inset: '-4px', background: 'linear-gradient(to right, #facc15, #f59e0b)', borderRadius: '9999px', opacity: 0.75 }} />
                    <img 
                      src={avatarUrl || ''} 
                      alt={fullName} 
                      crossOrigin="anonymous"
                      style={{ width: '64px', height: '64px', borderRadius: '9999px', border: '2px solid #facc15', objectFit: 'cover', position: 'relative', display: 'block', backgroundColor: '#78350f' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '16px', lineHeight: '22px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px', display: 'block' }}>
                        {fullName || 'Member'}
                      </span>
                      <BadgeCheck style={{ width: '16px', height: '16px', flexShrink: 0, color: '#fde047' }} />
                    </div>
                    <span style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(254,240,138,0.8)', display: 'block' }}>@{username || 'user'}</span>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(254,240,138,0.7)', lineHeight: '16px' }}>
                  {dob && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                      <span>{new Date(dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                    <Hash style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                    <span>{registerNo || 'AS00000'}</span>
                  </div>
                </div>
              </div>
              
              {/* Holographic effect */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, transparent, rgba(253,224,71,0.05), transparent)', pointerEvents: 'none' }} />
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
              <div className="relative z-10 p-2.5 sm:p-3 h-full flex flex-col justify-center text-white">
                <h4 className="text-[10px] sm:text-xs font-bold text-yellow-300 tracking-wider text-center mb-1.5 uppercase">Premium Benefits</h4>
                <div className="grid grid-cols-2 gap-1 sm:gap-1.5 flex-1">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <BadgeCheck className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[10px] text-yellow-200 leading-tight">Verified Badge</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[10px] text-yellow-200 leading-tight">60s Stories</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <Eye className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[10px] text-yellow-200 leading-tight">48h Visibility</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <Upload className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[10px] text-yellow-200 leading-tight">100 MB Uploads</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <Headset className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[10px] text-yellow-200 leading-tight">Priority Support</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                    <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-[8px] sm:text-[10px] text-yellow-200 leading-tight">AI Assistant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {isOwner && (
        <div className="flex flex-col items-center gap-2">
          {!dob && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-md border border-amber-200 dark:border-amber-800 text-center">
              Please add your Date of Birth in Edit Profile to download the card.
            </p>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (!dob) {
                toast.error('Please add your Date of Birth in Edit Profile first.');
                return;
              }
              handleDownload();
            }}
            disabled={!dob}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          {onClose && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="bg-red-600 hover:bg-red-700 text-white hover:text-white"
            >
              Close
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default VIPCard;
