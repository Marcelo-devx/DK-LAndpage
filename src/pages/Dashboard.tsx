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
  Loader2
} from 'lucide-react';
import CouponsModal from '@/components/CouponsModal';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [isCouponsModalOpen, setIsCouponsModalOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
      return;
    }

    const [profileRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .or('status.ilike.%aguardando%,status.ilike.%pendente%')
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (ordersRes.count !== null) setPendingOrdersCount(ordersRes.count);
    
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  const menuItems = [
    {
      title: 'Meus Dados',
      description: 'Edite seu nome, endereço e telefone',
      icon: User,
      link: '/perfil',
      color: 'text-blue-600 bg-blue-50',
      notification: false
    },
    {
      title: 'Minhas Compras',
      description: 'Acompanhe seus pedidos e entregas',
      icon: ShoppingBag,
      link: '/compras',
      color: 'text-green-600 bg-green-50',
      notification: pendingOrdersCount > 0
    },
    {
      title: 'Minhas Avaliações',
      description: 'Veja os produtos que você avaliou',
      icon: Star,
      link: '/perfil?tab=reviews',
      color: 'text-yellow-600 bg-yellow-50',
      notification: false
    },
    {
      title: 'Indicar Amigos',
      description: 'Ganhe pontos convidando pessoas',
      icon: Users,
      link: '/indicacoes',
      color: 'text-purple-600 bg-purple-50',
      notification: false
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="mb-12">
        <h1 className="text-4xl font-black tracking-tighter mb-2 italic uppercase text-slate-900">
          Olá, {profile?.first_name || 'Membro'}!
        </h1>
        <p className="text-slate-500 font-medium">Bem-vindo à sua conta exclusiva DKCWB.</p>
        
        <div className="mt-8 bg-white border border-slate-200 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between shadow-xl">
          <div className="flex items-center space-x-6 mb-6 md:mb-0">
            <div className="bg-sky-50 p-4 rounded-2xl">
              <Gem className="h-10 w-10 text-sky-600" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">Saldo acumulado</p>
              <p className="text-5xl font-black tracking-tighter text-slate-900">
                {profile?.points || 0} <span className="text-xl text-sky-600 italic">PTS</span>
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setIsCouponsModalOpen(true)}
            size="lg"
            className="bg-sky-600 hover:bg-sky-700 text-white font-black uppercase tracking-widest px-8 h-14 rounded-xl shadow-lg transition-all active:scale-95"
          >
            Resgatar Cupons
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {menuItems.map((item, index) => (
          <Link key={index} to={item.link} className="group">
            <Card className="bg-white border border-slate-200 hover:border-sky-300 hover:shadow-lg transition-all duration-300 rounded-2xl overflow-hidden relative">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center space-x-5">
                  <div className={`p-4 rounded-xl ${item.color} relative transition-transform group-hover:scale-110`}>
                    <item.icon className="h-6 w-6" />
                    {item.notification && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg group-hover:text-sky-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </Link>
        ))}

        <button 
          onClick={() => setIsCouponsModalOpen(true)}
          className="text-left w-full group"
        >
          <Card className="bg-white border border-slate-200 hover:border-sky-300 hover:shadow-lg transition-all duration-300 rounded-2xl h-full">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <div className="p-4 rounded-xl bg-sky-50 text-sky-600 transition-transform group-hover:scale-110">
                  <Ticket className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg group-hover:text-sky-600 transition-colors">Cupons</h3>
                  <p className="text-sm text-slate-500 font-medium">Troque pontos por descontos</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </button>

        <button 
          onClick={handleLogout}
          className="text-left w-full group"
        >
          <Card className="bg-red-50 border border-red-100 hover:border-red-200 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <div className="p-4 rounded-xl bg-red-100 text-red-600 transition-transform group-hover:scale-110">
                  <LogOut className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-red-600 uppercase tracking-tight text-lg">Sair</h3>
                  <p className="text-sm text-slate-500 font-medium">Encerrar sua sessão</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-red-200 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </button>
      </div>

      <CouponsModal
        isOpen={isCouponsModalOpen}
        onOpenChange={setIsCouponsModalOpen}
        userPoints={profile?.points}
        onRedemption={fetchDashboardData} 
      />
    </div>
  );
};

export default Dashboard;