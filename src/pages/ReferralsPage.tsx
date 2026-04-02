import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, UserPlus, Gift, Share2 } from 'lucide-react';
import { showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Referral {
  id?: number;
  referred_id?: string | null;
  referred_email?: string | null;
  status: 'pending' | 'registered' | 'completed';
  created_at?: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

const REWARD_POINTS = 200;

const getStatusInfo = (status: 'pending' | 'registered' | 'completed') => {
  switch (status) {
    case 'pending':
      return { text: 'Pendente', color: 'text-orange-600 bg-orange-100 border-orange-200' };
    case 'registered':
      return { text: 'Cadastrado', color: 'text-sky-600 bg-sky-100 border-sky-200' };
    case 'completed':
      return { text: 'Recompensa Recebida', color: 'text-emerald-600 bg-emerald-100 border-emerald-200' };
    default:
      return { text: 'Desconhecido', color: 'text-slate-500 bg-slate-100' };
  }
};

const ReferralsPage = () => {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [siteUrl, setSiteUrl] = useState<string>(window.location.origin);
  const [activeTab, setActiveTab] = useState<'all'|'pending'|'registered'|'completed'>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate('/login'); return; }

        const { data: siteUrlSetting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'site_url')
          .single();

        if (siteUrlSetting?.value) {
          setSiteUrl(siteUrlSetting.value.replace(/\/$/, ''));
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('referral_code')
          .eq('id', session.user.id)
          .single();

        if (profileData) setReferralCode(profileData.referral_code);

        // Fetch referrals in a robust way: basic columns first
        const { data: basicRefs, error: refsError } = await supabase
          .from('referrals')
          .select('id, referred_id, referred_email, status, created_at')
          .eq('referrer_id', session.user.id)
          .order('created_at', { ascending: false });

        if (refsError) {
          console.error('[ReferralsPage] error fetching referrals', refsError);
          setReferrals([]);
          setLoading(false);
          return;
        }

        const refs = (basicRefs || []) as Referral[];

        // If we have referred_ids, fetch their profiles in batch
        const referredIds = refs.map(r => r.referred_id).filter(Boolean) as string[];
        let profilesMap: Record<string, any> = {};
        if (referredIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', referredIds as string[]);

          if (profilesError) {
            console.error('[ReferralsPage] error fetching referred profiles', profilesError);
          } else if (profilesData) {
            profilesMap = (profilesData as any[]).reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, any>);
          }
        }

        // Merge profiles into referrals
        const merged = refs.map(r => ({ ...r, profiles: r.referred_id ? profilesMap[r.referred_id] ?? null : null }));

        console.debug('[ReferralsPage] fetched referrals:', merged);
        setReferrals(merged as Referral[]);

      } catch (err) {
        console.error('[ReferralsPage] unexpected error', err);
        setReferrals([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const referralLink = referralCode
    ? `${siteUrl}/login?ref=${referralCode}&view=sign_up`
    : '';

  // compute stats
  const totalReferrals = referrals.length;
  const registeredCount = referrals.filter(r => r.status === 'registered').length;
  const pendingCount = referrals.filter(r => r.status === 'pending').length;
  const completedCount = referrals.filter(r => r.status === 'completed').length;
  const pointsToReceive = registeredCount * REWARD_POINTS; // registered => eligible when they purchase
  const pointsEarned = completedCount * REWARD_POINTS;

  const filteredReferrals = referrals.filter(r => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'registered') return r.status === 'registered';
    if (activeTab === 'completed') return r.status === 'completed';
    return true;
  });

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    showSuccess('Link de indicação copiado!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCodeCopied(true);
    showSuccess('Código copiado!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Venha fazer parte do CLUB DK!',
          text: `🎁 Use meu código ${referralCode} para se cadastrar e ganhar benefícios!`,
          url: referralLink,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 text-charcoal-gray">
      <Card className="max-w-2xl mx-auto bg-white border border-stone-200 shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 md:p-10 text-center border-b border-stone-100 bg-gradient-to-br from-sky-50 to-stone-50">
          <div className="inline-flex p-4 bg-sky-100 rounded-3xl mb-5 mx-auto">
            <Share2 className="h-9 w-9 text-sky-500" />
          </div>
          <CardTitle className="font-black text-4xl md:text-5xl tracking-tighter italic uppercase mb-3 text-charcoal-gray">
            Indique um Amigo.
          </CardTitle>
          <CardDescription className="text-stone-500 text-base font-medium max-w-sm mx-auto">
            Ganhe <span className="text-sky-500 font-black">{REWARD_POINTS} pontos</span> por cada amigo que fizer a primeira compra pelo seu link.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 md:p-10 space-y-8">

          {/* Código em destaque */}
          <div className="bg-gradient-to-br from-sky-500 to-sky-600 p-8 rounded-3xl text-white text-center shadow-lg shadow-sky-200 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-100 mb-5 relative z-10">
              Seu Código de Indicação
            </p>
            {loading ? (
              <Skeleton className="h-16 w-48 bg-white/20 rounded-2xl mx-auto" />
            ) : (
              <button
                onClick={handleCopyCode}
                className="relative z-10 group inline-flex items-center gap-3 bg-white/15 hover:bg-white/25 border border-white/25 rounded-2xl px-8 py-4 transition-all active:scale-95 cursor-pointer"
              >
                <span className="text-4xl font-black tracking-[0.25em] uppercase font-mono">
                  {referralCode || '------'}
                </span>
                <span className="text-white/60 group-hover:text-white transition-colors">
                  {codeCopied
                    ? <Check className="h-5 w-5 text-emerald-300" />
                    : <Copy className="h-5 w-5" />
                  }
                </span>
              </button>
            )}
            <p className="text-xs text-sky-200 font-medium mt-4 relative z-10">
              Toque no código para copiar
            </p>
          </div>

          {/* Points summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <div className="text-xs font-bold uppercase text-emerald-600">Pontos Ganhos</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-2">{pointsEarned}</div>
              <div className="text-xs text-emerald-500 mt-1">{completedCount} indicacões completadas</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 text-center">
              <div className="text-xs font-bold uppercase text-yellow-600">Pontos a Receber</div>
              <div className="text-2xl font-extrabold text-yellow-700 mt-2">{pointsToReceive}</div>
              <div className="text-xs text-yellow-500 mt-1">{registeredCount} aguardando compra</div>
            </div>
          </div>

          {/* Tabs / Filters */}
          <div className="flex gap-3 items-center">
            <button className={`px-3 py-2 rounded-full text-xs font-bold ${activeTab==='all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setActiveTab('all')}>Todos</button>
            <button className={`px-3 py-2 rounded-full text-xs font-bold ${activeTab==='pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`} onClick={() => setActiveTab('pending')}>Pendentes ({pendingCount})</button>
            <button className={`px-3 py-2 rounded-full text-xs font-bold ${activeTab==='registered' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`} onClick={() => setActiveTab('registered')}>Cadastrados ({registeredCount})</button>
            <button className={`px-3 py-2 rounded-full text-xs font-bold ${activeTab==='completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`} onClick={() => setActiveTab('completed')}>Recompensados ({completedCount})</button>
            <div className="ml-auto text-xs text-stone-400">{totalReferrals} total</div>
          </div>

          {/* Botões de ação */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCopyLink}
              size="lg"
              disabled={loading || !referralLink}
              className="h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-wider text-xs gap-2 transition-all active:scale-95"
            >
              {linkCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {linkCopied ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button
              onClick={handleShare}
              size="lg"
              disabled={loading || !referralLink}
              className="h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black uppercase tracking-wider text-xs gap-2 transition-all active:scale-95"
            >
              <Share2 className="h-5 w-5" />
              Compartilhar
            </Button>
          </div>

          {/* Como funciona */}
          <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 mb-4">Como funciona</p>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Compartilhe seu código ou link com amigos' },
                { step: '2', text: 'Seu amigo se cadastra usando seu link' },
                { step: '3', text: 'Na primeira compra dele, você ganha 200 pontos!' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-sky-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                    {step}
                  </div>
                  <p className="text-sm text-stone-600 font-medium">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* List */}
          <div>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full bg-stone-100 rounded-2xl" />
                <Skeleton className="h-20 w-full bg-stone-100 rounded-2xl" />
              </div>
            ) : filteredReferrals.length > 0 ? (
              <div className="grid gap-3">
                {filteredReferrals.map((referral, index) => {
                  const statusInfo = getStatusInfo(referral.status);
                  const displayName = (referral.profiles && (referral.profiles.first_name || referral.profiles.last_name))
                    ? `${referral.profiles.first_name || ''} ${referral.profiles.last_name || ''}`.trim()
                    : (referral.referred_email || '—');

                  const pendingRow = referral.status === 'pending';

                  return (
                    <div key={index} className={`p-5 flex items-center justify-between rounded-2xl transition-all group ${pendingRow ? 'bg-yellow-50 border border-yellow-200' : 'bg-stone-50 border border-stone-100'} hover:shadow-md`}>
                      <div className="flex items-center space-x-4">
                        <div className={cn('p-3 rounded-xl transition-transform group-hover:scale-110', referral.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-stone-400 border border-stone-100')}>
                          {referral.status === 'completed' ? <Gift className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-black text-charcoal-gray uppercase tracking-tight text-sm">{displayName}</p>
                          {referral.referred_email && referral.referred_email !== displayName && (
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">{referral.referred_email}</p>
                          )}
                          <p className="text-[10px] text-stone-400 mt-1">{format(new Date(referral.created_at || ''), 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                      </div>
                      <Badge className={cn('px-3 py-1 text-[10px] font-black border uppercase tracking-widest', statusInfo.color)}>{statusInfo.text}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-14 border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                <UserPlus className="h-8 w-8 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500 font-medium text-sm">Você ainda não indicou ninguém.</p>
                <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Compartilhe seu código para começar!</p>
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralsPage;