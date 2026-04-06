import { Shield, Truck, Lock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Tudo o que você precisa saber sobre como funciona a DKCWB. Garantias, entregas e o cuidado com seus dados.
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 xl:px-12 py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:gap-10">
          
          {/* Garantia Section */}
          <Card className="bg-gradient-to-br from-slate-900 to-black border-white/10 overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                  <Shield className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white">
                    Garantia e Trocas
                  </CardTitle>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mt-1">
                    Proteção Total
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-l-2 border-emerald-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Prazo de Troca
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Você tem até <span className="text-white font-bold">7 dias</span> após o recebimento do produto para solicitar troca ou devolução por arrependimento. O produto deve estar na embalagem original, sem sinais de uso e com todos os acessórios.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Produtos com Defeito
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Caso receba um produto com defeito de fabricação, entre em contato conosco imediatamente. Analisaremos cada caso e ofereceremos a melhor solução: troca, reparo ou reembolso total. A garantia de fabricação é de <span className="text-white font-bold">30 dias</span>.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Como Solicitar
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Entre em contato através do WhatsApp ou e-mail informando o número do pedido, o produto e o motivo da troca. Nossa equipe irá te orientar sobre o próximo passo e, se necessário, enviar a etiqueta de devolução gratuita.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Frete Section */}
          <Card className="bg-gradient-to-br from-slate-900 to-black border-white/10 overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="bg-sky-500/10 p-3 rounded-xl border border-sky-500/20">
                  <Truck className="h-6 w-6 text-sky-500" />
                </div>
                <div>
                  <CardTitle className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white">
                    Frete e Entrega
                  </CardTitle>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-500 mt-1">
                    Rápido e Seguro
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-l-2 border-sky-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Prazo de Entrega
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Para entregas locais, o prazo é de <span className="text-white font-bold">1 a 3 dias úteis</span> após a confirmação do pagamento. Para regiões atendidas via Correios, o prazo varia de <span className="text-white font-bold">5 a 15 dias úteis</span> dependendo da localização.
                </p>
              </div>

              <div className="border-l-2 border-sky-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Frete Grátis
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Oferecemos <span className="text-white font-bold">frete grátis</span> para compras acima de R$ 200,00. Além disso, membros do Clube DK com nível Ouro ou superior têm frete grátis em todas as compras (verifique seu nível na área do Clube).
                </p>
              </div>

              <div className="border-l-2 border-sky-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Rastreamento
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Assim que seu pedido for despachado, você receberá um código de rastreamento por e-mail e WhatsApp. Acompanhe cada etapa da entrega em tempo real diretamente pela seção "Meus Pedidos".
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dados Section */}
          <Card className="bg-gradient-to-br from-slate-900 to-black border-white/10 overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20">
                  <Lock className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white">
                    Uso de Dados Pessoais
                  </CardTitle>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500 mt-1">
                    Privacidade e Segurança
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-l-2 border-purple-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Coleta de Dados
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Coletamos apenas informações essenciais para processar seus pedidos: nome, e-mail, telefone e endereço de entrega. Estes dados são armazenados de forma segura em servidores criptografados e nunca são compartilhados com terceiros sem seu consentimento explícito.
                </p>
              </div>

              <div className="border-l-2 border-purple-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Uso das Informações
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Seus dados são utilizados exclusivamente para: processar pedidos, enviar atualizações sobre entregas, comunicar ofertas relevantes (se autorizado) e melhorar sua experiência na plataforma. Respeitamos suas preferências de comunicação.
                </p>
              </div>

              <div className="border-l-2 border-purple-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Seus Direitos
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Você tem direito a acessar, corrigir, atualizar ou solicitar a exclusão de seus dados pessoais a qualquer momento. Entre em contato conosco através do e-mail ou WhatsApp e responderemos em até <span className="text-white font-bold">48 horas</span>.
                </p>
              </div>

              <div className="border-l-2 border-purple-500/30 pl-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Segurança
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Utilizamos criptografia SSL em todas as transações e seguimos as melhores práticas de segurança da informação. Seus pagamentos são processados através do Mercado Pago, garantindo total segurança nas transações.
                </p>
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
};

export default InformacoesPage;