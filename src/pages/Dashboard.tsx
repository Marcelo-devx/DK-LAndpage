import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  User, 
  ShoppingBag, 
  Star, 
  Users, 
  Ticket, 
  LogOut, 
  Gem,
  ChevronRight,
  Loader2,
  RefreshCw,
  Key
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { showError } from '@/utils/toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const { settings } = useTheme();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError) throw authError;
        
        if (!session) {
          // ensure we clear the loading spinner before navigating to login
          setLoading(false);
          navigate('/login');
          return;
        }

        const [profileRes, ordersRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', session.user.id).single(),
          supabase.from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .or('status.ilike.%aguardando%,status.ilike.%pendente%,status.ilike.%preparação%')
        ]);

        if (profileRes.data) {
            setProfile(profileRes.data);
        } else if (profileRes.error && profileRes.error.code !== 'PGRST116') {
            console.error("Erro ao buscar perfil:", profileRes.error);
        }

        if (ordersRes.count !== null) {
            setPendingOrdersCount(ordersRes.count);
        }
        
    } catch (error: any) {
        console.error("Erro ao carregar dashboard:", error);
        // Não mostramos erro visual intrusivo para não assustar o usuário, 
        // mas logamos e garantimos que a tela carregue o que der.
    } finally {
        setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshTrigger]);

  // Background refresh the dashboard when returning to the app to update counts.
  useEffect(() => {
    let hiddenAt = 0;
    const THRESHOLD_MS = 30_000;
    const isFetchingRefLocal = { current: false };

    const handleVisibility = () => {
      try {
        if (document.hidden) hiddenAt = Date.now();
        else {
          if (!hiddenAt) return;
          const elapsed = Date.now() - hiddenAt;
          hiddenAt = 0;
          if (elapsed > THRESHOLD_MS && !isFetchingRefLocal.current) {
            const schedule = (cb: () => void) => {
              if ((window as any).requestIdleCallback) (window as any).requestIdleCallback(cb, { timeout: 2000 });
              else setTimeout(cb, 500);
            };
            schedule(async () => {
              if (document.visibilityState === 'visible' && !isFetchingRefLocal.current) {
                isFetchingRefLocal.current = true;
                try { await fetchDashboardData(); } finally { isFetchingRefLocal.current = false; }
              }
            });
          }
        }
      } catch (e) {}
    };

    const handleFocus = () => {
      try {
        if (hiddenAt && (Date.now() - hiddenAt) > THRESHOLD_MS && !isFetchingRefLocal.current) {
          const schedule = (cb: () => void) => {
            if ((window as any).requestIdleCallback) (window as any).requestIdleCallback(cb, { timeout: 2000 });
            else setTimeout(cb, 500);
          };
          schedule(async () => {
            if (document.visibilityState === 'visible' && !isFetchingRefLocal.current) {
              isFetchingRefLocal.current = true;
              try { await fetchDashboardData(); } finally { isFetchingRefLocal.current = false; }
            }
          });
          hiddenAt = 0;
        }
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => { document.removeEventListener('visibilitychange', handleVisibility); window.removeEventListener('focus', handleFocus); };
  }, [fetchDashboardData]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Dashboard] signOut error:', err);
      // show a non-blocking error so user knows something went wrong
      showError('Erro ao encerrar sessão. Tentando forçar logout...');
    }

    // Navigate to login page after logout
    navigate('/login');
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        <p className="text-stone-400 text-xs font-bold uppercase tracking-widest animate-pulse">Carregando seus dados...</p>
      </div>
    );
  }

  const menuItems = [
    {
      title: 'Meus Dados',
      description: 'Edite seu nome, endereço e telefone',
      icon: User,
      link: '/perfil',
      color: 'text-blue-500 bg-blue-100',
      notification: false
    },
    {
      title: 'Minhas Compras',
      description: 'Acompanhe seus pedidos e entregas',
      icon: ShoppingBag,
      link: '/compras',
      color: 'text-green-600 bg-green-100',
      notification: pendingOrdersCount > 0
    },
    {
      title: 'DK Clube',
      description: 'Troque pontos e suba de nível',
      icon: Ticket,
      link: '/clube-dk',
      color: 'text-sky-600 bg-sky-100',
      notification: false
    },
    {
      title: 'Minhas Avaliações',
      description: 'Veja os produtos que você avaliou',
      icon: Star,
      link: '/perfil?tab=reviews',
      color: 'text-yellow-600 bg-yellow-100',
      notification: false
    },
    {
      title: 'Indicar Amigos',
      description: 'Ganhe pontos convidando pessoas',
      icon: Users,
      link: '/indicacoes',
      color: 'text-purple-600 bg-purple-100',
      notification: false
    },
    {
      title: 'Segurança',
      description: 'Alterar sua senha e ajustes de segurança',
      icon: Key,
      link: '/dashboard/security',
      color: 'text-rose-600 bg-rose-100',
      notification: false
    }
  ];

  return (
    <div className="container mx-auto px-3 md:px-6 py-4 md:py-10 max-w-4xl text-charcoal-gray">
      <header className="mb-6 md:mb-12 relative">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl md:text-4xl font-black tracking-tighter mb-1 italic uppercase text-charcoal-gray leading-tight">
                {settings.dashboardGreeting}, {profile?.first_name || 'Membro'}!
                </h1>
                <p className="text-stone-500 font-medium text-sm md:text-base">{settings.dashboardSubtitle}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-stone-400 hover:text-sky-500 shrink-0 ml-2">
                <RefreshCw className="h-5 w-5" />
            </Button>
        </div>
        
        <div className="mt-4 md:mt-8 bg-white border border-stone-200 rounded-2xl md:rounded-[2rem] p-4 md:p-8 flex flex-col md:flex-row items-center justify-between shadow-xl gap-4">
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <div className="bg-sky-100 p-3 md:p-4 rounded-xl md:rounded-2xl shrink-0">
              <Gem className="h-7 w-7 md:h-10 md:w-10 text-sky-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-stone-400 text-[10px] font-black uppercase tracking-[0.2em]">{settings.dashboardPointsLabel}</p>
                {profile?.current_tier_name && (
                    <span className="bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">{profile.current_tier_name}</span>
                )}
              </div>
              <p className="text-4xl md:text-5xl font-black tracking-tighter text-charcoal-gray">
                {profile?.points || 0} <span className="text-lg md:text-xl text-sky-500 italic">PTS</span>
              </p>
            </div>
          </div>
          <Button 
            asChild
            size="lg"
            className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest px-6 md:px-8 h-12 md:h-14 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.3)] transition-all active:scale-95 w-full md:w-auto text-xs md:text-sm"
          >
            <Link to="/clube-dk">{settings.dashboardButtonText}</Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {menuItems.map((item, index) => (
          <Link key={index} to={item.link} className="group">
            <Card className="bg-white border border-stone-200 hover:border-sky-500/50 hover:shadow-lg transition-all duration-300 rounded-2xl overflow-hidden relative h-full">
              <CardContent className="p-4 md:p-6 flex items-center justify-between">
                <div className="flex items-center space-x-3 md:space-x-5 min-w-0">
                  <div className={`p-3 md:p-4 rounded-xl ${item.color} relative transition-transform group-hover:scale-110 shrink-0`}>
                    <item.icon className="h-5 w-5 md:h-6 md:w-6" />
                    {item.notification && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-charcoal-gray uppercase tracking-tight text-sm md:text-lg group-hover:text-sky-500 transition-colors leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs md:text-sm text-stone-500 font-medium leading-snug mt-0.5">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-stone-400 group-hover:text-sky-500 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </CardContent>
            </Card>
          </Link>
        ))}

        <button 
          onClick={handleLogout}
          className="text-left w-full group"
        >
          <Card className="bg-red-50 border border-red-100 hover:border-red-300 hover:bg-red-100 transition-all duration-300 rounded-2xl h-full">
            <CardContent className="p-4 md:p-6 flex items-center justify-between">
              <div className="flex items-center space-x-3 md:space-x-5">
                <div className="p-3 md:p-4 rounded-xl bg-red-200 text-red-600 transition-transform group-hover:scale-110 shrink-0">
                  <LogOut className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <h3 className="font-black text-red-600 uppercase tracking-tight text-sm md:text-lg">Sair</h3>
                  <p className="text-xs md:text-sm text-red-400 font-medium mt-0.5">Encerrar sua sessão</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-red-300 group-hover:text-red-500 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;