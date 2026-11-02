import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, Loader2, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useAssistantProducts, fetchAssistantRanking, type AssistantProduct, type AssistantVariant } from '@/hooks/use-assistant-products';
import { normalize, restrictedTopic, outOfScope, safeText, productInformation, parseProductQuestion, relatedProducts, matchingVariants, variantLabel, productAvailable, type ProductIntent } from '@/lib/product-assistant';
import AssistantProductOptions, { assistantOutline, assistantPrimary } from './AssistantProductOptions';
import AssistantFlavorResults, { flavorBrand, flavorVolume, type AssistantFlavorOption } from './AssistantFlavorResults';
import AssistantPreferencePrompt, { type AssistantPreference } from './AssistantPreferencePrompt';
import AssistantProductResults from './AssistantProductResults';
import { flavorType, liquidType, requestedFlavorType } from '@/lib/assistant-preferences';
import { filteredProductsLink, navigationRequest, referencesPrevious, isPreferenceReply, isNewProductRequest, type AssistantLink } from '@/lib/assistant-conversation';

interface Message {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
  products?: AssistantProduct[];
  productChoice?: AssistantProduct;
  initialVariantId?: string;
  flavorOptions?: AssistantFlavorOption[];
  preference?: AssistantPreference;
  links?: AssistantLink[];
}

