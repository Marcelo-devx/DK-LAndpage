import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, MapPin, Search, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { maskCep } from '@/utils/masks';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

export interface DeliveryAddress {
  id?: string; // undefined = profile address or new address
  source: 'profile' | 'saved' | 'new';
  label?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface SavedAddress {
  id: string;
  label: string | null;
  cep: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

interface ProfileAddress {
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

interface DeliveryAddressModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (address: DeliveryAddress) => void;
}

const MAX_SAVED_ADDRESSES = 5;

const BRAZILIAN_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

function formatAddressLine(addr: { street: string; number: string; neighborhood: string; city: string; state: string }) {
  return `${addr.street}, ${addr.number} — ${addr.neighborhood}, ${addr.city}/${addr.state}`;
}

export function DeliveryAddressModal({ isOpen, onOpenChange, onConfirm }: DeliveryAddressModalProps) {
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [profileAddress, setProfileAddress] = useState<ProfileAddress | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string>('profile'); // 'profile' | saved address id
  const [showNewForm, setShowNewForm] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New address form state
  const [newCep, setNewCep] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newComplement, setNewComplement] = useState('');
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const hasProfileAddress = !!(
    profileAddress?.street &&
    profileAddress?.number &&
    profileAddress?.neighborhood &&
    profileAddress?.city &&
    profileAddress?.state
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const [profileRes, savedRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('cep, street, number, complement, neighborhood, city, state')
          .eq('id', session.user.id)
          .single(),
        supabase
          .from('user_addresses')
          .select('id, label, cep, street, number, complement, neighborhood, city, state')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false }),
      ]);

      const profile = profileRes.data as ProfileAddress | null;
      setProfileAddress(profile);
      setSavedAddresses((savedRes.data as SavedAddress[]) || []);

      // Default selection: profile if it has address, otherwise first saved, otherwise show new form
      const hasProfile = !!(profile?.street && profile?.number && profile?.neighborhood && profile?.city && profile?.state);
      if (hasProfile) {
        setSelectedId('profile');
      } else if (savedRes.data && savedRes.data.length > 0) {
        setSelectedId(savedRes.data[0].id);
      } else {
        setSelectedId('new');
        setShowNewForm(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      // Reset new form
      setNewCep('');
      setNewStreet('');
      setNewNumber('');
      setNewComplement('');
      setNewNeighborhood('');
      setNewCity('');
      setNewState('');
      setSaveAddress(false);
      setNewLabel('');
      setShowNewForm(false);
    }
  }, [isOpen, fetchData]);

  const handleCepLookup = async () => {
    const clean = newCep.replace(/\D/g, '');
    if (clean.length !== 8) { showError('CEP inválido.'); return; }
    setIsFetchingCep(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-cep', { body: { cep: clean } });
      if (error || !data) { showError('Endereço não encontrado.'); return; }
      setNewStreet(data.logradouro || '');
      setNewNeighborhood(data.bairro || '');
      setNewCity(data.localidade || '');
      setNewState(data.uf || '');
    } catch {
      showError('Erro ao buscar CEP.');
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('user_addresses').delete().eq('id', id);
      if (error) throw error;
      setSavedAddresses(prev => prev.filter(a => a.id !== id));
      if (selectedId === id) {
        setSelectedId(hasProfileAddress ? 'profile' : 'new');
        if (!hasProfileAddress) setShowNewForm(true);
      }
    } catch {
      showError('Erro ao remover endereço.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirm = async () => {
    if (selectedId === 'profile') {
      if (!hasProfileAddress || !profileAddress) return;
      onConfirm({
        source: 'profile',
        cep: profileAddress.cep || '',
        street: profileAddress.street!,
        number: profileAddress.number!,
        complement: profileAddress.complement || undefined,
        neighborhood: profileAddress.neighborhood!,
        city: profileAddress.city!,
        state: profileAddress.state!,
      });
      onOpenChange(false);
      return;
    }

    if (selectedId === 'new') {
      // Validate new address
      if (!newStreet.trim() || !newNumber.trim() || !newNeighborhood.trim() || !newCity.trim() || !newState.trim()) {
        showError('Preencha todos os campos obrigatórios do endereço.');
        return;
      }

      // Save if requested
      if (saveAddress) {
        if (savedAddresses.length >= MAX_SAVED_ADDRESSES) {
          showError(`Você já tem ${MAX_SAVED_ADDRESSES} endereços salvos. Remova um para adicionar outro.`);
          return;
        }
        setIsSaving(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) throw new Error('Sessão expirada.');
          const { error } = await supabase.from('user_addresses').insert({
            user_id: session.user.id,
            label: newLabel.trim() || null,
            cep: newCep.replace(/\D/g, '') || null,
            street: newStreet.trim(),
            number: newNumber.trim(),
            complement: newComplement.trim() || null,
            neighborhood: newNeighborhood.trim(),
            city: newCity.trim(),
            state: newState.trim().toUpperCase(),
          });
          if (error) throw error;
          showSuccess('Endereço salvo com sucesso!');
        } catch (e: any) {
          showError(e.message || 'Erro ao salvar endereço.');
          setIsSaving(false);
          return;
        } finally {
          setIsSaving(false);
        }
      }

      onConfirm({
        source: 'new',
        label: newLabel.trim() || undefined,
        cep: newCep.replace(/\D/g, ''),
        street: newStreet.trim(),
        number: newNumber.trim(),
        complement: newComplement.trim() || undefined,
        neighborhood: newNeighborhood.trim(),
        city: newCity.trim(),
        state: newState.trim().toUpperCase(),
      });
      onOpenChange(false);
      return;
    }

    // Saved address
    const saved = savedAddresses.find(a => a.id === selectedId);
    if (!saved) return;
    onConfirm({
      id: saved.id,
      source: 'saved',
      label: saved.label || undefined,
      cep: saved.cep || '',
      street: saved.street,
      number: saved.number,
      complement: saved.complement || undefined,
      neighborhood: saved.neighborhood,
      city: saved.city,
      state: saved.state,
    });
    onOpenChange(false);
  };

  const canAddMore = savedAddresses.length < MAX_SAVED_ADDRESSES;

  const content = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-2 pb-4 border-b border-stone-100 shrink-0">
        <div className="p-2.5 bg-sky-100 rounded-xl">
          <MapPin className="h-5 w-5 text-sky-600" />
        </div>
        <div>
          <p className="font-black text-lg uppercase tracking-tight text-charcoal-gray leading-none">Endereço de Entrega</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Onde quer receber seu pedido?</p>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
          </div>
        ) : (
          <>
            {/* Profile address card */}
            {hasProfileAddress && profileAddress && (
              <button
                type="button"
                onClick={() => { setSelectedId('profile'); setShowNewForm(false); }}
                className={cn(
                  'w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 min-h-[56px]',
                  selectedId === 'profile'
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-stone-200 bg-white hover:border-sky-200'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {selectedId === 'profile'
                      ? <CheckCircle2 className="h-5 w-5 text-sky-500" />
                      : <Circle className="h-5 w-5 text-stone-300" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-1">Endereço Principal</p>
                    <p className="text-sm font-bold text-slate-800 leading-snug">
                      {profileAddress.street}, {profileAddress.number}
                      {profileAddress.complement ? `, ${profileAddress.complement}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {profileAddress.neighborhood} — {profileAddress.city}, {profileAddress.state}
                      {profileAddress.cep ? ` · CEP ${maskCep(profileAddress.cep)}` : ''}
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* Saved addresses */}
            {savedAddresses.map(addr => (
              <div key={addr.id} className="relative">
                <button
                  type="button"
                  onClick={() => { setSelectedId(addr.id); setShowNewForm(false); }}
                  className={cn(
                    'w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 min-h-[56px]',
                    selectedId === addr.id
                      ? 'border-sky-400 bg-sky-50'
                      : 'border-stone-200 bg-white hover:border-sky-200'
                  )}
                >
                  <div className="flex items-start gap-3 pr-10">
                    <div className="mt-0.5 shrink-0">
                      {selectedId === addr.id
                        ? <CheckCircle2 className="h-5 w-5 text-sky-500" />
                        : <Circle className="h-5 w-5 text-stone-300" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      {addr.label && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{addr.label}</p>
                      )}
                      <p className="text-sm font-bold text-slate-800 leading-snug">
                        {addr.street}, {addr.number}
                        {addr.complement ? `, ${addr.complement}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {addr.neighborhood} — {addr.city}, {addr.state}
                        {addr.cep ? ` · CEP ${maskCep(addr.cep)}` : ''}
                      </p>
                    </div>
                  </div>
                </button>
                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDeleteSaved(addr.id)}
                  disabled={deletingId === addr.id}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Remover endereço"
                >
                  {deletingId === addr.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </button>
              </div>
            ))}

            {/* Add new address button */}
            {!showNewForm && (
              <button
                type="button"
                onClick={() => {
                  if (!canAddMore) {
                    showError(`Limite de ${MAX_SAVED_ADDRESSES} endereços atingido. Remova um para adicionar outro.`);
                    return;
                  }
                  setShowNewForm(true);
                  setSelectedId('new');
                }}
                disabled={!canAddMore}
                className={cn(
                  'w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all duration-200 font-bold text-sm',
                  canAddMore
                    ? 'border-stone-300 text-slate-500 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50'
                    : 'border-stone-200 text-stone-300 cursor-not-allowed'
                )}
              >
                <Plus className="h-4 w-4" />
                {canAddMore ? 'Adicionar endereço' : `Limite de ${MAX_SAVED_ADDRESSES} endereços atingido`}
              </button>
            )}

            {/* New address form (expandable) — sem overflow-hidden para não cortar o footer */}
            {showNewForm && (
              <div
                className={cn(
                  'rounded-2xl border-2 transition-all duration-300',
                  selectedId === 'new' ? 'border-sky-400 bg-sky-50/30' : 'border-stone-200 bg-white'
                )}
              >
                {/* Form header — clickable to select */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setSelectedId('new')}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="shrink-0">
                      {selectedId === 'new'
                        ? <CheckCircle2 className="h-5 w-5 text-sky-500" />
                        : <Circle className="h-5 w-5 text-stone-300" />
                      }
                    </div>
                    <p className="text-sm font-black uppercase tracking-tight text-slate-700">Novo endereço</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewForm(false);
                      if (selectedId === 'new') setSelectedId(hasProfileAddress ? 'profile' : savedAddresses[0]?.id || 'profile');
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest shrink-0 px-2 py-1"
                  >
                    Cancelar
                  </button>
                </div>

                {/* Form fields */}
                <div className="px-4 pb-4 space-y-3">
                  {/* CEP */}
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">CEP <span className="text-red-500">*</span></Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={newCep}
                        onChange={e => setNewCep(maskCep(e.target.value))}
                        inputMode="numeric"
                        placeholder="00000-000"
                        className="text-base rounded-xl h-12 flex-1"
                        maxLength={9}
                      />
                      <Button
                        type="button"
                        onClick={handleCepLookup}
                        disabled={isFetchingCep}
                        className="h-12 w-12 shrink-0 rounded-xl bg-sky-500 hover:bg-sky-400 text-white"
                      >
                        {isFetchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Street + Number — rua readonly (preenchida pelo CEP), número editável */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Rua <span className="text-red-500">*</span></Label>
                      <Input
                        value={newStreet}
                        onChange={e => setNewStreet(e.target.value)}
                        placeholder="Busque pelo CEP"
                        readOnly
                        className="text-base rounded-xl h-12 mt-1 bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Nº <span className="text-red-500">*</span></Label>
                      <Input
                        value={newNumber}
                        onChange={e => setNewNumber(e.target.value)}
                        placeholder="123"
                        inputMode="numeric"
                        className="text-base rounded-xl h-12 mt-1"
                      />
                    </div>
                  </div>

                  {/* Complement — editável */}
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Complemento <span className="text-slate-400 font-medium normal-case">(opcional)</span></Label>
                    <Input
                      value={newComplement}
                      onChange={e => setNewComplement(e.target.value)}
                      placeholder="Apto, bloco, casa..."
                      className="text-base rounded-xl h-12 mt-1"
                    />
                  </div>

                  {/* Neighborhood + City — readonly (preenchidos pelo CEP) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Bairro <span className="text-red-500">*</span></Label>
                      <Input
                        value={newNeighborhood}
                        onChange={e => setNewNeighborhood(e.target.value)}
                        placeholder="Busque pelo CEP"
                        readOnly
                        className="text-base rounded-xl h-12 mt-1 bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Cidade <span className="text-red-500">*</span></Label>
                      <Input
                        value={newCity}
                        onChange={e => setNewCity(e.target.value)}
                        placeholder="Busque pelo CEP"
                        readOnly
                        className="text-base rounded-xl h-12 mt-1 bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  {/* State — readonly (preenchido pelo CEP) */}
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Estado <span className="text-red-500">*</span></Label>
                    <Input
                      value={newState}
                      onChange={e => setNewState(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="Busque pelo CEP"
                      readOnly
                      maxLength={2}
                      className="text-base rounded-xl h-12 mt-1 uppercase bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>

                  {/* Save toggle */}
                  <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 px-4 py-3 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💾</span>
                      <Label className="text-xs font-black uppercase tracking-tight text-slate-700 cursor-pointer">
                        Salvar para próximas compras
                      </Label>
                    </div>
                    <Switch
                      checked={saveAddress}
                      onCheckedChange={setSaveAddress}
                    />
                  </div>

                  {/* Label field (shown when save is on) */}
                  {saveAddress && (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Identificação</Label>
                      <div className="flex gap-2">
                        {['Casa', 'Trabalho', 'Outro'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setNewLabel(opt)}
                            className={cn(
                              'flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-tight border-2 transition-all',
                              newLabel === opt
                                ? 'border-sky-400 bg-sky-50 text-sky-700'
                                : 'border-stone-200 bg-white text-slate-500 hover:border-sky-200'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Ou escreva um nome..."
                        className="text-sm rounded-xl h-10"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky footer — confirm button — sempre visível */}
      <div className="shrink-0 px-4 py-4 border-t border-stone-100 bg-white">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={
            loading ||
            isSaving ||
            (!hasProfileAddress && selectedId === 'profile') ||
            (selectedId === 'new' && (
              !newStreet.trim() ||
              !newNumber.trim() ||
              !newNeighborhood.trim() ||
              !newCity.trim() ||
              !newState.trim()
            ))
          }
          className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-[0.15em] text-base rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <MapPin className="h-5 w-5" />
              Confirmar Endereço
            </>
          )}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[92dvh] p-0 rounded-t-3xl flex flex-col bg-white border-t border-stone-200"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-stone-300" />
          </div>
          <SheetHeader className="sr-only">
            <SheetTitle>Endereço de Entrega</SheetTitle>
            <SheetDescription>Selecione ou adicione um endereço de entrega</SheetDescription>
          </SheetHeader>
          <div className="flex-1 flex flex-col min-h-0">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white rounded-[2rem] shadow-2xl border-stone-200 p-0 max-h-[88vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Endereço de Entrega</DialogTitle>
          <DialogDescription>Selecione ou adicione um endereço de entrega</DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-col min-h-0">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}