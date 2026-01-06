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
      return { text: 'Pendente', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' };
    case 'registered':
      return { text: 'Cadastrado', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' };
    case 'completed':
      return { text: 'Recompensa Recebida', color: 'text-green-400 bg-green-400/10 border-green-400/20' };
    default:
      return { text: 'Desconhecido', color: 'text-slate-400 bg-white/5' };
  }
};

const ReferralsPage = () => {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

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

  const referralLink = referralCode ? `${window.location.origin}/login?ref=${referralCode}&view=sign_up` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    showSuccess('Link de indicação copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 text-white">
      <Card className="max-w-4xl mx-auto bg-white/5 border border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
        <CardHeader className="p-8 md:p-12 text-center border-b border-white/5 bg-white/[0.02]">
          <div className="inline-flex p-4 bg-sky-500/20 rounded-3xl mb-6">
            <Share2 className="h-10 w-10 text-sky-400" />
          </div>
          <CardTitle className="font-black text-4xl md:text-5xl tracking-tighter italic uppercase mb-4">Indique um Amigo.</CardTitle>
          <CardDescription className="text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Expanda nossa comunidade e ganhe <span className="text-sky-400 font-black">200 PTS</span> por cada primeira compra realizada através do seu link.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 md:p-12 space-y-12">
          <div className="bg-slate-950/50 p-8 rounded-3xl border border-white/5">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Seu Link Exclusivo</h3>
            <div className="flex items-center space-x-3">
              {loading ? (
                <Skeleton className="h-14 w-full bg-white/5 rounded-xl" />
              ) : (
                <div className="relative flex-grow">
                  <Input value={referralLink} readOnly className="bg-slate-950 border-white/10 h-14 rounded-xl pr-12 font-medium text-sky-400" />
                </div>
              )}
              <Button onClick={handleCopy} size="icon" className="h-14 w-14 bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-lg shrink-0">
                {copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Suas Indicações</h3>
                <Badge variant="outline" className="border-white/10 text-slate-400 font-bold">{referrals.length} total</Badge>
            </div>
            
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full bg-white/5 rounded-2xl" />
                <Skeleton className="h-20 w-full bg-white/5 rounded-2xl" />
              </div>
            ) : referrals.length > 0 ? (
              <div className="grid gap-4">
                {referrals.map((referral, index) => {
                  const statusInfo = getStatusInfo(referral.status);
                  const displayName = referral.profiles 
                    ? `${referral.profiles.first_name || ''} ${referral.profiles.last_name || ''}`.trim()
                    : referral.referred_email;
                  return (
                    <div key={index} className="p-5 flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl hover:border-sky-500/30 transition-all group">
                      <div className="flex items-center space-x-5">
                        <div className={cn(
                          "p-3 rounded-xl transition-transform group-hover:scale-110",
                          referral.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-slate-500'
                        )}>
                          {referral.status === 'completed' ? <Gift className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
                        </div>
                        <div>
                          <p className="font-black text-white uppercase tracking-tight text-base">{displayName}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {referral.status === 'pending' ? 'Aguardando cadastro' : 'Membro da Rede'}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn("px-4 py-1.5 text-[10px] font-black border uppercase tracking-widest", statusInfo.color)}>
                        {statusInfo.text}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl">
                <p className="text-slate-500 font-medium italic">Você ainda não indicou nenhum amigo.</p>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-2">Compartilhe seu link para começar a ganhar!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralsPage;