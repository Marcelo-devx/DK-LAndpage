import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const SupportChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]); // Começa vazio
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isTyping]);

  // Busca a mensagem de boas-vindas ao abrir pela primeira vez
  useEffect(() => {
    if (isOpen && !hasInitialized) {
        setHasInitialized(true);
        const fetchGreeting = async () => {
            setIsTyping(true);
            try {
                // Envia comando /start para o N8N saber que é o início
                const { data, error } = await supabase.functions.invoke('chat-proxy', {
                    body: { message: "/start", history: [] }
                });
                
                if (error) throw error;
                
                if (data?.reply) {
                    setMessages([{
                        id: Date.now().toString(),
                        text: data.reply,
                        sender: 'bot',
                        timestamp: new Date()
                    }]);
                }
            } catch (error) {
                console.error("Falha ao buscar saudação:", error);
                // Fallback caso o webhook falhe
                setMessages([{
                    id: 'default-welcome',
                    text: 'Olá! Como posso ajudar você hoje?',
                    sender: 'bot',
                    timestamp: new Date()
                }]);
            } finally {
                setIsTyping(false);
            }
        };
        fetchGreeting();
    }
  }, [isOpen, hasInitialized]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Prepara histórico simples (últimas 5 msgs) para contexto
      const history = messages.slice(-5).map(m => ({ role: m.sender, content: m.text }));

      const { data, error } = await supabase.functions.invoke('chat-proxy', {
        body: { 
            message: userMsg.text,
            history: history
        }
      });

      if (error) throw error;

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "Desculpe, tive um erro de conexão. Tente novamente em instantes.",
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 md:right-6 w-[90vw] md:w-[380px] h-[500px] max-h-[80vh] bg-white border border-stone-200 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-slate-950 p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                        <Bot className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-black uppercase text-sm tracking-widest italic">DK Assistant</h3>
                        <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <span className="block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online agora
                        </p>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50 custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex w-full", msg.sender === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                            "max-w-[80%] p-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm",
                            msg.sender === 'user' 
                                ? "bg-sky-500 text-white rounded-tr-none" 
                                : "bg-white text-slate-700 border border-stone-100 rounded-tl-none"
                        )}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-stone-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-stone-100 flex gap-2">
                <Input 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-stone-50 border-stone-200 rounded-xl focus:bg-white transition-colors"
                    disabled={isTyping}
                />
                <Button 
                    type="submit" 
                    size="icon" 
                    className="bg-sky-500 hover:bg-sky-400 text-white rounded-xl shrink-0"
                    disabled={!inputValue.trim() || isTyping}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-[100]",
          "bg-[#25D366] hover:bg-[#128C7E] text-white", // Mantendo cores do Whats para familiaridade
          "p-4 rounded-full shadow-[0_10px_25px_-5px_rgba(37,211,102,0.4)]",
          "transition-all duration-300 hover:scale-110 active:scale-95 group",
          "flex items-center justify-center",
          "cursor-pointer border-none outline-none",
          isOpen && "rotate-90 bg-slate-800 hover:bg-slate-900 shadow-slate-900/30"
        )}
        aria-label="Abrir Chat"
      >
        {isOpen ? (
            <X className="h-7 w-7" />
        ) : (
            <MessageCircle className="h-7 w-7 fill-current" />
        )}
        
        {/* Tooltip (Só aparece se fechado) */}
        {!isOpen && (
            <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
                Suporte Online
            </span>
        )}
      </button>
    </>
  );
};

export default SupportChatWidget;