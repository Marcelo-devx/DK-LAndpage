import { useEffect } from "react";
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
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import AdminCustomizer from "./components/AdminCustomizer";
import EmailConfirm from "./pages/EmailConfirm";
import { AgeVerificationProvider } from "./context/AgeVerificationContext";
import MaintenanceScreen from "./components/MaintenanceScreen";

const queryClient = new QueryClient();

const AppContent = () => {
  const { settings } = useTheme();

  if (settings.maintenanceMode) {
    return (
      <>
        <MaintenanceScreen />
        <AdminCustomizer />
      </>
    );
  }

  return (
    <>
      <AdminCustomizer />
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
            <AgeVerificationProvider>
              <AuthEventHandler />
              <AppContent />
            </AgeVerificationProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;