import { Wrench } from 'lucide-react';

const MaintenanceScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Animated Icon */}
        <div className="relative flex justify-center">
          <div className="absolute inset-0 bg-slate-900/5 rounded-full blur-3xl animate-pulse" />
          <div className="relative p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
            <Wrench className="h-20 w-20 text-slate-900 animate-[spin_8s_linear_infinite]" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tight">
            Site em Manutenção
          </h1>
          
          <div className="h-1 w-20 bg-slate-900 mx-auto rounded-full" />
          
          <p className="text-lg text-slate-600 font-medium leading-relaxed">
            Estamos trabalhando para melhorar sua experiência. Voltaremos em breve.
          </p>
        </div>

        {/* Decorative Elements */}
        <div className="pt-8 border-t border-slate-200/50">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            DKCWB &copy; 2025
          </p>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slate-900/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-900/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
};

export default MaintenanceScreen;
