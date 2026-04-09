import { useEffect, Suspense, lazy } from "react";
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
import AllProductsPage from "./pages/AllProductsPage";
import LoyaltyClubPage from "./pages/LoyaltyClubPage";
import MyCouponsPage from "./pages/MyCouponsPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import InformacoesPage from "./pages/InformacoesPage";
import UpdatePassword from "./pages/UpdatePassword";
import AuthEventHandler from "./components/AuthEventHandler";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ImageCacheProvider } from "./context/ImageCacheContext";
import LoyaltyButton from "./components/LoyaltyButton";

// Lazy loading para rotas menos críticas
const ConfirmacaoPedido = lazy(() => import("./pages/ConfirmacaoPedido"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const ReferralsPage = lazy(() => import("./pages/ReferralsPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardSecurity = lazy(() => import("./pages/DashboardSecurity"));
const AdminLogistics = lazy(() => import("./pages/AdminLogistics"));
const EmailConfirm = lazy(() => import("./pages/EmailConfirm"));
const TestEdgeFunction = lazy(() => import("./pages/TestEdgeFunction"));

// Componentes de layout/admin mantidos síncronos para UX imediata
import MaintenanceScreen from "./components/MaintenanceScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminCustomizer from "./components/AdminCustomizer";
import { useMercadoPagoRedirect } from "./hooks/useMercadoPagoRedirect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection time
    },
  },
});

// Loading component para Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
  </div>
);

const AppContent = () => {
  useMercadoPagoRedirect();

  const { settings } = useTheme();
  const { isAdmin } = useAuth();

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

  if (settings.maintenanceMode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  // Otherwise render full app (admins and normal operation)
  return (
    <>
      <AdminCustomizer />
      <Suspense fallback={<PageLoader />}>
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
            <Route path="/meus-cupons" element={<MyCouponsPage />} />
            <Route path="/como-funciona" element={<HowItWorksPage />} />
            <Route path="/informacoes" element={<InformacoesPage />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/admin/logistica" element={<AdminLogistics />} />
          <Route path="/auth/confirm" element={<EmailConfirm />} />
          <Route path="/test-edge-function" element={<TestEdgeFunction />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <LoyaltyButton />
    </>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <ImageCacheProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ScrollToTop />
                <AuthProvider>
                  <AuthEventHandler />
                  <AppContent />
                </AuthProvider>
              </BrowserRouter>
            </ImageCacheProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;