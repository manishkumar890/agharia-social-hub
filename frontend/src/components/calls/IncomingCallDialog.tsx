import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { CallType } from '@/hooks/useWebRTC';

interface IncomingCallDialogProps {
  callerName: string;
  callerAvatar?: string | null;
  callType: CallType;
  onAnswer: () => void;
  onDecline: () => void;
}

const IncomingCallDialog = ({ callerName, callerAvatar, callType, onAnswer, onDecline }: IncomingCallDialogProps) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center animate-in fade-in">
      <div className="bg-card rounded-3xl p-8 flex flex-col items-center gap-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Avatar className="w-24 h-24 border-4 border-primary">
            <AvatarImage src={callerAvatar || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {callerName?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{callerName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Incoming {callType === 'video' ? 'Video' : 'Voice'} Call...
          </p>
        </div>

        <div className="flex gap-8">
          <Button
            onClick={onDecline}
            variant="destructive"
            size="icon"
            className="w-16 h-16 rounded-full"
          >
            <PhoneOff className="w-7 h-7" />
          </Button>
          <Button
            onClick={onAnswer}
            size="icon"
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white"
          >
            {callType === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallDialog;
