import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface MessageContextType {
  unreadMessageCount: number;
  refreshMessageCount: () => Promise<void>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadMessageCount(0);
      return;
    }

    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (!conversations || conversations.length === 0) {
        setUnreadMessageCount(0);
        return;
      }

      const convIds = conversations.map(c => c.id);

      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)
        .is('read_at', null);

      setUnreadMessageCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  // Refetch when navigating away from messages (to catch reads)
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [location.pathname, user, fetchUnreadCount]);

  // Real-time: only listen for new incoming messages, always refetch for updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.sender_id !== user.id) {
            // Refetch to get accurate count instead of blindly incrementing
            fetchUnreadCount();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          // Always refetch on any message update (e.g. read_at set)
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  const refreshMessageCount = useCallback(async () => {
    await fetchUnreadCount();
  }, [fetchUnreadCount]);

  return (
    <MessageContext.Provider value={{ unreadMessageCount, refreshMessageCount }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};
