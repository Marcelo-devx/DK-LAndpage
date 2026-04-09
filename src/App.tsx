import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load all pages for better initial load performance
const Index = lazy(() => import("./pages/Index"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const PromotionPage = lazy(() => import("./pages/PromotionPage"));
const Login = lazy(() => import("./pages/Login"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const ConfirmacaoPedido = lazy(() => import("./pages/ConfirmacaoPedido"));
const AllProductsPage = lazy(() => import("./pages/AllProductsPage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const ReferralsPage = lazy(() => import("./pages/ReferralsPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LoyaltyClubPage = lazy(() => import("./pages/LoyaltyClubPage"));
const MyCouponsPage = lazy(() => import("./pages/MyCouponsPage"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage"));
const InformacoesPage = lazy(() => import("./pages/InformacoesPage"));
const AdminLogistics = lazy(() => import("./pages/AdminLogistics"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const TestEdgeFunction = lazy(() => import("./pages/TestEdgeFunction"));
const EmailConfirm = lazy(() => import("./pages/EmailConfirm"));

// Non-lazy loaded components (needed for layout)
import MainLayout from "./components/MainLayout";
import NotFound from "./pages/NotFound";
import AuthEventHandler from "./components/AuthEventHandler";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AdminCustomizer from "./components/AdminCustomizer";
import MaintenanceScreen from "./components/MaintenanceScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardSecurity from "./pages/DashboardSecurity";
import { useMercadoPagoRedirect } from "./hooks/useMercadoPagoRedirect";
import { ImageCacheProvider } from "./context/ImageCacheContext";
import LoyaltyButton from "./components/LoyaltyButton";

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

// Loading component for lazy-loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-off-white">
    <div className="space-y-4 w-full max-w-md px-4">
      <Skeleton className="h-12 w-12 rounded-full mx-auto" />
      <Skeleton className="h-4 w-3/4 mx-auto" />
    </div>
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
  );
};

export default App;