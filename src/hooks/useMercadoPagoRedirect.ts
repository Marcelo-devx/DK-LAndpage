import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook para tratar redirecionamentos do Mercado Pago
 * Detecta query params na URL e redireciona para a página de confirmação
 */
export const useMercadoPagoRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      
      // Lista de parâmetros que podem indicar um redirecionamento do Mercado Pago
      const hasAnyMpParam = params.has('collection_id') ||
        params.has('collection_status') ||
        params.has('payment_id') ||
        params.has('status') ||
        params.has('external_reference') ||
        params.has('external-reference') ||
        params.has('externalReference') ||
        params.has('external_ref') ||
        params.has('external_reference_id');

      // Se não tiver nenhum parâmetro do MP, não faz nada
      if (!hasAnyMpParam) {
        return;
      }

      // Busca o ID do pedido (external_reference ou similar)
      const externalRef = params.get('external_reference') ||
        params.get('external-reference') ||
        params.get('externalReference') ||
        params.get('external_ref') ||
        params.get('external_reference_id') ||
        params.get('collection_id') ||
        params.get('payment_id');

      // Busca o status
      const status = (params.get('status') || params.get('collection_status') || '').toLowerCase();

      // Se o status for 'approved' e tiver um external_ref, redireciona para confirmação
      if (externalRef && status === 'approved') {
        console.log('[useMercadoPagoRedirect] Redirecionando para /confirmacao-pedido/', externalRef);
        navigate(`/confirmacao-pedido/${externalRef}`, { replace: true });
      }
    } catch (e) {
      console.warn('[useMercadoPagoRedirect] Erro ao processar redirecionamento:', e);
    }
  }, [location.search, navigate]);
};