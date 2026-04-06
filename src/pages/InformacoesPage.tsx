import { useState } from 'react';
import { Info, Truck, Calendar, Shield, Lock, FileText, Globe, Key, AlertCircle, CheckCircle, XCircle, Clock, ArrowRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

const InformacoesPage = () => {
  const [showFullPrivacy, setShowFullPrivacy] = useState(false);

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
        <Accordion type="single" collapsible className="w-full space-y-6">
          
          {/* ACORDEÃO 1: HORÁRIOS DE ENTREGA */}
          <AccordionItem value="entrega" className="border border-sky-500/20 bg-gradient-to-br from-slate-900 to-black rounded-2xl overflow-hidden">
            <AccordionTrigger className="px-6 md:px-8 py-6 hover:no-underline hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-4">
                <div className="bg-sky-500/10 p-3 rounded-xl border border-sky-500/20 group-hover:bg-sky-500/20 transition-colors">
                  <Truck className="h-6 w-6 text-sky-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white">
                    Horários de Entrega
                  </h2>
                  <p className="text-sky-400 text-xs font-bold uppercase tracking-wider mt-1">
                    Segunda a Sexta | Sábado
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 md:px-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                
                {/* Segunda a Sexta */}
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/5 overflow-hidden">
                  <CardHeader className="flex items-center gap-3 pb-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/20">
                      <Calendar className="h-5 w-5 text-sky-400" />
                    </div>
                    <CardTitle className="text-lg md:text-xl font-bold uppercase tracking-tight text-white">
                      De Segunda a Sexta
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-3 text-sm md:text-base leading-6 text-slate-300">
                      <p>
                        Faça pedido até as <span className="font-bold text-white">14:00h</span>. Os pedidos são separados e montamos a rota de entrega para cada motoboy.
                      </p>

                      <p>
                        Às <span className="font-bold text-white">15:30</span> a rota se inicia. Você receberá um e-mail (verifique a caixa de spam) com um link para acompanhar a rota e o horário estimado de entrega.
                      </p>

                      <ul className="list-disc list-inside text-slate-400 space-y-1.5 mt-4">
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
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/5 overflow-hidden">
                  <CardHeader className="flex items-center gap-3 pb-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <Calendar className="h-5 w-5 text-purple-400" />
                    </div>
                    <CardTitle className="text-lg md:text-xl font-bold uppercase tracking-tight text-white">
                      Sábado
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-3 text-sm md:text-base leading-6 text-slate-300">
                      <p>
                        Faça pedido até as <span className="font-bold text-white">12:30h</span>. Os pedidos são separados e montamos a rota de entrega para cada motoboy.
                      </p>

                      <p>
                        Às <span className="font-bold text-white">13:30</span> a rota se inicia. Você receberá um e-mail (verifique a caixa de spam) com o link para acompanhar a rota e o horário estimado de entrega.
                      </p>

                      <ul className="list-disc list-inside text-slate-400 space-y-1.5 mt-4">
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
            </AccordionContent>
          </AccordionItem>

          {/* ACORDEÃO 2: GARANTIA E POLÍTICA DE TROCAS */}
          <AccordionItem value="garantia" className="border border-emerald-500/20 bg-slate-900 rounded-2xl overflow-hidden">
            <AccordionTrigger className="px-6 md:px-8 py-6 hover:no-underline hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                  <Shield className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white">
                    Garantia e Política de Trocas
                  </h2>
                  <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mt-1">
                    Proteção para suas compras
                  </p>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-6 md:px-8 pb-8">
              <div className="max-w-4xl mx-auto mt-4 space-y-8 text-left">

                {/* Introdução em bloco sólido */}
                <div className="bg-slate-900 border border-white/6 p-6 rounded-lg">
                  <p className="text-white text-lg leading-8">
                    Prezado Cliente, leia com atenção os tópicos abaixo, <strong>antes de realizar a compra</strong>.
                  </p>

                  <p className="text-slate-200 mt-4 text-lg leading-8">
                    Todos os produtos que comercializamos são originais, entregues nas respectivas caixas lacradas e com código de verificação de autenticidade do fabricante. O fabricante pode alterar embalagens e detalhes sem aviso, sem que isso comprometa o funcionamento.
                  </p>

                  <p className="text-slate-200 mt-4 text-lg leading-8">
                    Nossa equipe trabalha para garantir que o produto chegue em perfeitas condições. Caso identifique qualquer problema, siga as orientações abaixo.
                  </p>
                </div>

                {/* Ao Receber a Encomenda - lista simples */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Ao receber sua encomenda</h3>
                  <ul className="list-disc list-inside text-slate-300 space-y-3 pl-4 text-lg leading-7">
                    <li>Verifique se a embalagem está lacrada e em perfeitas condições. Se houver dano, recuse o recebimento e registre o motivo no comprovante.</li>
                    <li>Desembale e confira o produto. Se houver divergência com o pedido, entre em contato conosco informando o ocorrido.</li>
                  </ul>
                </div>

                {/* Termos de Garantia */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Termos de garantia</h3>
                  <p className="text-lg text-slate-200 leading-8">
                    A garantia oferecida pela loja <strong className="text-white">DK CWB</strong> é de <span className="inline-block bg-emerald-600 text-black font-black px-3 py-1 rounded-full">30 dias</span> para defeitos de fabricação, contados a partir da data de entrega do pedido.
                  </p>

                  <div className="mt-4 rounded-lg p-4 bg-white/5 border-l-4 border-red-500">
                    <p className="text-red-100 font-semibold">Não há garantia contra mau uso</p>
                    <p className="text-red-100 text-sm mt-2 leading-6">Exemplos: quedas, exposição a líquidos, uso de líquidos ou acessórios não recomendados pelo fabricante, ou qualquer dano causado por manuseio indevido.</p>
                  </div>

                  <p className="text-slate-300 mt-4 text-lg leading-8">
                    A DK CWB avaliará individualmente cada solicitação. A análise da equipe técnica determinará se o procedimento de troca será aprovado.
                  </p>
                </div>

                {/* O que não é coberto - grid com itens claros */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">O que não será aprovado</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      'Botões afundados por pressão excessiva',
                      'Conexões Micro USB/USB-C danificadas por uso indevido',
                      'Sinais de umidade (água/líquidos) nas conexões',
                      'Sinais visíveis de queda',
                      'Derramamento de líquidos que danifiquem o aparelho',
                      'Vazamento excessivo de juice sem manutenção apropriada'
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-white/3 border border-white/6 p-4 rounded-md">
                        <div className="flex-shrink-0 mt-1 text-red-400">
                          <XCircle className="h-5 w-5" />
                        </div>
                        <p className="text-slate-200 text-base leading-7">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Produtos com defeito de fabricação */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Produtos com defeito de fabricação</h3>
                  <p className="text-slate-200 text-lg leading-8">Trabalhamos com marcas de qualidade, porém alguns aparelhos exigem procedimentos iniciais descritos nos manuais (por exemplo, preparo de resistências com malha de algodão). A não execução desses passos pode danificar componentes consumíveis, que não são cobertos pela garantia.</p>

                  <div className="mt-4 rounded-lg p-4 bg-white/5 border-l-4 border-yellow-500">
                    <p className="text-yellow-100 font-semibold">Atenção importante</p>
                    <p className="text-yellow-100 text-sm mt-2 leading-6">Se o manual indicar procedimentos iniciais, siga-os. A garantia não cobre resistências danificadas por uso incorreto.</p>
                  </div>

                  <p className="text-slate-300 mt-4 text-lg leading-8">Se, após seguir o manual, houver problema no uso do produto, entre em contato para suporte. Se constatado defeito de fabricação pela equipe técnica, providenciaremos a substituição e a loja cobrirá os custos de transporte.</p>
                </div>

                {/* Regras de Troca e Devolução - listas claras */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Regras para Troca e Devolução</h3>
                  <ul className="list-disc list-inside text-slate-300 space-y-3 pl-4 text-lg leading-7">
                    <li>Trocas/cancelamentos só mediante contato prévio com o atendimento da loja.</li>
                    <li>Toda troca será realizada no local de origem; o cliente arca com o frete, salvo quando a troca for por defeito aprovado pela equipe técnica.</li>
                    <li>Ao devolver, entregue o produto na embalagem original, lacrada, com manuais e acessórios.</li>
                    <li>Trocas não serão aprovadas se houver sinais de uso, falta de componentes ou danos por queda/liquido.</li>
                    <li>Prazo para desistir ou trocar: <strong className="text-white">7 dias corridos</strong> a partir do recebimento.</li>
                  </ul>
                </div>

                {/* Trocas de PODs descartáveis */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Trocas de PODs Descartáveis</h3>
                  <p className="text-slate-200 text-lg leading-8">Não efetuamos trocas/estornos de pods descartáveis após serem abertos e usados. A quantidade de puffs é estimada e varia conforme o uso.</p>
                  <p className="text-slate-300 mt-2 text-lg leading-8">Trocas só em caso de bateria descarregada (o aparelho não funcionou sequer uma vez). Todos os pods devem ser testados no ato da entrega; se não funcionarem, contate via WhatsApp e envie vídeos que comprovem o defeito.</p>
                </div>

                {/* Prazos e Ressarcimento */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-3">Prazos e Ressarcimento</h3>
                  <p className="text-slate-200 text-lg leading-8">Ressarcimento: prazo de até <strong className="text-white">7 dias úteis</strong> após a chegada do item ao nosso endereço e avaliação técnica. Estornos serão feitos ao titular da compra; em cartão de crédito, o estorno pode aparecer na próxima fatura.</p>
                  <p className="text-slate-300 mt-3 text-sm">Esta política aplica-se a compras realizadas em nosso site: <strong className="text-sky-400">www.dkcwb.com</strong></p>
                </div>

              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ACORDEÃO 3: POLÍTICA DE PRIVACIDADE */}
          <AccordionItem value="privacidade" className="border border-purple-500/20 bg-gradient-to-br from-slate-900 to-black rounded-2xl overflow-hidden">
            <AccordionTrigger className="px-6 md:px-8 py-6 hover:no-underline hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                  <Lock className="h-6 w-6 text-purple-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white">
                    Política de Privacidade
                  </h2>
                  <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mt-1">
                    Proteção dos seus dados
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 md:px-8 pb-8">
              <div className="space-y-6 mt-4">
                
                {/* RESUMO INICIAL */}
                <div className="bg-gradient-to-br from-purple-900/20 to-slate-900 border border-purple-500/20 p-6 rounded-xl">
                  <h3 className="text-lg font-black uppercase tracking-widest text-white mb-4 flex items-center gap-3">
                    <Shield className="h-5 w-5 text-purple-400" />
                    Nosso Compromisso
                  </h3>
                  <div className="space-y-4 text-slate-300">
                    <p className="leading-relaxed">
                      A <strong className="text-white">Loja DK CWB</strong> se compromete com a segurança de seus dados e mantemos suas informações no mais absoluto sigilo! Priorizamos a privacidade e a segurança de nossos clientes durante todo o processo de navegação e compra pelo site.
                    </p>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-slate-300 text-sm">
                          Todos os dados cadastrados (nome, endereço, CPF) <strong className="text-white">nunca serão comercializados ou trocados</strong>.
                        </p>
                      </div>
                    </div>
                    <p className="leading-relaxed text-sm">
                      Alguns dados, necessários para que empresas de logística e meios de pagamento possam realizar a cobrança e envio de seu pedido, serão divulgados para terceiros, quando tais informações forem necessárias para o processo de entrega e cobrança.
                    </p>
                    <p className="leading-relaxed text-sm">
                      Utilizamos cookies e informações de sua navegação com o objetivo de traçar um perfil do público que visita o site e, assim, podermos aperfeiçoar nossos serviços, produtos e conteúdos, tudo conforme o regulamentado pela Lei Geral de Proteção de Dados. Durante todo este processo, mantemos suas informações em sigilo absoluto.
                    </p>
                  </div>
                </div>

                {/* BOTÃO EXPANDIR */}
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={() => setShowFullPrivacy(!showFullPrivacy)}
                    variant={showFullPrivacy ? "outline" : "default"}
                    className={showFullPrivacy 
                      ? "bg-transparent border-white/20 text-white hover:bg-white/5 uppercase font-black tracking-widest text-xs px-8 py-3"
                      : "bg-purple-500 hover:bg-purple-400 text-white uppercase font-black tracking-widest text-xs px-8 py-3 shadow-lg shadow-purple-500/20"
                    }
                  >
                    {showFullPrivacy ? (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2 rotate-180" />
                        Ocultar Política Completa
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Política Completa
                      </>
                    )}
                  </Button>
                </div>

                {/* CONTEÚDO COMPLETO */}
                {showFullPrivacy && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    
                    {/* O que é LGPD */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-md font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-3">
                        <Globe className="h-5 w-5" />
                        O que é a LGPD?
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) regulamenta o tratamento de dados pessoais de clientes e usuários por parte de empresas públicas e privadas.
                      </p>
                    </div>

                    {/* O que são dados pessoais */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-md font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-3">
                        <Key className="h-5 w-5" />
                        O que são Dados Pessoais?
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">
                        Dados pessoais são quaisquer informações capazes de identificar você e/ou qualquer pessoa física. Ou seja, são considerados dados pessoais não só aqueles que identificam uma pessoa imediatamente (como nome, sobrenome, CPF, RG, CNH, Carteira de Trabalho, passaporte e título de eleitor), como também aqueles que, em conjunto com outros dados, tornam uma pessoa identificável.
                      </p>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        Dados como gênero, idade, telefone, e-mail, ainda que não sejam capazes de identificar alguém de imediato, em conjunto, tornam a pessoa passível de identificação.
                      </p>
                    </div>

                    {/* O que é tratamento de dados */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-md font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-3">
                        <FileText className="h-5 w-5" />
                        O que é Tratamento de Dados?
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        É o termo utilizado pela LGPD que resume tudo o que uma empresa pode fazer com dados pessoais a que tem acesso, como coleta, qualificação, compartilhamento e exclusão.
                      </p>
                    </div>

                    {/* O que são cookies */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-md font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-3">
                        <Globe className="h-5 w-5" />
                        O que são Cookies?
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">
                        São pequenos arquivos de texto enviados para seu navegador, contendo registros sobre seu comportamento ao acessar um site, mas que não armazenam dados pessoais ou afetam o sistema do seu dispositivo. Utilizamos cookies, pixels e outras tecnologias para reconhecer seu navegador ou dispositivo, aprender mais sobre seus interesses, apresentar serviços essenciais, aperfeiçoar a sua experiência de navegação e, ainda, para impedir atividades fraudulentas e melhorar a sua segurança no processo de compra em nossa loja.
                      </p>
                      
                      <div className="space-y-4 mt-6">
                        <div>
                          <h5 className="text-sky-400 font-bold uppercase text-xs tracking-widest mb-3">Cookies da Sessão</h5>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            Cookies da sessão são cookies temporários que são utilizados para lembrar de você durante o curso da sua visita ao site, e eles perdem a validade quando você fecha o navegador.
                          </p>
                        </div>
                        <div>
                          <h5 className="text-sky-400 font-bold uppercase text-xs tracking-widest mb-3">Cookies Persistentes</h5>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            Cookies persistentes são utilizados para medir a eficácia de nosso site, bem como lembrar suas preferências do site, e permanecem no seu desktop ou dispositivo móvel mesmo depois de você fechar o seu navegador ou efetuar uma reinicialização. Utilizamos tais cookies para analisar o comportamento do usuário e estabelecer padrões, de modo a melhorar a funcionalidade do nosso site para você e outros que o visitam. Estes cookies também nos permitem oferecer os anúncios segmentados e medir a eficácia do nosso site, além da funcionalidade de tais anúncios.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Como usamos os dados */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-md font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-3">
                        <Shield className="h-5 w-5" />
                        Como Usamos os Dados Pessoais
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">
                        Você está ciente de que fornece informação de forma consciente e voluntária por meio de aceite dos cookies da página, bem como no momento de realização de um pedido no site e/ou cadastro em nosso site.
                      </p>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">
                        Quando você realiza o cadastro e/ou preenche formulário oferecido pela DK CWB, inclusive nos sites por ela operados, determinados Dados Pessoais solicitados serão mantidos em sigilo e serão utilizados apenas para o propósito que motivou o cadastro, não sendo divulgados a terceiros, a não ser no cumprimento de ordens judiciais e/ou emitidas por autoridades públicas.
                      </p>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                        <p className="text-emerald-300 font-bold text-sm mb-2">💡 Dica de Segurança</p>
                        <p className="text-slate-400 text-sm">
                          Para que estes dados permaneçam seguros, recomendamos que você jamais forneça seus dados de acesso ao site (login e senha) a terceiros, mesmo que sejam amigos e parentes. Em caso de suspeita ou confirmação de acesso indevido, entre imediatamente em sua área de cliente e altere a senha.
                        </p>
                      </div>
                    </div>

                    {/* Por quanto tempo usamos os dados */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-md font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-3">
                        <Clock className="h-5 w-5" />
                        Por Quanto Tempo Usamos os Dados
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        Os Dados Pessoais são armazenados somente pelo tempo necessário para cumprir com as finalidades para as quais foram coletados, salvo se houver outra razão para a sua manutenção, a exemplo do cumprimento de quaisquer obrigações legais, regulatórias, contratuais, entre outras.
                      </p>
                    </div>

                    {/* Seus direitos */}
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-md font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5" />
                        Quais São Seus Direitos?
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">
                        Você tem direito de solicitar à DK CWB informações referentes ao tratamento de seus dados pessoais, por meio dos pedidos abaixo:
                      </p>
                      <div className="space-y-3">
                        {[
                          { title: "Confirmação da existência de tratamento", desc: "Acesso aos dados" },
                          { title: "Correção de dados incompletos, inexatos ou desatualizados", desc: "É importante que os dados pessoais sejam precisos e atuais" },
                          { title: "Anonimização, bloqueio ou eliminação", desc: "De dados desnecessários, excessivos ou tratados em desconformidade com a LGPD" },
                          { title: "Portabilidade dos dados", desc: "A outro fornecedor de serviço ou produto" },
                          { title: "Informação sobre compartilhamento", desc: "Com entidades públicas e privadas" },
                          { title: "Informação sobre não fornecimento de consentimento", desc: "E sobre as consequências da negativa" },
                          { title: "Revogação do consentimento", desc: "Você pode retirar o seu consentimento" }
                        ].map((right, idx) => (
                          <div key={idx} className="bg-white/5 border border-white/5 p-3 rounded-lg flex items-start gap-3">
                            <div className="bg-sky-500/10 p-1.5 rounded-lg border border-sky-500/20 shrink-0 mt-0.5">
                              <CheckCircle className="h-3 w-3 text-sky-400" />
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{right.title}</p>
                              <p className="text-slate-400 text-xs mt-1">{right.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-lg mt-4">
                        <p className="text-sky-300 text-sm">
                          Para qualquer dos pedidos acima, entre em contato com a DK CWB por meio das informações de contato disponibilizadas.
                        </p>
                      </div>
                    </div>

                    {/* Segurança e Certificados */}
                    <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900 border border-emerald-500/20 p-6 rounded-xl">
                      <h4 className="text-md font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-3">
                        <Shield className="h-5 w-5" />
                        Segurança dos Seus Dados
                      </h4>
                      <div className="space-y-4">
                        <p className="text-slate-300 text-sm leading-relaxed">
                          A DK CWB garante que utiliza os seus dados pessoais de endereçamento, pagamento e conteúdo do pedido, apenas para fins de processamento dos pedidos realizados, não sendo, portanto, divulgados em hipótese alguma.
                        </p>
                        
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-white/5">
                          <p className="text-sky-400 font-bold uppercase text-xs tracking-widest mb-2">Criptografia SSL</p>
                          <p className="text-slate-300 text-sm leading-relaxed">
                            Em relação à segurança no tráfego de dados, toda a navegação realizada em nosso site, bem como as transações que envolverem pagamento, estarão criptografadas com a tecnologia SSL (Secure Socket Layer). Isso significa que só a loja tem acesso a suas informações pessoais e mais ninguém.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                          <div className="bg-slate-800/50 p-4 rounded-lg border border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                              <Globe className="h-5 w-5 text-sky-400" />
                              <p className="text-sky-400 font-bold uppercase text-xs tracking-widest">Google Safe Browsing</p>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              O Google é a maior empresa de pesquisas e tecnologia do mundo. A empresa possui um sistema de avaliação de navegação segura, examinando bilhões de websites diariamente. O Google atesta que nosso site é seguro para navegação e nos concede o seu selo de segurança.
                            </p>
                          </div>

                          <div className="bg-slate-800/50 p-4 rounded-lg border border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                              <Lock className="h-5 w-5 text-emerald-400" />
                              <p className="text-emerald-400 font-bold uppercase text-xs tracking-widest">Certificado SSL</p>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              O certificado digital SSL é o nível de segurança mais alto e obrigatório para todos os sites que realizam transmissão de dados. Protegemos suas informações que são enviadas por meio de criptografia de dados, o que praticamente elimina a possibilidade de interceptação.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nota final */}
                    <div className="bg-purple-500/5 border border-purple-500/20 p-6 rounded-xl text-center">
                      <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
                      <h5 className="text-lg font-black uppercase tracking-widest text-white mb-3">
                        Cadastre-se e Compre com Tranquilidade
                      </h5>
                      <p className="text-slate-300 text-sm">
                        As alterações sobre nossa política de privacidade serão devidamente informadas neste espaço.
                      </p>
                    </div>

                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  );
};

export default InformacoesPage;