function AssistantConversation({ firstName, onVisitProduct }: { firstName?: string; onVisitProduct: () => void }) {
  const { data: products = [], isPending, isError, refetch } = useAssistantProducts();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<AssistantProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const responseLocked = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const alive = useRef(true);
  const lastScope = useRef<AssistantProduct[] | null>(null);
  const lastIntent = useRef<ProductIntent>('search');
  const refinement = useRef<{ id: number; stage: AssistantPreference['stage']; options: AssistantFlavorOption[] } | null>(null);
  const [activePreference, setActivePreference] = useState<number | null>(null);
  const safeProducts = products.filter(product => safeText(product.name));
  const currentProduct = safeProducts.find(product => location.pathname === `/produto/${product.id}`);
  const currentVariantId = new URLSearchParams(location.search).get('variant') || undefined;
  const currentVariant = currentProduct?.variants.find(variant => variant.id === currentVariantId);
  const contextProduct = safeProducts.find(product => product.id === selectedProduct?.id) || currentProduct;
  const automaticSuggestions = currentProduct ? relatedProducts(currentProduct, safeProducts.filter(productAvailable)).slice(0, 3) : [];

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const append = (sender: Message['sender'], text: string, items?: AssistantProduct[], productChoice?: AssistantProduct, initialVariantId?: string, flavorOptions?: AssistantFlavorOption[]) => {
    if (alive.current) setMessages(previous => [...previous, { id: ++sequence.current, sender, text, products: items, productChoice, initialVariantId, flavorOptions }]);
  };

  const withThinking = async (respond: () => void | Promise<void>) => {
    if (responseLocked.current) return;
    responseLocked.current = true;
    setBusy(true);
    try {
      await new Promise<void>(resolve => window.setTimeout(resolve, 650));
      if (alive.current) await respond();
    } finally {
      responseLocked.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const finishRefinement = (options: AssistantFlavorOption[]) => {
    refinement.current = null;
    setActivePreference(null);
    lastScope.current = [...new Map(options.map(option => [option.product.id, option.product])).values()];
    lastIntent.current = 'search';
    const available = options.filter(option => option.variant.stock_quantity > 0).length;
    const summary = options.length === 1 ? 'Achei uma opção com essa preferência!' : `Achei ${options.length} opções com esse filtro. Vou mostrar só ${Math.min(3, options.length)} de cada vez, combinado?`;
    const stock = available ? 'As disponíveis aparecem primeiro; as esgotadas ficam identificadas.' : 'Essas opções estão esgotadas no momento, mas você pode pedir um aviso quando chegarem.';
    append('assistant', `${summary} 😊\n\n${stock}`, undefined, undefined, undefined, options);
  };

  const requestPreference = (stage: AssistantPreference['stage'], options: AssistantFlavorOption[]) => {
    const values = [...new Set(options.map(option => stage === 'type' ? flavorType(option) : stage === 'volume' ? flavorVolume(option) : flavorBrand(option.product)))]
      .filter(value => stage !== 'volume' || value !== 'unknown');
    values.sort((a, b) => stage === 'volume' ? Number(a) - Number(b) : a.localeCompare(b));
    const choices = values.map(value => ({ value, label: stage === 'volume' ? `${value} ml` : value }));
    const id = ++sequence.current;
    refinement.current = { id, stage, options };
    setActivePreference(id);
    const type = flavorType(options[0]);
    const text = stage === 'type'
      ? 'Esse sabor aparece em tipos diferentes de produto. Qual tipo você procura? Escolha abaixo para eu separar as opções, sem misturar juices e descartáveis.'
      : stage === 'volume'
        ? 'Certo, vamos ficar só nos juices/líquidos. Qual volume em ml você prefere?'
        : `Vamos escolher uma marca para ${type.toLowerCase()}. Tem alguma de sua preferência?`;
    setMessages(previous => [...previous, { id, sender: 'assistant', text, preference: { id, stage, choices } }]);
  };

  const requestBrand = (options: AssistantFlavorOption[]) => {
    const brands = new Set(options.map(option => flavorBrand(option.product)));
    if (brands.size > 1) requestPreference('brand', options);
    else finishRefinement(options);
  };

  const requestVolume = (options: AssistantFlavorOption[]) => {
    const liquidsOnly = options.every(option => flavorType(option) === liquidType);
    const volumes = new Set(options.map(flavorVolume).filter(volume => volume !== 'unknown'));
    if (liquidsOnly && volumes.size > 1 && options.length > 3) requestPreference('volume', options);
    else if (options.length > 3) requestBrand(options);
    else finishRefinement(options);
  };

  const applyPreference = (value: string) => {
    const pending = refinement.current;
    if (!pending) return;
    if (pending.stage === 'type' && value === 'any') {
      append('assistant', 'Vamos escolher primeiro o tipo de produto, para não misturar juices e descartáveis. Depois você pode pular o volume ou a marca.');
      return;
    }
    const options = value === 'any' ? pending.options : pending.options.filter(option =>
      (pending.stage === 'type' ? flavorType(option) : pending.stage === 'volume' ? flavorVolume(option) : flavorBrand(option.product)) === value);
    if (!options.length) { append('assistant', 'Não achei opções com essa preferência. Escolha uma das opções disponíveis acima.'); return; }
    if (pending.stage === 'type') requestVolume(options);
    else if (pending.stage === 'volume') requestBrand(options);
    else finishRefinement(options);
  };

  const choosePreference = (id: number, value: string, label: string) => {
    if (responseLocked.current || refinement.current?.id !== id) return;
    append('user', label);
    void withThinking(() => applyPreference(value));
  };

  const offerProduct = (product: AssistantProduct, question?: string) => {
    refinement.current = null;
    setActivePreference(null);
    setSelectedProduct(product);
    lastScope.current = [product];
    lastIntent.current = 'details';
    const requestedVariants = question ? matchingVariants(question, product) : [];
    const initialVariantId = requestedVariants.length === 1 ? requestedVariants[0].id : !requestedVariants.length && currentProduct?.id === product.id ? currentVariantId : undefined;
    const flavorText = requestedVariants.length ? `\n\nEncontrei estas opções para o sabor ou característica que você pediu: ${requestedVariants.map(variant => `${variantLabel(variant)} (${variant.stock_quantity > 0 ? 'disponível' : 'esgotado'})`).join('; ')}.` : '';
    const stockText = !productAvailable(product) ? '\n\nEle está esgotado no momento, mas você pode cadastrar um aviso de reposição abaixo.' : '';
    const nextStep = product.variants.length ? 'Escolha o sabor ou a opção abaixo para saber mais ou visitar a página certinha.' : 'Você prefere saber mais por aqui ou visitar a página dele?';
    append('assistant', `Vamos conhecer ${product.name}? 😊 ${nextStep}${flavorText}${stockText}`, undefined, product, initialVariantId);
  };

  const chooseProduct = (product: AssistantProduct) => {
    if (responseLocked.current) return;
    append('user', product.name);
    void withThinking(() => offerProduct(product));
  };

  const showDetails = (product: AssistantProduct, variant?: AssistantVariant) => {
    if (responseLocked.current) return;
    append('user', `Quero saber mais sobre ${product.name}${variant ? ` — ${variantLabel(variant)}` : ''}`);
    void withThinking(() => {
      refinement.current = null;
      setActivePreference(null);
      setSelectedProduct(product);
      lastScope.current = [product];
      lastIntent.current = 'details';
      append('assistant', `Claro! Aqui está o que temos sobre ele:\n\n${productInformation(product, variant)}`, undefined, product, variant?.id);
    });
  };

  const listProducts = (items: AssistantProduct[], introduction?: string) => {
    if (items.length) lastScope.current = items;
    append('assistant', items.length
      ? `${introduction || 'Separei estas opções para você. Toque no produto que chamou sua atenção 😊'}${items.length > 3 ? ' Mostro três por vez. Você pode ver mais opções abaixo ou me dizer a marca ou uma característica para refinar.' : ''}`
      : 'Não achei uma opção com essa combinação. Quer tentar outra marca, categoria ou característica?', items);
  };

  const answer = async (text: string) => {
    const normalized = normalize(text);
    if (restrictedTopic.test(normalized.replace(/\bpaginas?\b/g, ''))) { append('assistant', outOfScope); return; }
    if (isPending || isError) {
      append('assistant', isPending ? 'Estou carregando o catálogo. Tente novamente em instantes.' : 'Não consegui consultar o catálogo agora. Use o botão de tentar novamente.');
      return;
    }
    if (/^(cancelar|cancela|deixa pra la|mudar de assunto|outra busca)[!.\s]*$/.test(normalized)) {
      refinement.current = null;
      setActivePreference(null);
      setSelectedProduct(null);
      lastScope.current = null;
      lastIntent.current = 'search';
      append('assistant', 'Claro! Vamos mudar. Me conta qual produto ou sabor você está procurando agora 😊');
      return;
    }
    const previous = refinement.current
      ? [...new Map(refinement.current.options.map(option => [option.product.id, option.product])).values()]
      : lastScope.current?.length ? lastScope.current : contextProduct ? [contextProduct] : [];
    const latestPrevious = previous.flatMap(product => {
      const latest = safeProducts.find(candidate => candidate.id === product.id);
      return latest ? [latest] : [];
    });
    const navigation = navigationRequest(text, safeProducts, latestPrevious);
    if (navigation) {
      refinement.current = null;
      setActivePreference(null);
      const singleProduct = navigation.scope.length === 1 && !navigation.category;
      const links = singleProduct ? [{ label: `Visitar ${navigation.scope[0].name}`, href: `/produto/${navigation.scope[0].id}` }]
        : navigation.scope.length ? [filteredProductsLink(navigation.scope)] : [];
      if (!links.length) {
        append('assistant', 'Você quer o link de qual produto ou categoria? Me diga o nome para eu te levar ao lugar certo.');
      } else {
        lastScope.current = navigation.scope;
        const reply = singleProduct ? 'Claro! Aqui está o link do produto no site:'
          : 'Claro! Este botão abre a loja já filtrada com os produtos que você está procurando:';
        setMessages(previousMessages => [...previousMessages, { id: ++sequence.current, sender: 'assistant', text: reply, links }]);
      }
      return;
    }
    if (refinement.current && !isPreferenceReply(text, refinement.current.stage, refinement.current.options) && isNewProductRequest(text, safeProducts)) {
      refinement.current = null;
      setActivePreference(null);
      setSelectedProduct(null);
      lastScope.current = null;
      lastIntent.current = 'search';
    }
    if (refinement.current) {
      const pending = refinement.current;
      if (/sem preferencia|tanto faz|qualquer|nao tenho preferencia/.test(normalized)) {
        applyPreference('any');
        return;
      }
      if (pending.stage === 'type') {
        const requested = requestedFlavorType(text);
        const types = [...new Set(pending.options.map(flavorType))];
        const matched = types.filter(type => type === requested || normalized.includes(normalize(type)));
        if (matched.length === 1) { applyPreference(matched[0]); return; }
        append('assistant', 'Você quer juice/líquido, pod descartável ou algum dos outros tipos mostrados acima? Escolha um tipo para continuarmos sem misturar produtos.');
      } else if (pending.stage === 'volume') {
        const volume = normalized.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:ml)?\b/)?.[1];
        const value = volume ? String(Number(volume.replace(',', '.'))) : undefined;
        if (value && pending.options.some(option => flavorVolume(option) === value)) { applyPreference(value); return; }
        append('assistant', 'Qual volume do líquido você prefere? Pode escolher no seletor, digitar os ml ou dizer “qualquer volume”.');
      } else {
        const brands = [...new Set(pending.options.map(option => flavorBrand(option.product)))];
        const typed = normalized.replace(/^(?:quero|prefiro)(?: a)?(?: marca)?\s+/, '').trim();
        const matched = brands.filter(brand => normalized.includes(normalize(brand)) || (typed.length > 1 && normalize(brand).includes(typed)));
        if (matched.length === 1) { applyPreference(matched[0]); return; }
        append('assistant', 'Me diga qual marca prefere entre as opções do seletor acima. Se não tiver uma em mente, pode escolher “Sem preferência”.');
      }
      return;
    }
    if (/^(oi|ola|bom dia|boa tarde|boa noite)[!.\s]*$/.test(normalized)) {
      append('assistant', 'Oi! 😊 Me conta o que você está procurando. Posso ajudar a conhecer os produtos, encontrar os mais vendidos ou mostrar opções parecidas.');
      return;
    }
    const followsRanking = /^e\s+(da|do|de|a|o)\b/.test(normalized) && lastIntent.current === 'bestsellers';
    if (!referencesPrevious(text) && !followsRanking && isNewProductRequest(text, safeProducts)) {
      setSelectedProduct(null);
      lastScope.current = null;
      lastIntent.current = 'search';
    }
    const contextual = parseProductQuestion(text, latestPrevious);
    const flavorQuestion = /\b(sabor\w*|variante\w*|opcoes|opcao)\b/.test(normalized) || safeProducts.some(product => matchingVariants(text, product).some(variant => !!variant.flavor_name));
    const useContext = referencesPrevious(text) && contextual.matches.length > 0;
    const referencedProduct = useContext && contextual.matches.length === 1 ? contextual.matches[0] : contextProduct;
    const parsed = useContext ? contextual : parseProductQuestion(text, safeProducts);
    const intent = followsRanking && parsed.intent === 'search' ? 'bestsellers' : parsed.intent;
    let matches = parsed.matches;
    if (!parsed.hasTerms && lastScope.current && intent === 'bestsellers') matches = lastScope.current;

    if (flavorQuestion && parsed.hasTerms && (intent === 'search' || intent === 'recommend')) {
      const options = matches.flatMap(product => matchingVariants(text, product)
        .filter(variant => !!variant.flavor_name && safeText(variantLabel(variant)))
        .map(variant => ({ product, variant })));
      if (options.length) {
        const requestedType = requestedFlavorType(text);
        const scoped = requestedType ? options.filter(option => flavorType(option) === requestedType) : options;
        if (!scoped.length) {
          append('assistant', 'Não achei esse sabor no tipo de produto que você pediu. Quer tentar outro sabor ou outro tipo?');
          return;
        }
        const types = new Set(scoped.map(flavorType));
        if (types.size > 1) requestPreference('type', scoped);
        else if (/\d+(?:[.,]\d+)?\s*ml\b/.test(normalized) && scoped.length > 3) requestBrand(scoped);
        else requestVolume(scoped);
        return;
      }
    }

    if (intent === 'bestsellers') {
      matches = matches.filter(productAvailable);
      if (!matches.length) { listProducts([]); return; }
      try {
        const ranking = await fetchAssistantRanking();
        if (!alive.current) return;
        const ranked = matches.filter(product => ranking.has(product.id)).sort((a, b) => ranking.get(a.id)! - ranking.get(b.id)! || a.name.localeCompare(b.name));
        lastScope.current = matches;
        lastIntent.current = 'bestsellers';
        if (!ranked.length) {
          append('assistant', 'Ainda não encontrei vendas nos últimos 90 dias para essas opções. Mas posso ajudar você a conhecê-las! Qual chamou sua atenção?', matches.slice(0, 8));
        } else {
          const leaders = ranked.filter(product => ranking.get(product.id) === ranking.get(ranked[0].id));
          const summary = leaders.length === 1 ? `Entre essas opções, quem mais saiu foi ${ranked[0].name}!` : `${leaders.length} opções ficaram empatadas como as mais vendidas!`;
          append('assistant', `${summary}\n\nOlhei a quantidade vendida nos últimos 90 dias, só entre produtos disponíveis e vendas confirmadas, sem kits promocionais. Quer conhecer algum deles?${ranked.length > 8 ? ' Separei os primeiros 8 abaixo.' : ''}`, ranked.slice(0, 8));
        }
      } catch {
        append('assistant', 'Não consegui conferir as vendas agora. Pode tentar de novo em um instante? Prefiro te passar um resultado certinho.');
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
      if (referencedProduct) append('assistant', productInformation(referencedProduct, referencedProduct.id === currentProduct?.id ? currentVariant : undefined), undefined, referencedProduct, referencedProduct.id === currentProduct?.id ? currentVariantId : undefined);
      else append('assistant', 'De qual produto você quer saber? Digite o nome ou escolha um abaixo.', safeProducts.slice(0, 8));
      return;
    }
    lastScope.current = matches;
    lastIntent.current = intent;
    if (matches.length === 1) {
      if (intent === 'details') {
        setSelectedProduct(matches[0]);
        const requested = matchingVariants(text, matches[0]);
        const variant = requested.length === 1 ? requested[0] : undefined;
        append('assistant', `Claro! Olha o que temos sobre esse produto:\n\n${productInformation(matches[0], variant)}`, undefined, matches[0], variant?.id);
      } else {
        offerProduct(matches[0], text);
      }
    } else if (intent === 'recommend') {
      const suggested = !parsed.hasTerms && contextProduct ? relatedProducts(contextProduct, safeProducts) : matches;
      listProducts(suggested, 'Separei algumas opções pelas características do catálogo. Dá uma olhada e me conta qual você quer conhecer! Não é um ranking de vendas ou de qualidade.');
    } else if (matches.length) {
      listProducts(matches);
    } else {
      append('assistant', 'Não achei essa combinação por aqui. Me conta o nome, a marca, o sabor ou o tipo que você procura e vamos tentar de novo 😊');
    }
  };

  const ask = (text: string) => {
    if (responseLocked.current || !text.trim()) return;
    append('user', text);
    void withThinking(() => answer(text));
  };

  const send = () => {
    const text = input.trim();
    if (!text || responseLocked.current) return;
    setInput('');
    ask(text);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4" role="log" aria-label="Conversa com o Assistente DK" aria-live="polite">
        <div className="mb-4 max-w-[95%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-800">
          <p className="font-semibold">Oi{firstName ? `, ${firstName}` : ''}! Sou o Assistente DK 👋</p>
          <p className="mt-2">Que bom ter você por aqui! Me conta o que está procurando. Posso ajudar a conhecer os produtos, descobrir os mais vendidos ou encontrar opções parecidas 😊</p>
          <p className="mt-2 text-xs text-slate-500">Sou um guia automático do catálogo. Para pagamento ou acesso, fale com o suporte.</p>
          {currentProduct && <div className="mt-3 border-t pt-3">
            <p>Vi que você está olhando <strong>{currentProduct.name}</strong>. Quer saber mais sobre ele?</p>
            {currentVariant && <p className="mt-2 text-sm text-slate-600">{currentVariant.flavor_name ? 'Sabor' : 'Opção'} selecionado: <strong>{variantLabel(currentVariant)}</strong> · {currentVariant.stock_quantity > 0 ? 'Disponível' : 'Esgotado'}</p>}
            <Button disabled={busy} variant="outline" className={`mt-2 h-auto whitespace-normal ${assistantOutline}`} onClick={() => chooseProduct(currentProduct)}>Conhecer este produto</Button>
            {!!automaticSuggestions.length && <p className="mt-2 text-xs text-slate-500">Também encontrei estas opções pela categoria, tipo ou marca:</p>}
            {automaticSuggestions.map(product => <Button key={product.id} disabled={busy} variant="outline" className={`mt-2 h-auto w-full justify-start whitespace-normal text-left ${assistantOutline}`} onClick={() => chooseProduct(product)}>{product.name}</Button>)}
          </div>}
        </div>
        {messages.map(message => (
          <div key={message.id} className={`mb-3 max-w-[95%] rounded-2xl p-3 text-sm ${message.sender === 'user' ? 'ml-auto rounded-tr-sm bg-slate-900 text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'}`}>
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
            {message.products && <AssistantProductResults products={message.products} busy={busy} onChoose={chooseProduct} />}
            {message.preference && <AssistantPreferencePrompt preference={message.preference} disabled={busy || activePreference !== message.preference.id} onChoose={(value, label) => choosePreference(message.preference!.id, value, label)} />}
            {message.flavorOptions && <AssistantFlavorResults options={message.flavorOptions} busy={busy} onDetails={showDetails} onVisit={onVisitProduct} />}
            {message.productChoice && <AssistantProductOptions product={message.productChoice} initialVariantId={message.initialVariantId} busy={busy} onDetails={showDetails} onVisit={onVisitProduct} />}
            {message.links && <div className="mt-3 flex flex-col items-start gap-2">
              {message.links.map(link => <Button key={link.href} size="sm" className={`h-auto whitespace-normal text-left ${assistantPrimary}`} asChild>
                <Link to={link.href} aria-disabled={busy} onClick={event => { if (busy) { event.preventDefault(); return; } onVisitProduct(); }}>{link.label}</Link>
              </Button>)}
            </div>}
          </div>
        ))}
        {busy && <div className="mb-3 flex w-fit items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500" role="status">
          <span className="flex gap-1" aria-hidden="true"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" /></span>
          Pensando…
        </div>}
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
          <Input aria-label="Mensagem para o Assistente DK" placeholder="Pergunte sobre produtos, sabores ou mais vendidos…" value={input} maxLength={300} disabled={busy} onChange={event => setInput(event.target.value)} className="min-w-0 text-base text-slate-900" />
          <Button type="submit" size="icon" className={assistantPrimary} disabled={busy || !input.trim()} aria-label="Enviar mensagem"><Send className="h-4 w-4" /></Button>
        </form>
        <Button disabled={busy} variant="ghost" size="sm" className="h-7 !bg-transparent text-xs !text-slate-500 hover:!bg-sky-50" onClick={() => { setMessages([]); setSelectedProduct(null); setInput(''); lastScope.current = null; lastIntent.current = 'search'; refinement.current = null; setActivePreference(null); }}><RotateCcw className="mr-2 h-3 w-3" />Recomeçar conversa</Button>
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
          <DialogDescription>Seu guia de produtos · Vamos encontrar o que você procura</DialogDescription>
        </DialogHeader>
        {open && <AssistantConversation key={user.id} firstName={profile?.id === user.id ? profile.first_name : undefined} onVisitProduct={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
