import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, UserPlus, Gift, Share2 } from 'lucide-react';
import { showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface Referral {
  referred_email: string;
  status: 'pending' | 'registered' | 'completed';
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

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
  const [copied, setCopied] = useState(false);
  const [siteUrl, setSiteUrl] = useState<string>(window.location.origin);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

      // Busca a URL do site nas configurações para usar em produção
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

      const { data: referralsData } = await supabase
        .from('referrals')
        .select(`
          referred_email,
          status,
          profiles ( first_name, last_name )
        `)
        .eq('referrer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (referralsData) setReferrals(referralsData as any[] || []);

      setLoading(false);
    };
    fetchData();
  }, [navigate]);

  const referralLink = referralCode
    ? `${siteUrl}/login?ref=${referralCode}&view=sign_up`
    : '';

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    showSuccess('Link de indicação copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Venha fazer parte do CLUB DK!',
          text: '🎁 Use meu link exclusivo para se cadastrar e ganhar benefícios!',
          url: referralLink,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 text-charcoal-gray">
      <Card className="max-w-4xl mx-auto bg-white border border-stone-200 shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 md:p-12 text-center border-b border-stone-100 bg-stone-50">
          <div className="inline-flex p-4 bg-sky-100 rounded-3xl mb-6">
            <Share2 className="h-10 w-10 text-sky-500" />
          </div>
          <CardTitle className="font-black text-4xl md:text-5xl tracking-tighter italic uppercase mb-4 text-charcoal-gray">
            Indique um Amigo.
          </CardTitle>
          <CardDescription className="text-stone-500 text-lg font-medium max-w-xl mx-auto">
            Expanda nossa comunidade e ganhe{' '}
            <span className="text-sky-500 font-black">200 PTS</span> por cada
            primeira compra realizada através do seu link.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 md:p-12 space-y-12">
          {/* Link exclusivo */}
          <div className="bg-stone-50 p-8 rounded-3xl border border-stone-200">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-stone-400 mb-4">
              Seu Link Exclusivo
            </h3>
            <div className="flex items-center gap-3">
              {loading ? (
                <Skeleton className="h-14 w-full bg-stone-200 rounded-xl" />
              ) : (
                <div className="relative flex-grow min-w-0">
                  <Input
                    value={referralLink}
                    readOnly
                    className="bg-white border-stone-200 h-14 rounded-xl font-bold text-sky-600 shadow-sm focus:ring-sky-500/20 focus:border-sky-500 text-sm truncate"
                  />
                </div>
              )}

              {/* Copiar */}
              <Button
                onClick={handleCopy}
                size="icon"
                title="Copiar link"
                className="h-14 w-14 bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-lg shrink-0 transition-all active:scale-95"
              >
                {copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
              </Button>

              {/* Compartilhar (WhatsApp / nativo) */}
              <Button
                onClick={handleShare}
                size="icon"
                title="Compartilhar"
                className="h-14 w-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-lg shrink-0 transition-all active:scale-95"
              >
                <Share2 className="h-6 w-6" />
              </Button>
            </div>

            <p className="text-xs text-stone-400 font-medium mt-4">
              Compartilhe este link. Quando seu amigo se cadastrar e fizer a{' '}
              <span className="font-black text-sky-500">primeira compra</span>, você
              ganha <span className="font-black text-sky-500">200 pontos</span>{' '}
              automaticamente!
            </p>
          </div>

          {/* Lista de indicações */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-stone-400">
                Suas Indicações
              </h3>
              <Badge
                variant="outline"
                className="border-stone-200 text-stone-500 font-bold"
              >
                {referrals.length} total
              </Badge>
            </div>

            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full bg-stone-100 rounded-2xl" />
                <Skeleton className="h-20 w-full bg-stone-100 rounded-2xl" />
              </div>
            ) : referrals.length > 0 ? (
              <div className="grid gap-4">
                {referrals.map((referral, index) => {
                  const statusInfo = getStatusInfo(referral.status);
                  const displayName =
                    referral.profiles
                      ? `${referral.profiles.first_name || ''} ${referral.profiles.last_name || ''}`.trim() ||
                        referral.referred_email
                      : referral.referred_email;
                  return (
                    <div
                      key={index}
                      className="p-5 flex items-center justify-between bg-stone-50 border border-stone-100 rounded-2xl hover:border-sky-500/30 transition-all group hover:bg-white hover:shadow-md"
                    >
                      <div className="flex items-center space-x-5">
                        <div
                          className={cn(
                            'p-3 rounded-xl transition-transform group-hover:scale-110',
                            referral.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-white text-stone-400 border border-stone-100'
                          )}
                        >
                          {referral.status === 'completed' ? (
                            <Gift className="h-6 w-6" />
                          ) : (
                            <UserPlus className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-charcoal-gray uppercase tracking-tight text-base">
                            {displayName}
                          </p>
                          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-0.5">
                            {referral.status === 'pending'
                              ? 'Aguardando cadastro'
                              : 'Membro da Rede'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          'px-4 py-1.5 text-[10px] font-black border uppercase tracking-widest',
                          statusInfo.color
                        )}
                      >
                        {statusInfo.text}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 border border-dashed border-stone-300 rounded-3xl bg-stone-50/50">
                <p className="text-stone-500 font-medium italic">
                  Você ainda não indicou nenhum amigo.
                </p>
                <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-2">
                  Compartilhe seu link para começar a ganhar!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralsPage;