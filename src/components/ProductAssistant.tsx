import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, Loader2, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useAssistantProducts, type AssistantProduct } from '@/hooks/use-assistant-products';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const restrictedTopic = /\b(pag\w*|preco\w*|valor\w*|pix|boleto\w*|cartao\w*|credito\w*|debito\w*|parcel\w*|cobr\w*|assinatura\w*|reembolso\w*|estorno\w*|cupom\w*|cupons|desconto\w*|frete\w*|checkout|acess\w*|login\w*|senha\w*|conta\w*|permiss\w*|liber\w*|bloque\w*|autentic\w*|entrar|pedido\w*|entrega\w*)\b/;
const outOfScope = 'Ajudo somente com os produtos e suas informações cadastradas. Não trato de pagamento, pedidos ou acesso à conta. Para esses assuntos, procure o suporte da loja.';

interface Message {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
  products?: AssistantProduct[];
}

function productInformation(product: AssistantProduct): string {
  const description = product.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const details = [
    product.category && `Categoria: ${product.category}`,
    product.sub_category && `Tipo: ${product.sub_category}`,
    product.brand && `Marca: ${product.brand}`,
  ].filter(Boolean).filter(text => !restrictedTopic.test(normalize(String(text))));
  // Descrições são conteúdo externo: não exibir textos comerciais ou de acesso.
  const safeDescription = description && !restrictedTopic.test(normalize(description)) && !/(?:R\$|US\$|\$|€|£)/i.test(description);
  return [
    product.name,
    ...details,
    safeDescription ? `Descrição cadastrada: ${description}` : 'Não há uma descrição adequada disponível para explicar o uso deste produto. Consulte as informações do fabricante; não vou inventar instruções.',
  ].join('\n\n');
}

function AssistantConversation({ firstName }: { firstName?: string }) {
  const { data: products = [], isPending, isError, refetch } = useAssistantProducts();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<AssistantProduct | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const currentProduct = products.find(product => location.pathname === `/produto/${product.id}`);
  const safeProducts = products.filter(product => !restrictedTopic.test(normalize(product.name)) && !/(?:R\$|US\$|\$|€|£)/i.test(product.name));
  const categories = [...new Set(safeProducts.map(product => product.category).filter((category): category is string => !!category && !restrictedTopic.test(normalize(category))))];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const append = (sender: Message['sender'], text: string, items?: AssistantProduct[]) => {
    setMessages(previous => [...previous, { id: ++sequence.current, sender, text, products: items }]);
  };

  const chooseProduct = (product: AssistantProduct) => {
    setSelectedProduct(product);
    append('user', `Quero conhecer ${product.name}`);
    append('assistant', productInformation(product));
  };

  const showProducts = (label: string, items: AssistantProduct[]) => {
    append('user', label);
    append('assistant', items.length ? `Encontrei ${items.length} produto(s). Escolha um abaixo para ver suas informações.${items.length > 8 ? ' Exibo os primeiros 8; digite um nome para refinar.' : ''}` : 'Não encontrei produtos disponíveis com essa busca. Tente outro nome ou escolha uma categoria.', items.slice(0, 8));
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const normalized = normalize(text);
    if (restrictedTopic.test(normalized)) {
      append('user', text);
      append('assistant', outOfScope);
      return;
    }
    if (isPending || isError) {
      append('user', text);
      append('assistant', isPending ? 'Estou carregando o catálogo. Tente novamente em instantes.' : 'Não consegui consultar o catálogo agora. Use o botão de tentar novamente.');
      return;
    }
    if (/^(oi|ola|bom dia|boa tarde|boa noite)[!.\s]*$/.test(normalized)) {
      append('user', text);
      append('assistant', 'Olá! Escolha uma categoria ou digite o nome do produto que quer conhecer.');
      return;
    }
    if (selectedProduct && /^(como (usar|funciona)( (este|esse|o) produto)?|uso|usar|funciona|descricao|detalhes|informacoes)[?!.\s]*$/.test(normalized)) {
      append('user', text);
      append('assistant', productInformation(selectedProduct));
      return;
    }
    const terms = normalized.split(/[^a-z0-9]+/).filter(term => term.length > 1 && !['quero', 'conhecer', 'produto', 'produtos', 'sobre', 'como', 'usar', 'qual', 'uma', 'tem', 'que', 'para', 'por', 'favor', 'ver', 'mostrar', 'marca', 'categoria', 'me', 'da', 'do', 'de', 'os', 'as'].includes(term));
    const matches = terms.length ? safeProducts.filter(product => {
      const searchable = normalize([product.name, product.category, product.sub_category, product.brand].filter(Boolean).join(' '));
      return terms.every(term => searchable.includes(term));
    }) : [];
    if (matches.length === 1) {
      setSelectedProduct(matches[0]);
      append('user', text);
      append('assistant', productInformation(matches[0]));
    } else if (matches.length) {
      showProducts(text, matches);
    } else {
      append('user', text);
      append('assistant', 'Não reconheci essa busca. Sou um assistente guiado, não uma IA generativa. Digite o nome ou a marca de um produto, ou use as opções abaixo.');
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4" role="log" aria-label="Conversa com o Assistente DK" aria-live="polite">
        <div className="mb-4 max-w-[95%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-800">
          <p className="font-semibold">Olá{firstName ? `, ${firstName}` : ''}! Sou o Assistente DK 👋</p>
          <p className="mt-2">Posso ajudar você a encontrar produtos e entender as informações do catálogo. Escolha uma opção ou digite um nome.</p>
          <p className="mt-2 text-xs text-slate-500">Sem IA externa. Não respondo sobre pagamento ou acesso.</p>
        </div>
        {messages.map(message => (
          <div key={message.id} className={`mb-3 max-w-[95%] rounded-2xl p-3 text-sm ${message.sender === 'user' ? 'ml-auto rounded-tr-sm bg-slate-900 text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'}`}>
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
            {message.products?.map(product => (
              <Button key={product.id} variant="outline" className="mt-2 h-auto w-full justify-start whitespace-normal text-left text-slate-800" onClick={() => chooseProduct(product)}>
                {product.name}
              </Button>
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 space-y-3 border-t bg-white p-4">
        {isPending ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando os produtos…</p>
        ) : isError ? (
          <div className="text-sm text-red-700">Não foi possível carregar os produtos. <Button variant="link" onClick={() => refetch()}>Tentar novamente</Button></div>
        ) : (
          <div className="max-h-28 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => showProducts('Ver produtos', safeProducts)}>Ver produtos</Button>
              {currentProduct && safeProducts.some(product => product.id === currentProduct.id) && <Button size="sm" variant="outline" onClick={() => chooseProduct(currentProduct)}>Produto desta página</Button>}
              {categories.map(category => <Button key={category} size="sm" variant="outline" onClick={() => showProducts(`Categoria: ${category}`, safeProducts.filter(product => product.category === category))}>{category}</Button>)}
              {selectedProduct && <Button size="sm" variant="outline" asChild><Link to={`/produto/${selectedProduct.id}`}>Ver página do produto</Link></Button>}
            </div>
            {!safeProducts.length && <p className="mt-2 text-xs text-slate-500">Nenhum produto disponível para consulta no momento.</p>}
          </div>
        )}
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); send(); }}>
          <Input aria-label="Mensagem para o Assistente DK" placeholder="Digite o nome ou marca do produto…" value={input} maxLength={300} onChange={event => setInput(event.target.value)} className="min-w-0 text-base text-slate-900" />
          <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Enviar mensagem"><Send className="h-4 w-4" /></Button>
        </form>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500" onClick={() => { setMessages([]); setSelectedProduct(null); setInput(''); }}><RotateCcw className="mr-2 h-3 w-3" />Recomeçar conversa</Button>
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
