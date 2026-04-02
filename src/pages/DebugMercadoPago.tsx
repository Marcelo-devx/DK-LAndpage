import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

/**
 * PÁGINA DE DIAGNÓSTICO ISOLADA - NÃO INTERFERE NO FLUXO NORMAL
 * 
 * Esta página é apenas para visualização de informações de redirecionamento
 * do Mercado Pago. Não modifica nada no fluxo de pagamento.
 * 
 * Para usar: acesse manualmente /debug-mp/ID_DO_PEDIDO ou /debug-mp/
 */
const DebugMercadoPago = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    console.log('=== DIAGNÓSTICO DEBUG MERCADO PAGO ===');
    console.log('ID do pedido:', id);
    console.log('Query params do Mercado Pago:');
    searchParams.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('URL completa:', window.location.href);
    console.log('User Agent:', navigator.userAgent);
    console.log('=======================================');
  }, [id, searchParams]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          🔍 Diagnóstico Mercado Pago
        </h1>

        <div className="space-y-6">
          {/* ID do Pedido */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">ID do Pedido</h2>
            <p className="text-blue-900 font-mono text-lg">{id || 'Não informado'}</p>
          </div>

          {/* URL Completa */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">URL Completa</h2>
            <p className="text-gray-900 font-mono text-sm break-all">{window.location.href}</p>
          </div>

          {/* Query Params do Mercado Pago */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-green-800 mb-2">Query Params (do Mercado Pago)</h2>
            {Array.from(searchParams.entries()).length > 0 ? (
              <div className="space-y-2">
                {Array.from(searchParams.entries()).map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 bg-white p-2 rounded border border-green-100">
                    <span className="font-mono font-semibold text-green-700">{key}:</span>
                    <span className="font-mono text-green-600">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-green-900">Nenhum query parameter encontrado</p>
            )}
          </div>

          {/* Informações de Sessão */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">Informações de Sessão</h2>
            <div className="space-y-1 text-yellow-900 text-sm">
              <p><strong>Pathname:</strong> {window.location.pathname}</p>
              <p><strong>Hash:</strong> {window.location.hash || '(nenhum)'}</p>
              <p><strong>Ts do carregamento:</strong> {Date.now()}</p>
              <p><strong>SessionStorage key:</strong> mp_diag_{id}</p>
            </div>
          </div>

          {/* Ações */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-purple-800 mb-2">Ações de Diagnóstico</h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  sessionStorage.removeItem(`mp_diag_${id}`);
                  window.location.reload();
                }}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded transition"
              >
                🔄 Limpar SessionStorage e Recarregar
              </button>
              <button
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition ml-0 sm:ml-2"
              >
                🏠 Ir para Dashboard
              </button>
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-orange-800 mb-2">📋 Instruções</h2>
            <ol className="list-decimal list-inside text-orange-900 space-y-1 text-sm">
              <li>Faça uma compra de teste usando cartão de crédito</li>
              <li>Deixe o Mercado Pago redirecionar de volta</li>
              <li>Se ocorrer looping, abra o console do navegador (F12)</li>
              <li>Envie os logs e prints do console</li>
              <li>Esta página NÃO interfere no fluxo normal</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugMercadoPago;
