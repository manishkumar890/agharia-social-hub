import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextType {
  unreadCount: number;
  markAsRead: () => void;
  refreshCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const LAST_SEEN_KEY = 'notifications_last_seen';

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const getLastSeen = useCallback(() => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    return stored ? new Date(stored) : new Date(0);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const lastSeen = getLastSeen();
    const lastSeenISO = lastSeen.toISOString();

    try {
      // Count new likes on user's posts
      const { count: likesCount } = await supabase
        .from('likes')
        .select('id, posts!inner(user_id)', { count: 'exact', head: true })
        .eq('posts.user_id', user.id)
        .neq('user_id', user.id)
        .gt('created_at', lastSeenISO);

      // Count new comments on user's posts
      const { count: commentsCount } = await supabase
        .from('comments')
        .select('id, posts!inner(user_id)', { count: 'exact', head: true })
        .eq('posts.user_id', user.id)
        .neq('user_id', user.id)
        .gt('created_at', lastSeenISO);

      // Count new followers
      const { count: followersCount } = await supabase
        .from('followers')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', user.id)
        .gt('created_at', lastSeenISO);

      const total = (likesCount || 0) + (commentsCount || 0) + (followersCount || 0);
      setUnreadCount(total);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  }, [user, getLastSeen]);

  const markAsRead = useCallback(() => {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setUnreadCount(0);
  }, []);

  const refreshCount = useCallback(async () => {
    await fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to new likes
    const likesChannel = supabase
      .channel('notification-likes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
        },
        async (payload) => {
          // Check if the like is on user's post
          const { data: post } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', payload.new.post_id)
            .single();

          if (post?.user_id === user.id && payload.new.user_id !== user.id) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    // Subscribe to new comments
    const commentsChannel = supabase
      .channel('notification-comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
        },
        async (payload) => {
          // Check if the comment is on user's post
          const { data: post } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', payload.new.post_id)
            .single();

          if (post?.user_id === user.id && payload.new.user_id !== user.id) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    // Subscribe to new followers
    const followersChannel = supabase
      .channel('notification-followers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'followers',
          filter: `following_id=eq.${user.id}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(followersChannel);
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ unreadCount, markAsRead, refreshCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
