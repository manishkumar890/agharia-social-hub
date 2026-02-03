import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, ArrowLeft, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PremiumUpgradeDialog from '@/components/PremiumUpgradeDialog';

type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const AIChat = () => {
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearChat = () => {
    setMessages([]);
    toast.success('Chat cleared');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to get AI response");
      setMessages(prev => prev.filter(m => m !== userMsg));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">AI Assistant</h1>
          </div>
        </div>

        {/* Premium required message */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Crown className="w-16 h-16 text-primary mb-4" />
          <h2 className="font-semibold text-xl mb-2">Premium Feature</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            AI Assistant is available only for premium members. Upgrade now to get quick answers!
          </p>
          <Button onClick={() => setShowUpgradeDialog(true)}>
            Upgrade to Premium
          </Button>
          <PremiumUpgradeDialog 
            open={showUpgradeDialog} 
            onOpenChange={setShowUpgradeDialog} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">AI Assistant</h1>
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={handleClearChat}>
            <Trash2 className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-10 h-10 text-primary opacity-70" />
            </div>
            <h2 className="font-medium text-lg text-foreground mb-1">Hi! I'm your AI assistant.</h2>
            <p className="text-sm max-w-xs">Ask me anything about the app, community, or get help with any questions!</p>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn("flex items-end gap-2 max-w-[85%]", msg.role === "user" && "flex-row-reverse")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-card border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 rounded-full"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim()}
            className="rounded-full"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AIChat;
