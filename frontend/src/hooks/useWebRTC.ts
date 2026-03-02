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
  _incomingOffer?: RTCSessionDescriptionInit;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
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

  // Track streams in state so components re-render when they change
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<CallStatus>('idle');

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = callState.status;
  }, [callState.status]);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    // Stop all tracks
    setLocalStream(prev => {
      prev?.getTracks().forEach(t => t.stop());
      return null;
    });
    setRemoteStream(null);

    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setCallState({
      status: 'idle', callType: 'voice', callLogId: null,
      remoteUserId: null, conversationId: null, isMuted: false,
      isCameraOff: false, duration: 0, startedAt: null,
    });
  }, []);

  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = pc;

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        remote.addTrack(track);
      });
      // Force state update to trigger re-render
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate.toJSON(), from: user?.id },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        // Try ICE restart before giving up
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  }, [user]);

  const getMediaStream = useCallback(async (callType: CallType) => {
    const constraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === 'video' ? { width: 1280, height: 720, facingMode: 'user' } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(async (conversationId: string, remoteUserId: string, callType: CallType) => {
    if (!user) return;

    try {
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
      const pc = setupPeerConnection();

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Setup signaling channel FIRST, subscribe, then create offer
      const signalingChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      signalingChannelRef.current = signalingChannel;

      await new Promise<void>((resolve) => {
        signalingChannel
          .on('broadcast', { event: 'answer' }, async ({ payload }) => {
            if (payload.from !== user.id && peerConnectionRef.current) {
              try {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
                const now = new Date();
                setCallState(prev => ({ ...prev, status: 'connected', startedAt: now }));
                await supabase.from('call_logs').update({ status: 'ongoing', started_at: now.toISOString() }).eq('id', callLog.id);
                durationIntervalRef.current = setInterval(() => {
                  setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
                }, 1000);
              } catch (e) {
                console.error('Error setting remote description:', e);
              }
            }
          })
          .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
            if (payload.from !== user.id && payload.candidate && peerConnectionRef.current) {
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) {
                console.error('ICE error', e);
              }
            }
          })
          .on('broadcast', { event: 'call-declined' }, () => {
            supabase.from('call_logs').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', callLog.id);
            cleanup();
          })
          .on('broadcast', { event: 'call-ended' }, () => {
            cleanup();
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') resolve();
          });
      });

      // Create and send offer after channel is ready
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Notify the remote user - wait for subscription before sending
      const notifyChannel = supabase.channel(`incoming-call-${remoteUserId}`);
      await new Promise<void>((resolve) => {
        notifyChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
        });
      });

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

      // Small delay before removing to ensure message is delivered
      setTimeout(() => supabase.removeChannel(notifyChannel), 1000);

      // Auto-end after 60s if no answer - use ref to check status
      timeoutRef.current = setTimeout(() => {
        if (statusRef.current === 'calling') {
          supabase.from('call_logs').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', callLog.id);
          cleanup();
        }
      }, 60000);

    } catch (error) {
      console.error('Failed to start call:', error);
      cleanup();
    }
  }, [user, getMediaStream, setupPeerConnection, cleanup]);

  const answerCall = useCallback(async (callLogId: string, callerId: string, callType: CallType, conversationId: string, offer: RTCSessionDescriptionInit) => {
    if (!user) return;

    try {
      const channelName = `call-${callLogId}`;
      const stream = await getMediaStream(callType);
      const pc = setupPeerConnection();

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const signalingChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      signalingChannelRef.current = signalingChannel;

      await new Promise<void>((resolve) => {
        signalingChannel
          .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
            if (payload.from !== user.id && payload.candidate && peerConnectionRef.current) {
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) {
                console.error('ICE error', e);
              }
            }
          })
          .on('broadcast', { event: 'call-ended' }, () => {
            cleanup();
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') resolve();
          });
      });

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer via signaling channel
      await signalingChannel.send({
        type: 'broadcast',
        event: 'answer',
        payload: { answer: pc.localDescription?.toJSON(), from: user.id },
      });

      const now = new Date();
      setCallState(prev => ({
        ...prev,
        status: 'connected',
        callType,
        callLogId,
        remoteUserId: callerId,
        conversationId,
        startedAt: now,
      }));

      await supabase.from('call_logs').update({ status: 'ongoing', started_at: now.toISOString() }).eq('id', callLogId);

      durationIntervalRef.current = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

    } catch (error) {
      console.error('Failed to answer call:', error);
      cleanup();
    }
  }, [user, getMediaStream, setupPeerConnection, cleanup]);

  const declineCall = useCallback(async (callLogId: string) => {
    const channelName = `call-${callLogId}`;
    const ch = supabase.channel(channelName);
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
    });
    await ch.send({ type: 'broadcast', event: 'call-declined', payload: {} });
    setTimeout(() => supabase.removeChannel(ch), 500);
    await supabase.from('call_logs').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', callLogId);
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
    setLocalStream(stream => {
      stream?.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      return stream;
    });
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const toggleCamera = useCallback(() => {
    setLocalStream(stream => {
      stream?.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      return stream;
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
        if (statusRef.current !== 'idle') return;
        setCallState(prev => ({
          ...prev,
          status: 'ringing',
          callType: payload.callType,
          callLogId: payload.callLogId,
          remoteUserId: payload.callerId,
          conversationId: payload.conversationId,
          _incomingOffer: payload.offer,
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(incomingChannel);
    };
  }, [user]);

  return {
    callState,
    localStream,
    remoteStream,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
};
