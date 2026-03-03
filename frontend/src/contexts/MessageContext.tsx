import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { messagesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface MessageContextType {
  unreadMessageCount: number;
  refreshMessageCount: () => void;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadMessageCount(0);
      return;
    }

    try {
      const conversations = await messagesApi.getConversations();
      
      // Sum up unread counts from all conversations
      const totalUnread = conversations.reduce((sum: number, conv: any) => {
        return sum + (conv.unread_count || 0);
      }, 0);

      setUnreadMessageCount(totalUnread);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
    }
  }, [user]);

  // Debounced fetch to avoid rapid re-fetches
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchUnreadCount();
    }, 500);
  }, [fetchUnreadCount]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  // Refetch when route changes
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        fetchUnreadCount();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, user, fetchUnreadCount]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(debouncedFetch, 30000);
    return () => {
      clearInterval(interval);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [user, debouncedFetch]);

  const refreshMessageCount = useCallback(() => {
    setTimeout(() => {
      fetchUnreadCount();
    }, 600);
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
