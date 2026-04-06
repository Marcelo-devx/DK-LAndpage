import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const InformacoesPage = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-black py-16 md:py-24 border-b border-white/10">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 xl:px-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-sky-500/10 p-3 rounded-xl border border-sky-500/20">
              <Info className="h-8 w-8 text-sky-500" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black italic tracking-tighter uppercase text-white">
                Informações
              </h1>
              <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-sky-500 mt-1">
                Da Loja
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 xl:px-12 py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:gap-10">

          {/* Segunda a Sexta */}
          <Card className="bg-gradient-to-br from-slate-900 to-black border-white/10 overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white">
                Como Funcionam as entregas: - De Segunda a Sexta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                De Segunda a Sexta
                <br />
                Faça pedido até as 14:00h, os pedidos são separados e feito a rota de entrega para cada motoboy.
                <br />
                As 15:30 a rota se inicia, vai chegar um e-mail pra você (verifique a caixa de spam), com link para acompanhar a rota e horario estimado de entrega.
                <br />
                Curitiba: das 15:30 as 18:30.
                <br />
                Região Metropolitana: Pode passar das 18:30.
              </p>
            </CardContent>
          </Card>

          {/* Sabado */}
          <Card className="bg-gradient-to-br from-slate-900 to-black border-white/10 overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white">
                Sábado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                Sábado
                <br />
                Faça pedido até as 12:30h, os pedidos são separados e feito a rota de entrega para cada motoboy.
                <br />
                As 13:30h a rota se inicia, vai chegar um e-mail pra você (verifique a caixa de spam), com o link para acompanhar a rota e horario estimado de entrega.
                <br />
                Curitiba: das 13:30 as 18h
                <br />
                Região Metropolitana: Pode passar das 18h.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default InformacoesPage;