import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';

interface CallState {
  status: CallStatus;
  callType: CallType;
  callLogId: string | null;
  remoteUserId: string | null;
  conversationId: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
  duration: number;
  startedAt: Date | null;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export const useWebRTC = () => {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    callType: 'voice',
    callLogId: null,
    remoteUserId: null,
    conversationId: null,
    isMuted: false,
    isCameraOff: false,
    duration: 0,
    startedAt: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    ringtoneRef.current?.pause();
    setCallState({
      status: 'idle', callType: 'voice', callLogId: null,
      remoteUserId: null, conversationId: null, isMuted: false,
      isCameraOff: false, duration: 0, startedAt: null,
    });
  }, []);

  const setupPeerConnection = useCallback((channelName: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const ch = supabase.channel(channelName);
        ch.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate.toJSON(), from: user?.id },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  }, [user]);

  const getMediaStream = useCallback(async (callType: CallType) => {
    const constraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true },
      video: callType === 'video' ? { width: 1280, height: 720, facingMode: 'user' } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  const startCall = useCallback(async (conversationId: string, remoteUserId: string, callType: CallType) => {
    if (!user) return;

    try {
      // Create call log
      const { data: callLog } = await supabase
        .from('call_logs')
        .insert({
          conversation_id: conversationId,
          caller_id: user.id,
          receiver_id: remoteUserId,
          call_type: callType,
          status: 'ringing',
        })
        .select()
        .single();

      if (!callLog) return;

      setCallState(prev => ({
        ...prev,
        status: 'calling',
        callType,
        callLogId: callLog.id,
        remoteUserId,
        conversationId,
      }));

      const channelName = `call-${callLog.id}`;
      const stream = await getMediaStream(callType);
      const pc = setupPeerConnection(channelName);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Setup signaling channel
      const signalingChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      signalingChannel
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.from !== user.id) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            ringtoneRef.current?.pause();
            const now = new Date();
            setCallState(prev => ({ ...prev, status: 'connected', startedAt: now }));
            await supabase.from('call_logs').update({ status: 'ongoing', started_at: now.toISOString() }).eq('id', callLog.id);
            durationIntervalRef.current = setInterval(() => {
              setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
            }, 1000);
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.from !== user.id && payload.candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (e) { console.error('ICE error', e); }
          }
        })
        .on('broadcast', { event: 'call-declined' }, () => {
          supabase.from('call_logs').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', callLog.id);
          cleanup();
        })
        .on('broadcast', { event: 'call-ended' }, () => {
          cleanup();
        })
        .subscribe();

      signalingChannelRef.current = signalingChannel;

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Notify the remote user via a separate broadcast channel
      const notifyChannel = supabase.channel(`incoming-call-${remoteUserId}`);
      await notifyChannel.subscribe();
      await notifyChannel.send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: {
          callLogId: callLog.id,
          callerId: user.id,
          callType,
          conversationId,
          offer: pc.localDescription?.toJSON(),
        },
      });
      supabase.removeChannel(notifyChannel);

      // Auto-end after 60s if no answer
      setTimeout(() => {
        setCallState(prev => {
          if (prev.status === 'calling') {
            supabase.from('call_logs').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', callLog.id);
            cleanup();
          }
          return prev;
        });
      }, 60000);

    } catch (error) {
      console.error('Failed to start call:', error);
      cleanup();
    }
  }, [user, getMediaStream, setupPeerConnection, cleanup]);

  const answerCall = useCallback(async (callLogId: string, callerId: string, callType: CallType, conversationId: string, offer: RTCSessionDescriptionInit) => {
    if (!user) return;

    try {
      setCallState(prev => ({
        ...prev,
        status: 'connected',
        callType,
        callLogId,
        remoteUserId: callerId,
        conversationId,
        startedAt: new Date(),
      }));

      const channelName = `call-${callLogId}`;
      const stream = await getMediaStream(callType);
      const pc = setupPeerConnection(channelName);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const signalingChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      signalingChannel
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.from !== user.id && payload.candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (e) { console.error('ICE error', e); }
          }
        })
        .on('broadcast', { event: 'call-ended' }, () => {
          cleanup();
        })
        .subscribe();

      signalingChannelRef.current = signalingChannel;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      signalingChannel.send({
        type: 'broadcast',
        event: 'answer',
        payload: { answer: pc.localDescription?.toJSON(), from: user.id },
      });

      const now = new Date();
      await supabase.from('call_logs').update({ status: 'ongoing', started_at: now.toISOString() }).eq('id', callLogId);
      
      durationIntervalRef.current = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      ringtoneRef.current?.pause();
    } catch (error) {
      console.error('Failed to answer call:', error);
      cleanup();
    }
  }, [user, getMediaStream, setupPeerConnection, cleanup]);

  const declineCall = useCallback(async (callLogId: string) => {
    const channelName = `call-${callLogId}`;
    const ch = supabase.channel(channelName);
    await ch.subscribe();
    ch.send({ type: 'broadcast', event: 'call-declined', payload: {} });
    supabase.removeChannel(ch);
    await supabase.from('call_logs').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', callLogId);
    ringtoneRef.current?.pause();
    setCallState(prev => ({ ...prev, status: 'idle', callLogId: null, remoteUserId: null }));
  }, []);

  const endCall = useCallback(async () => {
    if (callState.callLogId) {
      const ended = new Date();
      const duration = callState.startedAt
        ? Math.round((ended.getTime() - callState.startedAt.getTime()) / 1000)
        : 0;
      await supabase.from('call_logs').update({
        status: 'ended',
        ended_at: ended.toISOString(),
        duration_seconds: duration,
      }).eq('id', callState.callLogId);

      if (signalingChannelRef.current) {
        signalingChannelRef.current.send({ type: 'broadcast', event: 'call-ended', payload: {} });
      }
    }
    cleanup();
  }, [callState.callLogId, callState.startedAt, cleanup]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setCallState(prev => ({ ...prev, isCameraOff: !prev.isCameraOff }));
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const incomingChannel = supabase.channel(`incoming-call-${user.id}`, {
      config: { broadcast: { self: false } },
    });

    incomingChannel
      .on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
        if (callState.status !== 'idle') return; // Already in a call
        setCallState(prev => ({
          ...prev,
          status: 'ringing',
          callType: payload.callType,
          callLogId: payload.callLogId,
          remoteUserId: payload.callerId,
          conversationId: payload.conversationId,
          _incomingOffer: payload.offer,
        } as any));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(incomingChannel);
    };
  }, [user, callState.status]);

  return {
    callState,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    localVideoRef,
    remoteVideoRef,
    localStreamRef,
    remoteStreamRef,
  };
};
