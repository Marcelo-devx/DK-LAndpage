import { Info, Truck, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const InformacoesPage = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-black py-16 md:py-20 lg:py-24 border-b border-white/10">
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
      <div className="container mx-auto px-4 md:px-6 lg:px-8 xl:px-12 py-16 md:py-20 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-stretch">

          {/* Segunda a Sexta */}
          <Card className="bg-gradient-to-br from-slate-900 to-black border-white/5 overflow-hidden shadow-lg">
            <CardHeader className="flex items-center gap-4 pb-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-sky-500/10 border border-sky-500/20">
                <Truck className="h-6 w-6 text-sky-400" />
              </div>
              <CardTitle className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white">
                De Segunda a Sexta
              </CardTitle>
            </CardHeader>

            <CardContent className="p-8 md:p-10 min-h-[240px] flex flex-col justify-center">
              <div className="space-y-4 text-base md:text-lg leading-7 text-slate-300">
                <p>
                  Faça pedido até as <span className="font-bold text-white">14:00h</span>. Os pedidos são separados e montamos a rota de entrega para cada motoboy.
                </p>

                <p>
                  Às <span className="font-bold text-white">15:30</span> a rota se inicia. Você receberá um e-mail (verifique a caixa de spam) com um link para acompanhar a rota e o horário estimado de entrega.
                </p>

                <ul className="list-disc list-inside text-slate-400 space-y-1">
                  <li>
                    <span className="font-bold text-white">Curitiba:</span> das <span className="font-bold text-white">15:30</span> às <span className="font-bold text-white">18:30</span>
                  </li>
                  <li>
                    <span className="font-bold text-white">Região Metropolitana:</span> pode passar das <span className="font-bold text-white">18:30</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Sábado */}
          <Card className="bg-gradient-to-br from-slate-900 to-black border-white/5 overflow-hidden shadow-lg">
            <CardHeader className="flex items-center gap-4 pb-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Calendar className="h-6 w-6 text-purple-400" />
              </div>
              <CardTitle className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white">
                Sábado
              </CardTitle>
            </CardHeader>

            <CardContent className="p-8 md:p-10 min-h-[240px] flex flex-col justify-center">
              <div className="space-y-4 text-base md:text-lg leading-7 text-slate-300">
                <p>
                  Faça pedido até as <span className="font-bold text-white">12:30h</span>. Os pedidos são separados e montamos a rota de entrega para cada motoboy.
                </p>

                <p>
                  Às <span className="font-bold text-white">13:30</span> a rota se inicia. Você receberá um e-mail (verifique a caixa de spam) com o link para acompanhar a rota e o horário estimado de entrega.
                </p>

                <ul className="list-disc list-inside text-slate-400 space-y-1">
                  <li>
                    <span className="font-bold text-white">Curitiba:</span> das <span className="font-bold text-white">13:30</span> às <span className="font-bold text-white">18:00</span>
                  </li>
                  <li>
                    <span className="font-bold text-white">Região Metropolitana:</span> pode passar das <span className="font-bold text-white">18:00</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default InformacoesPage;