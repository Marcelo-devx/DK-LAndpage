import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { AssistantProduct, AssistantVariant } from '@/hooks/use-assistant-products';
import { safeText, variantLabel } from '@/lib/product-assistant';

export const assistantOutline = '!border-slate-200 !bg-white !text-slate-800 shadow-sm hover:!border-sky-300 hover:!bg-sky-50 hover:!text-sky-900';
export const assistantPrimary = '!bg-sky-600 !text-white hover:!bg-sky-700';

interface Props {
  product: AssistantProduct;
  initialVariantId?: string;
  busy: boolean;
  onDetails: (product: AssistantProduct, variant?: AssistantVariant) => void;
  onVisit: () => void;
  compact?: boolean;
}

export default function AssistantProductOptions({ product, initialVariantId, busy, onDetails, onVisit, compact = false }: Props) {
  const { user } = useAuth();
  const variants = product.variants.filter(variant => safeText(variant.flavor_name || '') && safeText(variant.color || '') && safeText(variant.size || ''));
  const [selectedId, setSelectedId] = useState(initialVariantId || '');
  const selected = variants.find(variant => variant.id === selectedId);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [returned, setReturned] = useState(false);
  const [feedback, setFeedback] = useState('');
  const outOfStock = !returned && (selected ? selected.stock_quantity <= 0 : !product.variants.length && product.stock_quantity <= 0);
  const needsVariant = product.variants.length > 0 && !selected;
  const href = `/produto/${product.id}${selected ? `?variant=${encodeURIComponent(selected.id)}` : ''}`;

  useEffect(() => {
    let active = true;
    setSaved(false);
    setFeedback('');
    setReturned(false);
    if (!user || !outOfStock || needsVariant) { setChecking(false); return; }
    setChecking(true);
    const check = async () => {
      let query = supabase.from('product_reservations').select('id').eq('user_id', user.id).eq('product_id', product.id).eq('status', 'active');
      query = selected ? query.eq('variant_id', selected.id) : query.is('variant_id', null);
      const { data, error } = await query.maybeSingle();
      if (active) { setSaved(!error && !!data); setChecking(false); }
    };
    void check();
    return () => { active = false; };
  }, [user?.id, product.id, selectedId]);

  const notify = async () => {
    if (!user || needsVariant || saved || saving || busy) return;
    setSaving(true);
    setFeedback('');
    try {
      const { data: currentProduct, error: productError } = await supabase.from('products').select('id, stock_quantity').eq('id', product.id).eq('is_visible', true).single();
      if (productError || !currentProduct) throw productError || new Error('Produto indisponível');
      let stock = currentProduct.stock_quantity;
      if (selected) {
        const { data, error } = await supabase.from('product_variants').select('stock_quantity').eq('id', selected.id).eq('product_id', product.id).eq('is_active', true).single();
        if (error || !data) throw error || new Error('Opção indisponível');
        stock = data.stock_quantity;
      }
      if (stock > 0) {
        setReturned(true);
        setFeedback('Boa notícia: essa opção já está disponível! Você pode visitar a página para conferir.');
        return;
      }
      const { error } = await supabase.from('product_reservations').insert({
        user_id: user.id,
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url,
        variant_id: selected?.id ?? null,
        variant_name: selected ? variantLabel(selected) : null,
        status: 'active',
      });
      if (error && error.code !== '23505') throw error;
      setSaved(true);
      setFeedback('Prontinho! Seu aviso de reposição está cadastrado para essa opção. Você pode acompanhá-lo em Itens reservados.');
    } catch {
      setFeedback('Não consegui cadastrar o aviso agora. Pode tentar novamente?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {!compact && !!variants.length && <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Escolha o sabor ou a opção:</p>
        <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto p-1">
          {variants.map(variant => <Button key={variant.id} disabled={busy || saving} size="sm" variant="outline" aria-pressed={selectedId === variant.id} className={`h-auto flex-col items-start gap-1 whitespace-normal text-left ${selectedId === variant.id ? '!border-sky-500 !bg-sky-50 !text-sky-900 ring-1 ring-sky-500' : assistantOutline}`} onClick={() => setSelectedId(variant.id)}>
            <span>{variantLabel(variant)}</span>
            <span className={`text-[10px] ${variant.stock_quantity > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{variant.stock_quantity > 0 ? 'Disponível' : 'Esgotado · Avise-me'}</span>
          </Button>)}
        </div>
      </div>}
      {!compact && selected && <p className="text-sm text-slate-700"><strong>{selected.flavor_name ? 'Sabor' : 'Opção'}:</strong> {variantLabel(selected)}.</p>}
      {outOfStock && <p className="text-sm text-slate-600">{selected ? 'Essa opção está esgotada' : 'Esse produto está esgotado'} no momento. Quer que a loja avise quando chegar?</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className={assistantPrimary} asChild><Link to={href} aria-disabled={busy || saving} onClick={event => { if (busy || saving) { event.preventDefault(); return; } onVisit(); }}><ExternalLink className="mr-1 h-3 w-3" />Visitar produto no site</Link></Button>
        <Button disabled={busy || saving || needsVariant} size="sm" variant="outline" className={assistantOutline} onClick={() => onDetails(product, selected)}>Quero saber mais</Button>
        {outOfStock && <Button disabled={busy || saving || checking || saved} size="sm" variant="outline" className={assistantOutline} onClick={() => void notify()}>
          {saving || checking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : saved ? <Check className="mr-1 h-3 w-3" /> : <Bell className="mr-1 h-3 w-3" />}
          {saved ? 'Aviso cadastrado' : saving ? 'Cadastrando…' : 'Avise-me quando chegar'}
        </Button>}
      </div>
      {feedback && <p className="text-xs text-slate-600" role="status">{feedback}</p>}
      {saved && <Link to="/itens-reservados" onClick={onVisit} className="inline-block text-xs text-sky-700 underline">Ver meus avisos de reposição</Link>}
    </div>
  );
}
