import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { messagesApi, uploadApi } from '@/lib/api';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/contexts/MessageContext';
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
import { ArrowLeft, Send, Loader2, MessageCircle, Trash2, Ban, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Profile {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_disabled?: boolean;
  isPremium?: boolean;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  other_user?: Profile;
  last_message?: any;
  unread_count?: number;
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
  sender_profile?: Profile;
}

const Messages = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { refreshMessageCount } = useMessages();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    fetchConversations();
    
    // Poll for updates
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Clear messages when conversation changes
  useEffect(() => {
    setMessages([]);
    setActiveConversation(null);
  }, [conversationId]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!conversationId || !user) return;
    
    fetchMessages(conversationId);
    
    // Find active conversation
    const conv = conversations.find(c => c.id === conversationId);
    setActiveConversation(conv || null);
    
    // Poll for new messages
    const interval = setInterval(() => fetchMessages(conversationId), 5000);
    return () => clearInterval(interval);
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

    try {
      const data = await messagesApi.getConversations();
      
      // Transform avatar URLs
      const transformed = data.map((conv: any) => ({
        ...conv,
        other_user: conv.other_user ? {
          ...conv.other_user,
          avatar_url: conv.other_user.avatar_url ? uploadApi.getFileUrl(conv.other_user.avatar_url) : null
        } : undefined
      }));
      
      setConversations(transformed);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const data = await messagesApi.getMessages(convId);
      
      // Transform media URLs
      const transformed = data.map((msg: any) => ({
        ...msg,
        media_url: msg.media_url ? uploadApi.getFileUrl(msg.media_url) : null,
        sender_profile: msg.sender_profile ? {
          ...msg.sender_profile,
          avatar_url: msg.sender_profile.avatar_url ? uploadApi.getFileUrl(msg.sender_profile.avatar_url) : null
        } : undefined
      }));
      
      setMessages(transformed);
      
      // Refresh unread message count
      refreshMessageCount();
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !conversationId || !newMessage.trim()) return;

    setSending(true);
    try {
      await messagesApi.sendMessage(conversationId, {
        content: newMessage.trim()
      });
      
      setNewMessage('');
      await fetchMessages(conversationId);
      await fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;
    
    // Note: Delete message API not implemented yet
    toast.error('Message deletion not available');
    setDeleteMessageId(null);
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
    const otherUserId = activeConversation.participant_1 === profile?.user_id 
      ? activeConversation.participant_2 
      : activeConversation.participant_1;
    const isOtherUserDisabled = activeConversation.other_user?.is_disabled || false;

    return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        <Header />
        
        <main className="pt-14 flex-1 flex flex-col overflow-hidden">
          {/* Chat Header - Sticky */}
          <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <Link to={`/user/${otherUserId}`} className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={activeConversation.other_user?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {activeConversation.other_user?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <Link to={`/user/${otherUserId}`} className="flex-1">
                <p className="font-semibold text-sm flex items-center gap-1">
                  {activeConversation.other_user?.full_name || activeConversation.other_user?.username || 'Unknown'}
                  {activeConversation.other_user?.isPremium && (
                    <BadgeCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </p>
                {isOtherUserDisabled ? (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Account Disabled
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Tap to view profile</p>
                )}
              </Link>
            </div>
          </div>

          {/* Messages - Scrollable */}
          <ScrollArea className="flex-1 min-h-0 p-4">
            <div className="space-y-4 max-w-2xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.sender_id === profile?.user_id ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl overflow-hidden relative group",
                      msg.sender_id === profile?.user_id
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    {msg.media_url && (
                      <Link 
                        to={msg.shared_post_id ? `/post/${msg.shared_post_id}` : '#'}
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
                      <p className={cn("text-sm px-4 py-2", msg.sender_id === profile?.user_id && "pr-10")}>{msg.content}</p>
                    )}
                    {!msg.content && msg.media_url && (
                      <div className="px-1 py-1" />
                    )}
                    <div className={cn(
                      "flex items-center gap-1 px-4 pb-2",
                      msg.sender_id === profile?.user_id ? "justify-end" : ""
                    )}>
                      <p className={cn(
                        "text-xs",
                        msg.sender_id === profile?.user_id ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                      {msg.sender_id === profile?.user_id && (
                        msg.read_at ? (
                          <CheckCheck className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-primary-foreground/50" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input - Sticky */}
          <div className="bg-card border-t border-border p-4 flex-shrink-0">
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
                  onChange={(e) => setNewMessage(e.target.value)}
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
                const otherUserId = conv.participant_1 === profile?.user_id ? conv.participant_2 : conv.participant_1;
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
                        <AvatarImage src={conv.other_user?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {conv.other_user?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate flex items-center gap-1">
                        {conv.other_user?.full_name || conv.other_user?.username || 'Unknown'}
                        {conv.other_user?.isPremium && (
                          <BadgeCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                      </p>
                      {conv.other_user?.is_disabled ? (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <Ban className="w-3 h-3" /> Account Disabled
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.last_message?.content || 'Start chatting...'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                      </span>
                      {(conv.unread_count ?? 0) > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1.5">
                          {conv.unread_count! > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
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
