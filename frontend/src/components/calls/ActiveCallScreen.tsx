import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { CallType } from '@/hooks/useWebRTC';

interface ActiveCallScreenProps {
  remoteUserName: string;
  remoteUserAvatar?: string | null;
  callType: CallType;
  status: 'calling' | 'connected';
  isMuted: boolean;
  isCameraOff: boolean;
  duration: number;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const ActiveCallScreen = ({
  remoteUserName, remoteUserAvatar, callType, status,
  isMuted, isCameraOff, duration, onEndCall, onToggleMute,
  onToggleCamera, localStream, remoteStream,
}: ActiveCallScreenProps) => {

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex-1 relative flex items-center justify-center">
        {callType === 'video' && status === 'connected' ? (
          <>
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg">
              <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-32 h-32 border-4 border-white/20">
              <AvatarImage src={remoteUserAvatar || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                {remoteUserName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <p className="text-white text-xl font-semibold">{remoteUserName}</p>
            <p className="text-white/60 text-sm">
              {status === 'calling' ? 'Calling...' : formatDuration(duration)}
            </p>
            {status === 'connected' && callType === 'voice' && (
              <div className="flex gap-1 mt-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-6 bg-green-400 rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {status === 'connected' && callType === 'video' && (
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur rounded-full px-4 py-2">
          <p className="text-white text-sm font-medium">{formatDuration(duration)}</p>
        </div>
      )}

      <div className="bg-black/50 backdrop-blur-lg p-6 pb-10 flex justify-center gap-6">
        <Button
          onClick={onToggleMute}
          variant="ghost"
          size="icon"
          className={`w-14 h-14 rounded-full ${isMuted ? 'bg-red-500/80 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        {callType === 'video' && (
          <Button
            onClick={onToggleCamera}
            variant="ghost"
            size="icon"
            className={`w-14 h-14 rounded-full ${isCameraOff ? 'bg-red-500/80 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
          >
            {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </Button>
        )}

        <Button
          onClick={onEndCall}
          variant="destructive"
          size="icon"
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default ActiveCallScreen;
