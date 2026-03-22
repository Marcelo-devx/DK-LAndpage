import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Search, Truck, CheckCircle } from 'lucide-react';
import { maskCep, maskPhone, maskCpfCnpj } from '@/utils/masks';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from '@/components/ui/checkbox';
import InformationalPopup from '@/components/InformationalPopup';

const profileSchema = z.object({
  first_name: z.string().min(1, "Nome é obrigatório"),
  last_name: z.string().min(1, "Sobrenome é obrigatório"),
  date_of_birth: z.date({ required_error: "Data de nascimento é obrigatória." }),
  phone: z.string().min(14, "Telefone inválido").max(15, "Telefone inválido"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ inválido").max(18, "CPF/CNPJ inválido"),
  gender: z.string({ required_error: "Gênero é obrigatório" }).min(1, "Selecione um gênero"),
  cep: z.string().min(9, "CEP inválido"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado inválido").max(2, "Use a sigla do estado (ex: SC)"),
  // Password fields now required
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  password_confirm: z.string(),
  accepted_terms: z.boolean(),
}).superRefine((obj, ctx) => {
  const pwd = obj.password;
  const conf = obj.password_confirm;
  const accepted = obj.accepted_terms;

  // password rules: at least one uppercase, one number, one special char
  const re = /(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/;
  if (!re.test(pwd)) {
    ctx.addIssue({ path: ['password'], code: z.ZodIssueCode.custom, message: 'A senha precisa ter 1 maiúscula, 1 número e 1 caractere especial' });
  }

  if (!conf) {
    ctx.addIssue({ path: ['password_confirm'], code: z.ZodIssueCode.custom, message: 'Confirme a senha' });
  } else if (pwd !== conf) {
    ctx.addIssue({ path: ['password_confirm'], code: z.ZodIssueCode.custom, message: 'A confirmação não coincide' });
  }

  if (!accepted) {
    ctx.addIssue({ path: ['accepted_terms'], code: z.ZodIssueCode.custom, message: 'Você precisa aceitar os Termos de Uso e Política de Privacidade' });
  }
});

type ProfileFormData = z.infer<typeof profileSchema>;

const TERMS_VERSION = "1.0"; // Version identifier for current terms
const termsContent = `Prezado Cliente, leia com atenção os tópicos abaixo, antes de realizar a compra.

Quase todos nossos produtos são importados, mas por possuírem nicotina, bateria que aquece o líquido interno, composto por aromatizante, nicotina, propilenoglicol e glicerina, não nos responsabilizamos pela composição do vapor e os danos à saúde, bem como sobre o papel destes produtos na redução de danos e no tratamento da dependência de nicotina, potencial de dependência, danos à saúde pulmonar, cardiovascular e neurológica.

É de responsabilidade dos consumidores o uso, de forma correta indicada pelos fabricantes nos manuais dos mesmos, cientes dos riscos que pode causar, sendo permitida a venda e consumo somente para maiores de 18 anos.

POLÍTICA DE PRIVACIDADE DE DADOS

A Loja DK CWB se compromete com a segurança de seus dados e é claro que aqui na nossa loja oficial não é diferente. Mantemos suas informações no mais absoluto sigilo!

Priorizamos a privacidade e a segurança de nossos clientes durante todo o processo de navegação e compra pelo site. Todos os dados cadastrados (nome, endereço, CPF) nunca serão comercializados ou trocados. Alguns dados, necessários para que empresas de logística e meios de pagamento possam realizar a cobrança e envio de seu pedido, serão divulgados para terceiros, quando tais informações forem necessárias para o processo de entrega e cobrança. Seus dados pessoais são fundamentais para que seu pedido chegue em segurança.

Utilizamos cookies e informações de sua navegação com o objetivo de traçar um perfil do público que visita o site e, assim, podermos aperfeiçoar nossos serviços, produtos e conteúdos, tudo conforme o regulamentado pela Lei Geral de Proteção de Dados. Durante todo este processo, mantemos suas informações em sigilo absoluto.

O que é a LGPD?

A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) regulamenta o tratamento de dados pessoais de clientes e usuários por parte de empresas públicas e privadas.

O que são dados pessoais?

Dados pessoais são quaisquer informações capazes de identificar você e/ou qualquer pessoa física. Ou seja, são considerados dados pessoais não só aqueles que identificam uma pessoa imediatamente (como nome, sobrenome, CPF, RG, CNH, Carteira de Trabalho, passaporte e título de eleitor), como também aqueles que, em conjunto com outros dados, tornam uma pessoa identificável. Dados como gênero, idade, telefone, e-mail, ainda que não sejam capazes de identificar alguém de imediato, em conjunto, tornam a pessoa passível de identificação.

O que é tratamento de dados?

É o termo utilizado pela LGPD que resume tudo o que uma empresa pode fazer com dados pessoais a que tem acesso, como coleta, qualificação, compartilhamento e exclusão.

O que são cookies?

São pequenos arquivos de texto enviados para seu navegador, contendo registros sobre seu comportamento ao acessar um site, mas que não armazenam dados pessoais ou afetam o sistema do seu dispositivo. Utilizamos cookies, pixels e outras tecnologias para reconhecer seu navegador ou dispositivo, aprender mais sobre seus interesses, apresentar serviços essenciais, aperfeiçoar a sua experiência de navegação e, ainda, para impedir atividades fraudulentas e melhorar a sua segurança no processo de compra em nossa loja.

Cookies da Sessão

Cookies da sessão são cookies temporários que são utilizados para lembrar de você durante o curso da sua visita ao site, e eles perdem a validade quando você fecha o navegador.

Cookies Persistentes

Cookies persistentes são utilizados para medir a eficácia de nosso site, bem como lembrar suas preferências do site, e permanecem no seu desktop ou dispositivo móvel mesmo depois de você fechar o seu navegador ou efetuar uma reinicialização. Utilizamos tais cookies para analisar o comportamento do usuário e estabelecer padrões, de modo a melhorar a funcionalidade do nosso site para você e outros que o visitam. Estes cookies também nos permitem oferecer os anúncios segmentados e medir a eficácia do nosso site, além da funcionalidade de tais anúncios.

Como usamos os dados pessoais que coletamos?

Você está ciente de que fornece informação de forma consciente e voluntária por meio de aceite dos cookies da página, bem como no momento de realização de um pedido no site e/ou cadastro em nosso site. Quando você o realiza o cadastro e/ou preenche formulário oferecido pela DK CWB, inclusive nos sites por ela operados, determinados Dados Pessoais solicitados serão mantidos em sigilo e serão utilizados apenas para o propósito que motivou o cadastro, não sendo divulgados a terceiros, a não ser no cumprimento de ordens judiciais e/ou emitidas por autoridades públicas.

Para que estes dados permaneçam seguros, recomendamos que você jamais forneça seus dados de acesso ao site (login e senha) a terceiros, mesmo que sejam amigos e parentes. Em caso de suspeita ou confirmação de acesso indevido, entre imediatamente em sua área de cliente e altere a senha.

Por quanto tempo usamos os dados pessoais que coletamos?

Os Dados Pessoais são armazenados somente pelo tempo necessário para cumprir com as finalidades para as quais foram coletados, salvo se houver outra razão para a sua manutenção, a exemplo do cumprimento de quaisquer obrigações legais, regulatórias, contratuais, entre outras.

Quais os seus direitos?

Você tem direito de solicitar à DK CWB informações referentes ao tratamento de seus dados pessoais, por meio dos pedidos abaixo:

I. Confirmação da existência de tratamento de dados pessoais seus e acesso aos dados;

II. Correção de dados incompletos, inexatos ou desatualizados - é importante que os dados pessoais sejam precisos e atuais e cabe a você mantê-los corretos e atualizados;

III. Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD - você poderá solicitar o bloqueio e a eliminação de seus dados pessoais, salvo nos casos previstos em lei;

IV. Portabilidade dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa, de acordo com a regulamentação da Autoridade Nacional, observados os segredos comercial e industrial - a portabilidade dos dados pessoais não inclui dados já anonimizados pela DK CWB;

V. Informação sobre o compartilhamento de dados com entidades públicas e privadas;

VI. Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa: a DK CWB está disponível para atender e auxiliar, de forma transparente, quaisquer dúvidas que possam existir em função do tratamento dos seus dados pessoais, inclusive sobre os possíveis impactos decorrentes do não fornecimento do consentimento;

VII. Revogação do consentimento: você pode retirar o seu consentimento em relação às atividades de tratamento que o requerem;

Para qualquer dos pedidos elencados acima, você deverá entrar em contato com a DK CWB por meio das informações de contato disponibilizadas.

Cadastre-se e compre com tranquilidade, sem preocupações.

As alterações sobre nossa política de privacidade serão devidamente informadas neste espaço.

A DK CWB garante que utiliza os seus dados pessoais de endereçamento, pagamento e conteúdo do pedido, apenas para fins de processamento dos pedidos realizados, não sendo, portanto, divulgados em hipótese alguma. Em relação à segurança no tráfego de dados, toda a navegação realizada em nosso site, bem como as transações que envolverem pagamento, seja por cartão de crédito ou não, estarão criptografadas com a tecnologia SSL (Secure Socket Layer). Isso significa que só a loja tem acesso a suas informações pessoais e mais ninguém. Quando você preenche os dados e nos envia, essas informações são tratadas com total segurança e confidencialidade.

Garantia / Política de Trocas e Devoluções

Garantia / Trocas e Devoluções:

Prezado Cliente, leia com atenção os tópicos abaixo, antes de realizar a compra.

Todos os produtos que comercializamos são originais, entregues nas respectivas caixas lacradas e com código de verificação de autenticidade do fabricante. O fabricante, reserva-se ao direito de fazer alterações nas embalagens e produtos a qualquer tempo, sem prévio aviso e sem que comprometa o funcionamento do mesmo.

Dispomos de uma equipe comprometida em proporcionar a melhor entrega, buscamos sempre garantir que o seu produto chegue sempre em perfeitas condições.

Ao receber sua encomenda:

Observe se a embalagem encontra-se fechada e em perfeitas condições, caso não esteja de acordo, recuse o recebimento e assinale no verso do comprovante de entrega os motivos da recusa.

Desembale a compra e verifique se está em conformidade com o pedido realizado, caso não esteja de acordo, entre em contato conosco informando o ocorrido.

Termos e condições para utilização da Garantia:

A garantia oferecida pela loja DK CWB nos produtos anunciados é de 30 dias para defeitos de fabricação, que serão contados a partir da data de entrega do pedido. Não há garantia contra mau uso (quedas, deixar ligado intermitentemente, uso de líquido de má qualidade, utilização de produtos paralelos e não recomendados pela fabricante, falta de conhecimento ou informação).

A DK CWB se reserva ao direto de avaliar individualmente cada solicitação, passando por análise da equipe técnica, aprovando ou não a realização do procedimento de troca dos produtos.

Não será aprovado em nenhuma hipótese produtos que contenham sinais de má utilização como:

Botões afundados por pressão excessiva.

Conexões Micro USB ou USB C danificadas por conexão inversa ou forçados além do necessário ou por sinais de umidade (água/líquidos).

Sinais de quedas.

Derrubamento de qualquer tipo de líquido que danifique o aparelho, incluindo deixar vazamento excessivo de juice sem a devida manutenção diária.

Produtos com defeito de fabricação:

Trabalhamos com as melhores marcas proporcionando produtos com a melhor qualidade disponível no mercado.

Solicitamos a atenção de todos quanto às solicitações iniciais dos fabricantes contidas nos manuais.

Diversos aparelhos contém resistências que contém malha de algodão. A não realização dos passos iniciais contidos nos manuais dos aparelhos poderá danificar e/ou queimar o algodão inutilizando o aparelho.

A garantia da loja não cobre resistências que forem mal utilizadas, pedimos a todos que fiquem atentos durante os primeiros passos evitando esse tipo de problema.

Após a leitura do manual e realização dos procedimentos necessários, caso tenha algum problema na utilização do produto recebido, entre em contato conosco e solicite auxílio.

A DK CWB entende que, a partir do ato da compra, o comprador se informou sobre o produto que está adquirindo (seja no site do fabricante, nos vários textos disponíveis na internet, nas dezenas de reviews no YouTube, que explicam o funcionamento do produto e também através de contatos com usuários) e que está à par de todos os procedimentos necessários para o perfeito funcionamento do produto.

Se for identificado através do nosso atendimento pela equipe técnica que produto está em desconformidade, providenciaremos a substituição no menor tempo possível, neste caso a loja arcará com os custos de transporte dos produtos.

Termos e condições para realização do procedimento de Troca e/ou Devolução:

O cancelamento da compra e a realização de troca de produtos somente será realizada mediante prévio contato com atendimento da loja. Será avaliado o prazo legal, conforme o Código de Defesa do Consumidor.

Toda troca será realizada no local de origem, e o cliente arcará com os custos de transporte dos produtos. A mesma regra valerá para cancelamento de compras que já tiverem sido remetidas.

Para realizar a solicitação de troca é importante que você forneça os dados do produto adquirido, número de compra, e-mail cadastrado e telefone para contato para o registro correto de sua solicitação.

Ao devolver a mercadoria, deverá ser entregue em sua embalagem original e lacrada, com todos os manuais e acessórios.

Nossos produtos são de uso pessoal, não vendemos produtos utilizados, portanto a solicitação de troca ou cancelamento não será aprovada se for constatado:

Sinais de utilização do produto;

Falta de algum acessório ou componente;

Sinais de quedas e/ou líquidos.

A devolução de produto sem autorização ou que apresente uma das opções acima não será aceita em nenhuma hipótese, e nesse caso o produto será enviado mediante pagamento de frete pelo comprador/cliente.

O prazo para desistir ou trocar sua compra é de 7 (sete) dias corridos, a contar da data do recebimento do produto.

O produto deverá estar na embalagem original, sem indícios de uso, sem violação do lacre original do fabricante, contendo o manual e todos os acessórios que possui.

Os valores ressarcidos serão os preços efetivamente pagos pela(s) mercadoria(s), subtraindo-se o valor do frete e demais encargos tributários gerados pela desistência.

TROCAS DE PODs DESCARTÁVEIS

Não efetuamos trocas/estornos de pods descartáveis após serem abertos e usados. A quantidade de puffs é apenas exemplar e variam de acordo com a intensidade da puxada. Trocas só poderão ser solicitadas em caso de bateria descarregada (quando o aparelho não funciona nem uma vez), para isso, todos os pods recebidos no pedido devem ser testados no ato da entrega e, caso não funcione, o cliente deverá entrar em contato via WhatsApp imediatamente, informando o não funcionamento do produto, fazendo o envio de vídeos que mostrem o defeito do produto.

Reclamações posteriores a data de entrega não serão válidas.

Ressarcimento do valor da compra

O prazo para ressarcimento do valor pago é de até 7 dias úteis após a chegada do item em nosso endereço. Será realizado tão breve quanto possível, assim que o produto for avaliado por nossa equipe técnica.

Só serão realizados estornos ao titular da compra. O crédito não será concedido a terceiros em nenhuma hipótese.

Em caso de compras no cartão de crédito o estorno será realizado pelo sistema e poderá ocorrer apenas na próxima fatura do cartão de crédito. Este procedimento é de responsabilidade exclusiva do sistema de pagamento e da sua administradora do cartão de crédito.

Esta política de trocas e devoluções restringe-se aos produtos adquiridos através do site: www.dkcwb.com

Perguntas Frequentes sobre garantia

Perguntas Frequentes!

Prezado Cliente, leia com atenção os tópicos abaixo, antes de realizar a compra.

CASOS DE CLIENTE QUE QUEIRAM A TROCA DO PRODUTO FORA DA GARANTIA:

Considerando que o prazo de garantia conforme estabelecido no site e no CDC já transcorreu, sem a comunicação prévia através dos canais oficiais da DK (WhatsApp, Instagram ou através do site), a empresa não tem como efetuar o reembolso/devolução dos valores pagos pelo produto. Desde logo, a empresa fica a disposição, ressaltando que os prazos e regras estabelecidos são de extrema importância para resguardar os direitos dos consumidores e dos fornecedores, devendo o cliente ficar atento aos prazos estabelecidos.

CASOS DE CLIENTE QUE TENHAM ABERTO O PRODUTO:

Considerando o produto foi utilizado, contrariando as regras estabelecidas no site, a empresa não tem como efetuar o reembolso/devolução dos valores pagos pelo produto. Desde logo, a empresa fica a disposição, ressaltando que as normas e condições de uso estabelecidas são de extrema importância para resguardar os direitos dos consumidores e dos fornecedores, devendo o cliente ficar atento às normas estabelecidas no site.

CASOS DE CLIENTE QUE TENHAM DEVOLVIDO O PRODUTO COM DANOS/AVARIAS:

Considerando o produto devolvido foi entregue com danos/avarias, contrariando as regras estabelecidas no site, a empresa não tem como efetuar o reembolso/devolução dos valores pagos pelo produto por estarem em desacordo com às normas estabelecidas no site devido ao mal uso do aparelho. Desde logo, a empresa fica a disposição, ressaltando que as normas e condições de uso estabelecidas são de extrema importância para resguardar os direitos dos consumidores e dos fornecedores, devendo o cliente ficar atento às normas estabelecidas no site.`;

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'local' | 'correios' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const { register, handleSubmit, control, setValue, getValues, watch, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const handleCepLookup = async () => {
    const cep = getValues('cep');
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      showError("Por favor, insira um CEP válido com 8 dígitos.");
      return;
    }
    setIsFetchingCep(true);
    setDeliveryType(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-cep', {
        body: { cep: cleanedCep },
      });

      if (error) {
        const errorBody = JSON.parse(error.context.responseText);
        showError(errorBody.error || "Não foi possível buscar o endereço.");
        setValue('street', '');
        setValue('neighborhood', '');
        setValue('city', '');
        setValue('state', '');
        return;
      }

      setValue('street', data.logradouro);
      setValue('neighborhood', data.bairro);
      setValue('city', data.localidade);
      setValue('state', data.uf);
      
      if (data.deliveryType === 'correios') {
        setDeliveryType('correios');
        showSuccess("Endereço localizado (Entrega via Correios)");
      } else {
        setDeliveryType('local');
      }

    } catch (e) {
      showError("Ocorreu um erro inesperado ao buscar o CEP.");
    } finally {
      setIsFetchingCep(false);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        const isProfileComplete = profile && 
          profile.first_name && 
          profile.last_name && 
          profile.date_of_birth && 
          profile.phone && 
          profile.cpf_cnpj &&
          profile.gender &&
          profile.cep && 
          profile.street && 
          profile.number && 
          profile.neighborhood && 
          profile.city && 
          profile.state;

        if (isProfileComplete) {
          navigate('/');
        }
      }
      setLoading(false);
    };
    checkSession();
  }, [navigate]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    const toastId = showLoading("Salvando informações...");

    // Separate password fields from profile data
    const { password, password_confirm, accepted_terms, ...profileData } = data as any;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...profileData,
          accepted_terms: true,
          accepted_terms_version: TERMS_VERSION,
          accepted_terms_at: new Date().toISOString(),
          phone: profileData.phone.replace(/\D/g, ''),
          cpf_cnpj: profileData.cpf_cnpj.replace(/\D/g, ''),
          date_of_birth: format(profileData.date_of_birth, 'yyyy-MM-dd'),
        })
        .eq('id', user.id);

      if (error) {
        // If column doesn't exist, retry without terms tracking columns
        if (String(error.message || '').toLowerCase().includes('column "accepted_terms"') || 
            String(error.code || '').includes('42703') ||
            String(error.message || '').toLowerCase().includes('column "accepted_terms_version"') ||
            String(error.message || '').toLowerCase().includes('column "accepted_terms_at"')) {
          await supabase.from('profiles').update({
            ...profileData,
            phone: profileData.phone.replace(/\D/g, ''),
            cpf_cnpj: profileData.cpf_cnpj.replace(/\D/g, ''),
            date_of_birth: format(profileData.date_of_birth, 'yyyy-MM-dd'),
          }).eq('id', user.id);
        } else throw error;
      }

      // If password provided, update auth password as well (mandatory here)
      if (password) {
        const { data: updated, error: pwdErr } = await supabase.auth.updateUser({ password });
        if (pwdErr) throw pwdErr;
      }

      dismissToast(toastId);
      showSuccess("Cadastro completo!");
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      navigate('/');
    } catch (err: any) {
      dismissToast(toastId);
      showError(err.message || "Erro ao salvar. Tente novamente.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenTerms = () => setIsTermsOpen(true);
  const handleCloseTerms = () => setIsTermsOpen(false);
  const handleAcceptTerms = () => {
    setValue('accepted_terms', true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-2xl my-8 bg-white border border-stone-200 shadow-2xl rounded-[2rem] z-10">
        <CardHeader className="text-center pb-2 pt-10">
          <div className="mx-auto bg-sky-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-sky-600" />
          </div>
          <CardTitle className="font-black text-3xl md:text-4xl text-charcoal-gray italic uppercase tracking-tighter">Complete seu Cadastro.</CardTitle>
          <CardDescription className="text-stone-500 font-medium text-lg mt-2">
            Finalize suas informações para acessar a loja.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 md:p-12">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Dados Pessoais */}
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Dados Pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-charcoal-gray">Nome</Label>
                  <Input id="first_name" {...register('first_name')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.first_name && <p className="text-xs text-red-500 font-bold">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-charcoal-gray">Sobrenome</Label>
                  <Input id="last_name" {...register('last_name')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.last_name && <p className="text-xs text-red-500 font-bold">{errors.last_name.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="cpf_cnpj" className="text-charcoal-gray">CPF / CNPJ</Label>
                    <Input 
                      id="cpf_cnpj" 
                      {...register('cpf_cnpj')} 
                      onChange={(e) => e.target.value = maskCpfCnpj(e.target.value)} 
                      placeholder="000.000.000-00" 
                      className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" 
                    />
                    {errors.cpf_cnpj && <p className="text-xs text-red-500 font-bold">{errors.cpf_cnpj.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-charcoal-gray">Gênero</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors text-charcoal-gray">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-stone-200 text-charcoal-gray">
                            <SelectItem value="male">Masculino</SelectItem>
                            <SelectItem value="female">Feminino</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.gender && <p className="text-xs text-red-500 font-bold">{errors.gender.message}</p>}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth" className="text-charcoal-gray">Data de Nascimento</Label>
                    <div className="[&>button]:w-full [&>button]:h-12 [&>button]:bg-stone-50 [&>button]:border-stone-200 [&>button]:rounded-xl [&>button]:text-charcoal-gray">
                        <Controller 
                            name="date_of_birth" 
                            control={control} 
                            render={({ field }) => (
                            <DatePicker value={field.value} onChange={field.onChange} />
                            )} 
                        />
                    </div>
                    {errors.date_of_birth && <p className="text-xs text-red-500 font-bold">{errors.date_of_birth.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-charcoal-gray">Telefone</Label>
                    <Input id="phone" {...register('phone')} onChange={(e) => e.target.value = maskPhone(e.target.value)} placeholder="(48) 99999-9999" className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                    {errors.phone && <p className="text-xs text-red-500 font-bold">{errors.phone.message}</p>}
                  </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-6 pt-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Endereço de Entrega</h3>
                
                {deliveryType === 'correios' && (
                  <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800 rounded-xl">
                    <Truck className="h-4 w-4" />
                    <AlertTitle className="font-bold uppercase text-xs tracking-wider">Entrega via Correios</AlertTitle>
                    <AlertDescription className="text-xs">
                      Para sua região, os pedidos são enviados via Correios. O prazo de entrega pode variar.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cep" className="text-charcoal-gray">CEP</Label>
                  <div className="flex items-center space-x-3">
                    <Input id="cep" {...register('cep')} onChange={(e) => e.target.value = maskCep(e.target.value)} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                    <Button type="button" size="icon" onClick={handleCepLookup} disabled={isFetchingCep} className="bg-sky-500 hover:bg-sky-400 text-white h-12 w-14 rounded-xl shrink-0 shadow-md">
                      {isFetchingCep ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    </Button>
                  </div>
                  {errors.cep && <p className="text-xs text-red-500 font-bold">{errors.cep.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-charcoal-gray">Rua</Label>
                  <Input id="street" {...register('street')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.street && <p className="text-xs text-red-500 font-bold">{errors.street.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="number" className="text-charcoal-gray">Número</Label>
                      <Input id="number" {...register('number')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.number && <p className="text-xs text-red-500 font-bold">{errors.number.message}</p>}
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="complement" className="text-charcoal-gray">Complemento (opcional)</Label>
                      <Input id="complement" {...register('complement')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                    </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood" className="text-charcoal-gray">Bairro</Label>
                  <Input id="neighborhood" {...register('neighborhood')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.neighborhood && <p className="text-xs text-red-500 font-bold">{errors.neighborhood.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="city" className="text-charcoal-gray">Cidade</Label>
                      <Input id="city" {...register('city')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.city && <p className="text-xs text-red-500 font-bold">{errors.city.message}</p>}
                    </div>
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="state" className="text-charcoal-gray">Estado</Label>
                      <Input id="state" {...register('state')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.state && <p className="text-xs text-red-500 font-bold">{errors.state.message}</p>}
                    </div>
                </div>
            </div>

            {/* Password section */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Defina sua senha de acesso</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-charcoal-gray">Senha</Label>
                  <div className="flex items-center">
                    <Input id="password" type={showPassword ? 'text' : 'password'} {...register('password')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  </div>
                  {errors.password && <p className="text-xs text-red-500 font-bold">{(errors.password as any)?.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password_confirm" className="text-charcoal-gray">Confirmar senha</Label>
                  <Input id="password_confirm" type={showPassword ? 'text' : 'password'} {...register('password_confirm')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.password_confirm && <p className="text-xs text-red-500 font-bold">{(errors.password_confirm as any)?.message}</p>}
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <Checkbox id="show_pwd" checked={showPassword} onCheckedChange={(v) => setShowPassword(Boolean(v))} />
                  <Label htmlFor="show_pwd" className="text-sm">Mostrar senhas</Label>
                </div>

                <PasswordRules />

              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <Checkbox id="accepted_terms" {...register('accepted_terms')} />
              <div className="text-sm text-slate-600">
                <label htmlFor="accepted_terms" className="cursor-pointer">Li e aceito os <button type="button" onClick={handleOpenTerms} className="text-sky-500 underline">Termos de Uso e Política de Privacidade</button>.</label>
                {errors.accepted_terms && <p className="text-xs text-red-500 font-bold">{(errors.accepted_terms as any)?.message}</p>}
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 rounded-xl shadow-lg transition-all active:scale-95 text-sm" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Finalizar Cadastro'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <InformationalPopup isOpen={isTermsOpen} onClose={handleCloseTerms} title="Termo de Uso e Responsabilidade" content={termsContent} onAccept={() => { handleAcceptTerms(); handleCloseTerms(); }} />
    </div>
  );
};

const PasswordRules: React.FC = () => {
  // use the same watch hook from the form by creating a small wrapper that reads the form directly
  // Since this component lives in the same file scope, we can call useFormContext alternatively.
  // Simpler: read values from document via querySelector (not preferred). Instead, create a small inline hook using the form's watch by importing useFormContext.
  // But useFormContext requires the FormProvider which we didn't set. To keep this file self-contained, we'll compute values using a small effect that reads the inputs by id.

  const [pwd, setPwd] = React.useState('');
  const [conf, setConf] = React.useState('');

  React.useEffect(() => {
    const onInput = () => {
      const p = (document.getElementById('password') as HTMLInputElement)?.value || '';
      const c = (document.getElementById('password_confirm') as HTMLInputElement)?.value || '';
      setPwd(p);
      setConf(c);
    };

    // attach listeners
    const pEl = document.getElementById('password');
    const cEl = document.getElementById('password_confirm');
    pEl?.addEventListener('input', onInput);
    cEl?.addEventListener('input', onInput);

    // initialize
    onInput();

    return () => {
      pEl?.removeEventListener('input', onInput);
      cEl?.removeEventListener('input', onInput);
    };
  }, []);

  const isMinLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const passwordsMatch = pwd.length > 0 && pwd === conf;

  const item = (ok: boolean, text: string) => (
    <div className="flex items-center gap-2">
      <span className={ok ? 'text-emerald-600' : 'text-rose-500'} aria-hidden>
        {ok ? '✔' : '✖'}
      </span>
      <span className={ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-600'}>{text}</span>
    </div>
  );

  return (
    <div className="md:col-span-2 mt-2">
      <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {item(isMinLength, 'Mínimo 8 caracteres')}
          {item(hasUpper, 'Pelo menos 1 letra maiúscula')}
          {item(hasNumber, 'Pelo menos 1 número')}
          {item(hasSpecial, 'Pelo menos 1 caractere especial')}
        </div>
        <div className="mt-3">
          {conf.length > 0 ? (
            passwordsMatch ? (
              <div className="text-emerald-700 font-medium">As senhas coincidem.</div>
            ) : (
              <div className="text-rose-600 font-medium">As senhas não coincidem.</div>
            )
          ) : (
            <div className="text-stone-500">Digite a confirmação para verificar se as senhas coincidem.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;