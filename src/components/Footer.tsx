import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const Footer = () => {
  const { settings } = useTheme();

  return (
    <footer className="bg-white text-slate-500 border-t border-slate-200">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-1">
            <h3 className="text-xl text-sky-500 mb-6 uppercase font-black italic tracking-tighter">DKCWB.</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Curadoria exclusiva e inovação em cada detalhe. A sua fonte definitiva para a melhor experiência premium.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-6">Navegação</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link to="/" className="hover:text-sky-500 transition-colors">Início</Link></li>
              <li><Link to="/produtos" className="hover:text-sky-500 transition-colors">Produtos</Link></li>
              <li><Link to="/dashboard" className="hover:text-sky-500 transition-colors">Minha Conta</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-6">Atendimento</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Horário</span>
                <p>{settings.contactHours}</p>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">E-mail</span>
                <p>{settings.contactEmail}</p>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Telefone</span>
                <p>{settings.contactPhone}</p>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-6">Siga-nos</h4>
            <div className="flex space-x-6">
              <a href={settings.socialFacebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-all hover:scale-110"><Facebook size={22} /></a>
              <a href={settings.socialInstagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-all hover:scale-110"><Instagram size={22} /></a>
              <a href={settings.socialTwitter} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-all hover:scale-110"><Twitter size={22} /></a>
            </div>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
            &copy; {new Date().getFullYear()} DKCWB. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;