import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const Footer = () => {
  const { settings } = useTheme();
  const { user } = useAuth();

  // Link EXATO fornecido
  const CORRECT_INSTAGRAM_URL = 'https://www.instagram.com/dondk_cwb?igsh=MW9mOWZxdGdvaGJtZA%3D%3D';

  const contactEmail = settings.contactEmail || 'dondkcwb@protonmail.com';
  const contactPhone = settings.contactPhone || '+595 985 981 046';
  const contactHours = settings.contactHours || 'Seg - Sex: 10:00 - 18:00 | Sábados: 10:00 - 17:00';

  return (
    <footer className="bg-white text-slate-700 border-t border-slate-200">
      <div className="container mx-auto px-4 py-4 md:px-6 md:py-8 xl:px-8 xl:py-10 2xl:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">

          {/* Logo + descrição — ocupa 2 colunas no mobile */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-lg md:text-xl text-sky-500 mb-1.5 md:mb-3 uppercase font-black italic tracking-tighter" translate="no">DKCWB.</h3>
            <p className="text-xs md:text-sm leading-relaxed text-slate-800 line-clamp-2 md:line-clamp-none">
              Curadoria exclusiva e inovação em cada detalhe. A sua fonte definitiva para a melhor experiência premium.
            </p>
          </div>

          {/* Navegação */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-[10px] md:text-xs tracking-[0.2em] mb-2 md:mb-3">Navegação</h4>
            <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm font-medium">
              <li><Link to="/" className="hover:text-sky-500 transition-colors">Início</Link></li>
              <li><Link to="/produtos" className="hover:text-sky-500 transition-colors">Produtos</Link></li>
              <li><Link to="/como-funciona" className="hover:text-sky-500 transition-colors">Como Funciona</Link></li>
              <li><Link to="/informacoes" className="hover:text-sky-500 transition-colors">Informações</Link></li>
              <li>
                {user ? (
                  <Link to="/dashboard" className="hover:text-sky-500 transition-colors">Minha Conta</Link>
                ) : (
                  <Link to="/login" className="hover:text-sky-500 transition-colors">Entrar</Link>
                )}
              </li>
            </ul>
          </div>

          {/* Atendimento */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-[10px] md:text-xs tracking-[0.2em] mb-2 md:mb-3">Atendimento</h4>
            <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm font-medium">
              <li className="flex flex-col">
                <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Horário</span>
                <p>Seg-Sex: 10-18h</p>
                <p>Sáb: 10-17h</p>
              </li>
              <li className="flex flex-col">
                <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">E-mail</span>
                <a href={`mailto:${contactEmail}`} className="hover:text-sky-500 transition-colors truncate">{contactEmail}</a>
              </li>
              <li className="flex flex-col">
                <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Telefone</span>
                <a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="hover:text-sky-500 transition-colors">{contactPhone}</a>
              </li>
            </ul>
          </div>

          {/* Siga-nos — só desktop (no mobile fica junto com atendimento visualmente) */}
          <div className="hidden md:flex flex-col">
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-3">Siga-nos</h4>
            <a href={CORRECT_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-all hover:scale-110 w-fit">
              <Instagram size={24} />
            </a>
          </div>

          {/* Siga-nos — mobile inline com ícone pequeno */}
          <div className="col-span-2 md:hidden flex items-center gap-3 pt-1 border-t border-slate-100">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-[0.2em]">Siga-nos</span>
            <a href={CORRECT_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-all">
              <Instagram size={18} />
            </a>
          </div>

        </div>

        <div className="mt-4 md:mt-8 pt-3 md:pt-5 border-t border-slate-100 text-center">
          <p className="text-[9px] md:text-[10px] xl:text-xs uppercase tracking-[0.3em] text-slate-400">
            &copy; {new Date().getFullYear()} DKCWB. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;