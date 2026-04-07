import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';

const TestEdgeFunction = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info' | null;
    data: any;
  }>({ type: null, data: null });

  const FUNCTION_URL = 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/process-mercadopago-payment';

  const testFunction = async () => {
    setLoading(true);
    setResult({ type: null, data: null });

    try {
      // Teste 1: OPTIONS (preflight)
      console.log('[Test] Enviando requisição OPTIONS...');
      const optionsResponse = await fetch(FUNCTION_URL, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type',
        },
      });

      console.log('[Test] Resposta OPTIONS:', optionsResponse.status, optionsResponse.statusText);

      // Verificar headers CORS
      const corsHeaders = {
        'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': optionsResponse.headers.get('Access-Control-Allow-Headers'),
      };

      console.log('[Test] Headers CORS:', corsHeaders);

      // Teste 2: POST (vai falhar sem dados válidos, mas deve responder com CORS ok)
      console.log('[Test] Enviando requisição POST...');
      const postResponse = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          token: 'test',
          payment_method_id: 'visa',
          installments: 1,
          external_reference: 'test',
          transaction_amount: 1,
        }),
      });

      console.log('[Test] Resposta POST:', postResponse.status, postResponse.statusText);
      const postData = await postResponse.json();
      console.log('[Test] Dados POST:', postData);

      // Verificar se CORS está configurado corretamente
      const originAllowed = corsHeaders['Access-Control-Allow-Origin'] === window.location.origin;

      if (originAllowed) {
        setResult({
          type: 'success',
          data: {
            corsHeaders,
            optionsStatus: optionsResponse.status,
            postStatus: postResponse.status,
            postData,
            currentOrigin: window.location.origin,
          },
        });
      } else {
        setResult({
          type: 'error',
          data: {
            corsHeaders,
            expectedOrigin: window.location.origin,
            message: corsHeaders['Access-Control-Allow-Origin']
              ? `Origem retornada: ${corsHeaders['Access-Control-Allow-Origin']}`
              : 'Origem não definida nos headers CORS',
          },
        });
      }
    } catch (error: any) {
      console.error('[Test] Erro:', error);
      setResult({
        type: 'error',
        data: {
          error: error.message,
          details: error.toString(),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result.type) return null;

    if (result.type === 'success') {
      return (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-800">✅ CORS Configurado Corretamente!</AlertTitle>
          <AlertDescription className="text-green-700">
            <div className="mt-4 space-y-3">
              <div>
                <strong>Origem permitida:</strong> {result.data.currentOrigin}
              </div>
              <div>
                <strong>Origem retornada:</strong> {result.data.corsHeaders['Access-Control-Allow-Origin']}
              </div>
              <div>
                <strong>Métodos permitidos:</strong> {result.data.corsHeaders['Access-Control-Allow-Methods']}
              </div>
              <div>
                <strong>Headers permitidos:</strong> {result.data.corsHeaders['Access-Control-Allow-Headers']}
              </div>
              <div>
                <strong>Status OPTIONS:</strong> {result.data.optionsStatus} {result.data.optionsStatus === 204 ? '(✓)' : '(⚠)'}
              </div>
              <div>
                <strong>Status POST:</strong> {result.data.postStatus}
              </div>
              <div className="mt-4 pt-4 border-t border-green-200">
                <strong className="text-green-900">Resposta da função:</strong>
                <pre className="mt-2 p-3 bg-green-100 rounded text-xs overflow-auto">
                  {JSON.stringify(result.data.postData, null, 2)}
                </pre>
              </div>
              <div className="mt-4 pt-4 border-t border-green-200">
                <strong className="text-green-900">🎉 Parabéns!</strong>
                <p className="mt-1">
                  A configuração de CORS está correta. O pagamento com cartão de crédito deve funcionar
                  agora em todos os dispositivos!
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    if (result.type === 'error') {
      return (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-800">❌ Erro de CORS Detectado</AlertTitle>
          <AlertDescription className="text-red-700">
            <div className="mt-4 space-y-3">
              <div>
                <strong>Origem esperada:</strong> {result.data.expectedOrigin || window.location.origin}
              </div>
              {result.data.message && (
                <div>
                  <strong>Mensagem:</strong> {result.data.message}
                </div>
              )}
              {result.data.error && (
                <div className="mt-4 pt-4 border-t border-red-200">
                  <strong>Erro:</strong> {result.data.error}
                  <pre className="mt-2 p-3 bg-red-100 rounded text-xs overflow-auto">
                    {result.data.details}
                  </pre>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-red-200">
                <strong className="text-red-900">O que fazer:</strong>
                <ol className="mt-2 list-decimal list-inside space-y-1">
                  <li>Verifique se a função foi re-deployada:</li>
                  <code className="ml-6 block text-xs">supabase functions deploy process-mercadopago-payment</code>
                  <li className="mt-2">Aguarde 2-3 minutos para o deploy processar</li>
                  <li>Verifique o secret ALLOWED_ORIGINS no Supabase Dashboard</li>
                  <li>Teste novamente</li>
                </ol>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card className="p-6 shadow-lg">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🧪 Teste da Edge Function - Mercado Pago</h1>
          <p className="text-gray-600">
            Esta página verifica se a configuração de CORS está correta para permitir pagamentos com cartão de crédito.
          </p>
        </Card>

        {/* Info Card */}
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-900">URL da Função</AlertTitle>
          <AlertDescription className="text-blue-800">
            <code className="text-sm">{FUNCTION_URL}</code>
          </AlertDescription>
        </Alert>

        {/* Test Button */}
        <Card className="p-6 shadow-lg">
          <div className="flex items-center justify-center">
            <Button
              onClick={testFunction}
              disabled={loading}
              size="lg"
              className="min-w-[200px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                'Testar Conexão'
              )}
            </Button>
          </div>
        </Card>

        {/* Result */}
        {result.type && (
          <Card className="p-6 shadow-lg">
            {renderResult()}
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-6 shadow-lg bg-white/50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Como usar</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Clique no botão <strong>"Testar Conexão"</strong></li>
            <li>Aguarde os resultados aparecerem abaixo</li>
            <li>Veja se a configuração de CORS está correta</li>
            <li>Se estiver verde ✅, você pode testar o checkout com cartão</li>
            <li>Se estiver vermelho ❌, siga as instruções para corrigir</li>
          </ol>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔧 Debug</h3>
            <p className="text-gray-700 text-sm mb-2">
              Abra o console do navegador (F12) para ver logs detalhados de cada requisição.
            </p>
          </div>
        </Card>

        {/* Current Origin */}
        <Card className="p-4 shadow-md bg-white/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Origem atual:</span>
            <code className="bg-white px-3 py-1 rounded border">{window.location.origin}</code>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TestEdgeFunction;
