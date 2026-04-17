import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const TestEdgeFunction = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ fn: string; ok: boolean; data: any; time: number }>>([]);

  const addResult = (fn: string, ok: boolean, data: any, time: number) => {
    setResults(prev => [{ fn, ok, data, time }, ...prev]);
  };

  const testHealthCheck = async () => {
    setLoading('health-check');
    const t0 = Date.now();
    try {
      const res = await supabase.functions.invoke('health-check', { body: {} });
      addResult('health-check', !res.error && res.data?.ok, res, Date.now() - t0);
    } catch (e: any) {
      addResult('health-check', false, { exception: e?.message }, Date.now() - t0);
    } finally {
      setLoading(null);
    }
  };

  const testGenerateToken = async () => {
    if (!email) return alert('Informe um e-mail');
    setLoading('generate-token');
    const t0 = Date.now();
    try {
      const res = await supabase.functions.invoke('generate-token', {
        body: { email, type: 'signup_otp', expires_in_seconds: 600 },
      });
      addResult('generate-token', !res.error && !!res.data?.code, res, Date.now() - t0);
    } catch (e: any) {
      addResult('generate-token', false, { exception: e?.message }, Date.now() - t0);
    } finally {
      setLoading(null);
    }
  };

  const testSendEmail = async () => {
    if (!email) return alert('Informe um e-mail');
    setLoading('send-email');
    const t0 = Date.now();
    try {
      const res = await supabase.functions.invoke('send-email-via-resend', {
        body: { to: email, subject: 'Teste DKCWB', type: 'otp', code: '123456' },
      });
      addResult('send-email-via-resend', !res.error && res.data?.success, res, Date.now() - t0);
    } catch (e: any) {
      addResult('send-email-via-resend', false, { exception: e?.message }, Date.now() - t0);
    } finally {
      setLoading(null);
    }
  };

  const testForgotPassword = async () => {
    if (!email) return alert('Informe um e-mail');
    setLoading('forgot-password');
    const t0 = Date.now();
    try {
      const res = await supabase.functions.invoke('forgot-password', {
        body: { email },
      });
      addResult('forgot-password', !res.error && res.data?.success, res, Date.now() - t0);
    } catch (e: any) {
      addResult('forgot-password', false, { exception: e?.message }, Date.now() - t0);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-1">🔧 Diagnóstico — Login / E-mail</h1>
          <p className="text-slate-500 text-sm mb-4">Teste as edge functions individualmente para identificar onde está o erro.</p>

          <div className="space-y-2 mb-6">
            <Label>E-mail para teste</Label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={testHealthCheck} disabled={!!loading} variant="default" className="bg-slate-700">
              {loading === 'health-check' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              0. Health Check (verifica variáveis de ambiente)
            </Button>
            <Button onClick={testGenerateToken} disabled={!!loading} variant="outline">
              {loading === 'generate-token' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              1. Testar generate-token (gera código OTP)
            </Button>
            <Button onClick={testSendEmail} disabled={!!loading} variant="outline">
              {loading === 'send-email' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              2. Testar send-email-via-resend (envia e-mail)
            </Button>
            <Button onClick={testForgotPassword} disabled={!!loading} variant="outline">
              {loading === 'forgot-password' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              3. Testar forgot-password (recuperar senha)
            </Button>
          </div>
        </Card>

        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-slate-700">Resultados:</h2>
            {results.map((r, i) => (
              <Card key={i} className={`p-4 border-2 ${r.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {r.ok
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <XCircle className="h-5 w-5 text-red-600" />}
                  <span className="font-bold">{r.fn}</span>
                  <span className="text-xs text-slate-500 ml-auto">{r.time}ms</span>
                </div>
                <pre className="text-xs overflow-auto bg-white/70 rounded p-2 max-h-48">
                  {JSON.stringify(r.data, null, 2)}
                </pre>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestEdgeFunction;