import { useEffect, useState, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProductPage from "./pages/ProductPage";
import PromotionPage from "./pages/PromotionPage";
import MainLayout from "./components/MainLayout";
import Login from "./pages/Login";
import ProfilePage from "./pages/ProfilePage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import ConfirmacaoPedido from "./pages/ConfirmacaoPedido";
import AllProductsPage from "./pages/AllProductsPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import ReferralsPage from "./pages/ReferralsPage";
import Dashboard from "./pages/Dashboard";
import LoyaltyClubPage from "./pages/LoyaltyClubPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import AdminLogistics from "./pages/AdminLogistics";
import UpdatePassword from "./pages/UpdatePassword";
import AuthEventHandler from "./components/AuthEventHandler";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import AdminCustomizer from "./components/AdminCustomizer";
import EmailConfirm from "./pages/EmailConfirm";
import MaintenanceScreen from "./components/MaintenanceScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { supabase } from "./integrations/supabase/client";
import DashboardSecurity from "./pages/DashboardSecurity";
import { useMercadoPagoRedirect } from "./hooks/useMercadoPagoRedirect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppContent = () => {
  useMercadoPagoRedirect();

  const { settings } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const adminCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Registra quando o usuário sai da aba para que o AgeVerificationPopup
  // saiba que ele voltou recentemente e não exiba o popup novamente
  useEffect(() => {
    const handleVisibilityChange = () => {
      try {
        if (document.hidden) {
          sessionStorage.setItem('left_at', String(Date.now()));
        }
      } catch (e) { /* noop */ }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (adminCheckTimeoutRef.current) {
        clearTimeout(adminCheckTimeoutRef.current);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          setIsAdmin(false);
          return;
        }

        const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!error && data?.role === 'adm') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        console.error('[App] failed to determine admin role', e);
        setIsAdmin(false);
      }
    };

    // Executa inicialmente
    checkAdmin();

    const listener = supabase.auth.onAuthStateChange((event) => {
      console.log('[App] Auth state event:', event);
      
      try {
        // TOKEN_REFRESHED não requer re-verificação — evita re-render ao voltar de outra aba
        // SIGNED_IN só precisa re-verificar se era diferente de logged antes
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          checkAdmin();
        }
      } catch (e) {
        console.error('[App] Error handling auth state change:', e);
      }
    });

    return () => {
      if (adminCheckTimeoutRef.current) {
        clearTimeout(adminCheckTimeoutRef.current);
      }
      try {
        const subscription = (listener as any)?.data?.subscription ?? (listener as any)?.subscription ?? null;
        if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
        else if ((listener as any)?.unsubscribe) (listener as any).unsubscribe();
      } catch (e) {
        console.warn('[App] failed to unsubscribe auth listener', e);
      }
    };
  }, []);

  if (settings.maintenanceMode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  // Otherwise render the full app (admins and normal operation)
  return (
    <>
      <AdminCustomizer />
      <ErrorBoundary>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/produtos" element={<AllProductsPage />} />
            <Route path="/produto/:id" element={<ProductPage />} />
            <Route path="/promocao/:id" element={<PromotionPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/compras" element={<OrdersPage />} />
            <Route path="/pedidos" element={<Navigate to="/compras" replace />} />
            <Route path="/confirmacao-pedido/:id" element={<ConfirmacaoPedido />} />
            <Route path="/indicacoes" element={<ReferralsPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/security" element={<DashboardSecurity />} />
            <Route path="/clube-dk" element={<LoyaltyClubPage />} />
            <Route path="/como-funciona" element={<HowItWorksPage />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/admin/logistica" element={<AdminLogistics />} />
          <Route path="/auth/confirm" element={<EmailConfirm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AuthEventHandler />
            <AppContent />
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;