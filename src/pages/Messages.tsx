import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Send, Loader2, MessageCircle, Trash2, Ban, Phone, Video } from 'lucide-react';
import { useCall } from '@/components/calls/CallProvider';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Profile {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_disabled?: boolean;
  phone?: string;
  isPremium?: boolean;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  otherUser?: Profile;
  lastMessage?: string;
  unreadCount?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  shared_post_id?: string | null;
  shared_from_user_id?: string | null;
  shared_from_username?: string | null;
  shared_from_avatar_url?: string | null;
}

const Messages = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startCall } = useCall();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [voiceCallEnabled, setVoiceCallEnabled] = useState(true);
  const [videoCallEnabled, setVideoCallEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch call settings
  useEffect(() => {
    const fetchCallSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['voice_call_enabled', 'video_call_enabled']);
      if (data) {
        data.forEach((s: { key: string; value: string }) => {
          if (s.key === 'voice_call_enabled') setVoiceCallEnabled(s.value === 'true');
          if (s.key === 'video_call_enabled') setVideoCallEnabled(s.value === 'true');
        });
      }
    };
    fetchCallSettings();
  }, []);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    fetchConversations();
    
    // Subscribe to conversation updates
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Subscribe to presence for online status
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user.id } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.keys(state).forEach(userId => online.add(userId));
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!conversationId || !user) return;
    
    fetchMessages(conversationId);
    
    // Find active conversation
    const conv = conversations.find(c => c.id === conversationId);
    setActiveConversation(conv || null);

    // Subscribe to message changes (INSERT and DELETE)
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);
          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const deletedMsg = payload.old as { id: string };
          setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .subscribe();

    // Subscribe to typing indicators
    const typingChannel = supabase.channel(`typing-${conversationId}`, {
      config: { broadcast: { self: false } }
    });

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== user.id) {
          setTypingUsers(prev => new Set(prev).add(payload.userId));
          setTimeout(() => {
            setTypingUsers(prev => {
              const next = new Set(prev);
              next.delete(payload.userId);
              return next;
            });
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, user, conversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (data) {
      // Fetch profiles for other participants
      const convWithProfiles = await Promise.all(
        data.map(async (conv) => {
          const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, full_name, username, avatar_url, is_disabled, phone')
            .eq('user_id', otherUserId)
            .single();

          // Check premium status
          const isAdminPhone = profile?.phone === '7326937200';
          let isPremium = isAdminPhone;
          if (!isPremium) {
            const { data: sub } = await supabase
              .from('user_subscriptions')
              .select('plan_type')
              .eq('user_id', otherUserId)
              .maybeSingle();
            isPremium = sub?.plan_type === 'premium';
          }

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...conv,
            otherUser: profile ? { ...profile, isPremium } : undefined,
            lastMessage: lastMsg?.content
          } as Conversation;
        })
      );

      setConversations(convWithProfiles);
    }
    setLoading(false);
  };

  const fetchMessages = async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
      
      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', convId)
        .neq('sender_id', user?.id)
        .is('read_at', null);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !conversationId || !newMessage.trim()) return;

    setSending(true);
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim()
      });

    if (!error) {
      setNewMessage('');
      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }
    setSending(false);
  };

  const handleTyping = () => {
    if (!conversationId || !user) return;

    // Broadcast typing indicator
    const typingChannel = supabase.channel(`typing-${conversationId}`);
    typingChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id }
    });

    // Debounce typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      // Typing stopped
    }, 3000);
  };

  const isUserOnline = (userId: string) => onlineUsers.has(userId);

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', deleteMessageId);
      
      if (error) throw error;
      
      setMessages(prev => prev.filter(m => m.id !== deleteMessageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    } finally {
      setDeleteMessageId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-14 flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <MobileNav />
      </div>
    );
  }

  // Chat view
  if (conversationId && activeConversation) {
    const otherUserId = activeConversation.participant_1 === user?.id 
      ? activeConversation.participant_2 
      : activeConversation.participant_1;
    const isTyping = typingUsers.has(otherUserId);
    const isOtherUserDisabled = activeConversation.otherUser?.is_disabled || false;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main className="pt-14 pb-20 md:pb-16 flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <Link to={`/user/${otherUserId}`} className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={activeConversation.otherUser?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {activeConversation.otherUser?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                {isUserOnline(otherUserId) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                )}
              </Link>
              <Link to={`/user/${otherUserId}`} className="flex-1">
                <p className="font-semibold text-sm flex items-center gap-1">
                  {activeConversation.otherUser?.full_name || activeConversation.otherUser?.username || 'User'}
                  {activeConversation.otherUser?.isPremium && (
                    <BadgeCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </p>
                {isOtherUserDisabled ? (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Account Disabled
                  </p>
                ) : isTyping ? (
                  <p className="text-xs text-primary animate-pulse">typing...</p>
                ) : isUserOnline(otherUserId) ? (
                  <p className="text-xs text-green-500">Online</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Offline</p>
                )}
              </Link>
            </div>
            {!isOtherUserDisabled && (voiceCallEnabled || videoCallEnabled) && (
              <div className="flex items-center gap-1">
                {voiceCallEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => conversationId && startCall(conversationId, otherUserId, 'voice')}
                    className="text-primary hover:bg-primary/10"
                  >
                    <Phone className="w-5 h-5" />
                  </Button>
                )}
                {videoCallEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => conversationId && startCall(conversationId, otherUserId, 'video')}
                    className="text-primary hover:bg-primary/10"
                  >
                    <Video className="w-5 h-5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-2xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.sender_id === user?.id ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl overflow-hidden relative group",
                      msg.sender_id === user?.id
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    {/* Delete button for sender - always visible */}
                    {msg.sender_id === user?.id && (
                      <button
                        onClick={() => setDeleteMessageId(msg.id)}
                        className="absolute top-2 right-2 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full p-1.5 z-10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    
                    {/* Shared post author info */}
                    {msg.shared_from_user_id && (
                      <Link
                        to={`/user/${msg.shared_from_user_id}`}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border/20 hover:opacity-80 transition-opacity"
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={msg.shared_from_avatar_url || undefined} />
                          <AvatarFallback className="bg-background/20 text-xs">
                            {msg.shared_from_username?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">
                          {msg.shared_from_username || 'User'}
                        </span>
                      </Link>
                    )}
                    
                    {msg.media_url && (
                      <Link 
                        to={msg.shared_post_id ? `/post/${msg.shared_post_id}` : '#'}
                        state={msg.shared_from_user_id ? { userId: msg.shared_from_user_id } : undefined}
                        className="block w-full max-w-[280px]"
                      >
                        {msg.media_type === 'video' ? (
                          <video
                            src={msg.media_url}
                            controls
                            className="w-full"
                            controlsList="nodownload noplaybackrate"
                          />
                        ) : (
                          <img
                            src={msg.media_url}
                            alt="Shared media"
                            className="w-full"
                          />
                        )}
                      </Link>
                    )}
                    {msg.content && (
                      <p className={cn("text-sm px-4 py-2", msg.sender_id === user?.id && "pr-10")}>{msg.content}</p>
                    )}
                    {!msg.content && msg.media_url && (
                      <div className="px-1 py-1" />
                    )}
                    <p className={cn(
                      "text-xs px-4 pb-2",
                      msg.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="bg-card border-t border-border p-4">
            {isOtherUserDisabled ? (
              <div className="max-w-2xl mx-auto flex items-center justify-center gap-2 py-2 text-destructive">
                <Ban className="w-4 h-4" />
                <p className="text-sm font-medium">This account has been disabled. You cannot send messages.</p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="gradient-maroon"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>
        </main>

        <MobileNav />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteMessageId} onOpenChange={(open) => !open && setDeleteMessageId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Message</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this message? This will remove it for both you and the recipient.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteMessage}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Conversations list view
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="px-4 py-4 border-b border-border">
            <h1 className="text-xl font-display font-semibold">Messages</h1>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">No messages yet</h3>
              <p className="text-muted-foreground text-sm">
                Start a conversation by visiting someone's profile
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conv) => {
                const otherUserId = conv.participant_1 === user?.id ? conv.participant_2 : conv.participant_1;
                return (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/messages/${conv.id}`)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Link 
                      to={`/user/${otherUserId}`} 
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={conv.otherUser?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {conv.otherUser?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {isUserOnline(otherUserId) && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate flex items-center gap-1">
                        {conv.otherUser?.full_name || conv.otherUser?.username || 'User'}
                        {conv.otherUser?.isPremium && (
                          <BadgeCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                      </p>
                      {conv.otherUser?.is_disabled ? (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <Ban className="w-3 h-3" /> Account Disabled
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage || 'Start chatting...'}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default Messages;
