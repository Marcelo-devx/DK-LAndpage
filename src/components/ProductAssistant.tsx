import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Loader2, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useAssistantProducts, fetchAssistantRanking, type AssistantProduct } from '@/hooks/use-assistant-products';
import { normalize, restrictedTopic, outOfScope, safeText, productInformation, parseProductQuestion, relatedProducts, type ProductIntent } from '@/lib/product-assistant';

interface Message {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
  products?: AssistantProduct[];
}

function AssistantConversation({ firstName }: { firstName?: string }) {
  const { data: products = [], isPending, isError, refetch } = useAssistantProducts();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<AssistantProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const alive = useRef(true);
  const lastScope = useRef<AssistantProduct[] | null>(null);
  const lastIntent = useRef<ProductIntent>('search');
  const safeProducts = products.filter(product => safeText(product.name));
  const currentProduct = safeProducts.find(product => location.pathname === `/produto/${product.id}`);
  const contextProduct = selectedProduct || currentProduct;
  const automaticSuggestions = currentProduct ? relatedProducts(currentProduct, safeProducts).slice(0, 3) : [];

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const append = (sender: Message['sender'], text: string, items?: AssistantProduct[]) => {
    if (alive.current) setMessages(previous => [...previous, { id: ++sequence.current, sender, text, products: items }]);
  };

  const chooseProduct = (product: AssistantProduct) => {
    if (busy) return;
    setSelectedProduct(product);
    lastScope.current = [product];
    lastIntent.current = 'details';
    append('user', `Quero conhecer ${product.name}`);
    append('assistant', productInformation(product));
  };

  const listProducts = (items: AssistantProduct[], introduction?: string) => {
    append('assistant', items.length
      ? `${introduction || `Encontrei ${items.length} produto(s). Escolha um para conhecer.`}${items.length > 8 ? ' Exibo os primeiros 8; refine por nome, marca ou característica.' : ''}`
      : 'Não encontrei produtos disponíveis para essa busca. Tente outra marca, categoria ou característica.', items.slice(0, 8));
  };

  const ask = async (text: string) => {
    if (busy || !text.trim()) return;
    append('user', text);
    const normalized = normalize(text);
    if (restrictedTopic.test(normalized)) { append('assistant', outOfScope); return; }
    if (isPending || isError) {
      append('assistant', isPending ? 'Estou carregando o catálogo. Tente novamente em instantes.' : 'Não consegui consultar o catálogo agora. Use o botão de tentar novamente.');
      return;
    }
    if (/^(oi|ola|bom dia|boa tarde|boa noite)[!.\s]*$/.test(normalized)) {
      append('assistant', 'Olá! Pode perguntar “qual produto da Fini mais sai?”, buscar uma característica ou pedir sugestões parecidas com um produto.');
      return;
    }
    const parsed = parseProductQuestion(text, safeProducts);
    const intent = /^e\b/.test(normalized) && lastIntent.current === 'bestsellers' && parsed.intent === 'search' ? 'bestsellers' : parsed.intent;
    let matches = parsed.matches;
    if (!parsed.hasTerms && lastScope.current && intent === 'bestsellers') matches = lastScope.current;

    if (intent === 'bestsellers') {
      if (!matches.length) { listProducts([]); return; }
      setBusy(true);
      try {
        const ranking = await fetchAssistantRanking();
        if (!alive.current) return;
        const ranked = matches.filter(product => ranking.has(product.id)).sort((a, b) => ranking.get(a.id)! - ranking.get(b.id)! || a.name.localeCompare(b.name));
        lastScope.current = matches;
        lastIntent.current = 'bestsellers';
        if (!ranked.length) {
          append('assistant', 'Não há vendas registradas nos últimos 90 dias para os produtos disponíveis dessa seleção. Não vou inventar um campeão de vendas. Você pode conhecer os produtos abaixo.', matches.slice(0, 8));
        } else {
          const leaders = ranked.filter(product => ranking.get(product.id) === ranking.get(ranked[0].id));
          const summary = leaders.length === 1 ? `O mais vendido dessa seleção é ${ranked[0].name}.` : `Há ${leaders.length} produtos empatados na liderança dessa seleção.`;
          append('assistant', `${summary}\n\nOrdem por quantidade vendida nos últimos 90 dias, considerando somente produtos disponíveis e vendas confirmadas. Kits promocionais não entram neste ranking. Escolha um produto para conhecer.${ranked.length > 8 ? ' Mostro os primeiros 8.' : ''}`, ranked.slice(0, 8));
        }
      } catch {
        append('assistant', 'Não consegui consultar o ranking real de vendas agora. Tente novamente. Não vou substituir vendas por uma recomendação inventada.');
      } finally {
        if (alive.current) setBusy(false);
      }
      return;
    }

    if (intent === 'related') {
      const reference = parsed.hasTerms && matches.length === 1 ? matches[0] : !parsed.hasTerms ? contextProduct : undefined;
      if (reference) {
        const related = relatedProducts(reference, safeProducts);
        lastScope.current = related;
        lastIntent.current = intent;
        listProducts(related, `Produtos relacionados a ${reference.name}, pela categoria, tipo ou marca. Isso não garante compatibilidade; confira a descrição de cada produto.`);
      } else if (parsed.hasTerms && matches.length > 1) {
        listProducts(matches, 'Escolha o produto de referência e depois digite “ver parecidos”.');
      } else if (parsed.hasTerms) {
        listProducts([]);
      } else {
        append('assistant', 'Escolha um produto ou abra a página dele para eu sugerir opções relacionadas.');
      }
      return;
    }

    if (intent === 'details' && !parsed.hasTerms) {
      if (contextProduct) append('assistant', productInformation(contextProduct));
      else append('assistant', 'De qual produto você quer saber? Digite o nome ou escolha um abaixo.', safeProducts.slice(0, 8));
      return;
    }
    lastScope.current = matches;
    lastIntent.current = intent;
    if (matches.length === 1) {
      setSelectedProduct(matches[0]);
      append('assistant', productInformation(matches[0]));
    } else if (intent === 'recommend') {
      const suggested = !parsed.hasTerms && contextProduct ? relatedProducts(contextProduct, safeProducts) : matches;
      listProducts(suggested, 'Estas opções correspondem ao catálogo ou ao produto que você está vendo. São sugestões por características, não uma avaliação de qualidade nem um ranking de vendas.');
    } else if (matches.length) {
      listProducts(matches);
    } else {
      append('assistant', 'Não encontrei essa combinação no catálogo. Tente um nome, marca, sabor ou tipo. Posso reconhecer perguntas sobre mais vendidos e produtos parecidos, mas não qualquer pergunta livre.');
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void ask(text);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4" role="log" aria-label="Conversa com o Assistente DK" aria-live="polite">
        <div className="mb-4 max-w-[95%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-800">
          <p className="font-semibold">Olá{firstName ? `, ${firstName}` : ''}! Sou o Assistente DK 👋</p>
          <p className="mt-2">Posso encontrar produtos, consultar os mais vendidos e sugerir opções relacionadas. Experimente: “qual produto da Fini mais sai?” ou “me mostra produtos da Fini”.</p>
          <p className="mt-2 text-xs text-slate-500">Sem IA externa. Não respondo sobre pagamento ou acesso.</p>
          {currentProduct && <div className="mt-3 border-t pt-3">
            <p>Você está vendo <strong>{currentProduct.name}</strong>.</p>
            {!!automaticSuggestions.length && <p className="mt-2 text-xs text-slate-500">Opções relacionadas por categoria, tipo ou marca:</p>}
            {automaticSuggestions.map(product => <Button key={product.id} disabled={busy} variant="outline" className="mt-2 h-auto w-full justify-start whitespace-normal text-left" onClick={() => chooseProduct(product)}>{product.name}</Button>)}
          </div>}
        </div>
        {messages.map(message => (
          <div key={message.id} className={`mb-3 max-w-[95%] rounded-2xl p-3 text-sm ${message.sender === 'user' ? 'ml-auto rounded-tr-sm bg-slate-900 text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'}`}>
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
            {message.products?.map(product => (
              <Button key={product.id} disabled={busy} variant="outline" className="mt-2 h-auto w-full justify-start whitespace-normal text-left text-slate-800" onClick={() => chooseProduct(product)}>{product.name}</Button>
            ))}
          </div>
        ))}
        {busy && <p className="mb-3 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Consultando vendas reais…</p>}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 space-y-3 border-t bg-white p-4">
        {isPending ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando os produtos…</p>
        ) : isError ? (
          <div className="text-sm text-red-700">Não foi possível carregar os produtos. <Button variant="link" onClick={() => refetch()}>Tentar novamente</Button></div>
        ) : !safeProducts.length ? (
          <p className="text-xs text-slate-500">Nenhum produto disponível para consulta no momento.</p>
        ) : null}
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); send(); }}>
          <Input aria-label="Mensagem para o Assistente DK" placeholder="Pergunte sobre produtos ou mais vendidos…" value={input} maxLength={300} disabled={busy} onChange={event => setInput(event.target.value)} className="min-w-0 text-base text-slate-900" />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Enviar mensagem"><Send className="h-4 w-4" /></Button>
        </form>
        <Button disabled={busy} variant="ghost" size="sm" className="h-7 text-xs text-slate-500" onClick={() => { setMessages([]); setSelectedProduct(null); setInput(''); lastScope.current = null; lastIntent.current = 'search'; }}><RotateCcw className="mr-2 h-3 w-3" />Recomeçar conversa</Button>
      </div>
    </>
  );
}

export default function ProductAssistant() {
  const { user, profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  if (loading || !user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="fixed bottom-[156px] right-6 z-[999999] h-12 gap-2 rounded-full bg-slate-900 px-4 text-white shadow-xl hover:bg-slate-800" aria-label="Abrir Assistente DK">
        <Bot className="h-5 w-5" />Assistente DK
      </Button>
      <DialogContent className="z-[1000000] flex h-[min(680px,85dvh)] w-[calc(100%_-_2rem)] max-w-md flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 text-slate-900">
        <DialogHeader className="shrink-0 border-b p-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Assistente DK</DialogTitle>
          <DialogDescription>Seu guia de produtos · Respostas baseadas no catálogo</DialogDescription>
        </DialogHeader>
        {open && <AssistantConversation key={user.id} firstName={profile?.id === user.id ? profile.first_name : undefined} />}
      </DialogContent>
    </Dialog>
  );
}
