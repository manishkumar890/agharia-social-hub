import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWebRTC, CallStatus, CallType } from '@/hooks/useWebRTC';
import { supabase } from '@/integrations/supabase/client';
import IncomingCallDialog from './IncomingCallDialog';
import ActiveCallScreen from './ActiveCallScreen';

interface CallerInfo {
  name: string;
  avatar: string | null;
}

interface CallContextType {
  startCall: (conversationId: string, remoteUserId: string, callType: CallType) => Promise<void>;
  callStatus: CallStatus;
}

const CallContext = createContext<CallContextType>({
  startCall: async () => {},
  callStatus: 'idle',
});

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const {
    callState, startCall, answerCall, declineCall, endCall,
    toggleMute, toggleCamera, localVideoRef, remoteVideoRef,
    localStreamRef, remoteStreamRef,
  } = useWebRTC();

  const [callerInfo, setCallerInfo] = useState<CallerInfo>({ name: 'User', avatar: null });
  const [remoteInfo, setRemoteInfo] = useState<CallerInfo>({ name: 'User', avatar: null });

  // Fetch caller info when receiving a call
  useEffect(() => {
    if (callState.status === 'ringing' && callState.remoteUserId) {
      supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('user_id', callState.remoteUserId)
        .single()
        .then(({ data }) => {
          if (data) {
            setCallerInfo({ name: data.full_name || data.username || 'User', avatar: data.avatar_url });
          }
        });
    }
    if ((callState.status === 'calling' || callState.status === 'connected') && callState.remoteUserId) {
      supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('user_id', callState.remoteUserId)
        .single()
        .then(({ data }) => {
          if (data) {
            setRemoteInfo({ name: data.full_name || data.username || 'User', avatar: data.avatar_url });
          }
        });
    }
  }, [callState.status, callState.remoteUserId]);

  const handleAnswer = () => {
    const state = callState as any;
    if (state._incomingOffer && callState.callLogId && callState.remoteUserId && callState.conversationId) {
      answerCall(callState.callLogId, callState.remoteUserId, callState.callType, callState.conversationId, state._incomingOffer);
    }
  };

  const handleDecline = () => {
    if (callState.callLogId) {
      declineCall(callState.callLogId);
    }
  };

  return (
    <CallContext.Provider value={{ startCall, callStatus: callState.status }}>
      {children}

      {/* Incoming call dialog */}
      {callState.status === 'ringing' && (
        <IncomingCallDialog
          callerName={callerInfo.name}
          callerAvatar={callerInfo.avatar}
          callType={callState.callType}
          onAnswer={handleAnswer}
          onDecline={handleDecline}
        />
      )}

      {/* Active call screen */}
      {(callState.status === 'calling' || callState.status === 'connected') && (
        <ActiveCallScreen
          remoteUserName={remoteInfo.name}
          remoteUserAvatar={remoteInfo.avatar}
          callType={callState.callType}
          status={callState.status}
          isMuted={callState.isMuted}
          isCameraOff={callState.isCameraOff}
          duration={callState.duration}
          onEndCall={endCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localStreamRef.current}
          remoteStream={remoteStreamRef.current}
        />
      )}
    </CallContext.Provider>
  );
};
