import React from 'react';
import { Player, Territory, Language } from '../types';
import { Globe, ShieldAlert, RefreshCw, ShoppingCart, DollarSign, LogOut } from 'lucide-react';
import { TRANSLATIONS } from '../constants';

interface HUDProps {
  player: Player;
  territories: Record<string, Territory>;
  language: Language;
  connected: boolean;
  onLanguageChange: (lang: Language) => void;
  onToggleShop: () => void;
  onReset: () => void;
  onLogout: () => void;
}

const HUD: React.FC<HUDProps> = ({ 
  player, 
  territories, 
  language, 
  connected,
  onLanguageChange,
  onToggleShop,
  onReset, 
  onLogout 
}) => {
  const t = TRANSLATIONS[language];
  const ownedTerritories = (Object.values(territories) as Territory[]).filter(t => t.ownerId === player.id);
  const totalStrength = ownedTerritories.reduce((acc, t) => acc + t.strength, 0);
  const totalCount = ownedTerritories.length;

  return (
    <>
      {/* --- TOP BAR (Stats & Profile) --- */}
      <div className="absolute top-0 left-0 w-full p-2 md:p-4 z-[500] pointer-events-none flex justify-between items-start">
        
        {/* Profile Card */}
        <div className="bg-panel-bg backdrop-blur-md border border-gray-700/50 p-3 rounded-xl shadow-2xl flex flex-col gap-2 min-w-[160px] pointer-events-auto">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-lg border border-white/20">
               {player.username.substring(0, 1).toUpperCase()}
             </div>
             <div>
               <h2 className="text-neon-blue font-bold text-sm md:text-base tracking-wider leading-tight">{player.username}</h2>
               <div className="flex gap-1 mt-1">
                 {['pt-BR', 'en', 'es'].map((lang) => (
                    <button 
                      key={lang}
                      onClick={() => onLanguageChange(lang as Language)} 
                      className={`text-[10px] px-1 rounded border ${language === lang ? 'border-neon-blue text-neon-blue' : 'border-gray-700 text-gray-500'}`}
                    >
                      {lang === 'pt-BR' ? 'PT' : lang === 'en' ? 'EN' : 'ES'}
                    </button>
                 ))}
               </div>
             </div>
          </div>
          
          <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent my-1"></div>

          <div className="grid grid-cols-2 gap-2">
             <div className="flex flex-col">
                <div className="flex items-center gap-1 text-gray-400 text-[10px] uppercase">
                  <Globe size={10} /> {t.territories}
                </div>
                <span className="font-mono font-bold text-white">{totalCount}</span>
             </div>
             <div className="flex flex-col">
                <div className="flex items-center gap-1 text-gray-400 text-[10px] uppercase">
                  <ShieldAlert size={10} /> {t.strength}
                </div>
                <span className="font-mono font-bold text-white">{totalStrength}</span>
             </div>
          </div>
        </div>

        {/* Money Display (Top Right) */}
        <div className="bg-panel-bg backdrop-blur-md border border-neon-green/30 px-4 py-2 rounded-full shadow-lg pointer-events-auto flex items-center gap-2 text-neon-green">
           <DollarSign size={18} />
           <span className="font-mono font-bold text-xl">${Math.floor(player.money)}</span>
        </div>
      </div>

      {/* --- BOTTOM BAR (Actions) --- */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-md px-4 pointer-events-auto">
        <div className="bg-panel-bg backdrop-blur-xl border border-gray-700/50 rounded-2xl p-2 flex items-center justify-around shadow-2xl">
            
            <button 
              onClick={onToggleShop}
              className="flex flex-col items-center gap-1 p-2 text-yellow-400 hover:text-yellow-200 transition active:scale-95 group"
            >
              <div className="bg-yellow-500/20 p-2 rounded-lg group-hover:bg-yellow-500/40 border border-transparent group-hover:border-yellow-500/50 transition">
                <ShoppingCart size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide">{t.shop}</span>
            </button>

            <div className="w-px h-8 bg-gray-700"></div>

            <button 
              onClick={onReset}
              className="flex flex-col items-center gap-1 p-2 text-red-400 hover:text-red-200 transition active:scale-95 group"
            >
              <div className="bg-red-500/10 p-2 rounded-lg group-hover:bg-red-500/30 border border-transparent group-hover:border-red-500/50 transition">
                <RefreshCw size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide">{t.reset}</span>
            </button>

            <div className="w-px h-8 bg-gray-700"></div>

            <button 
              onClick={onLogout}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-white transition active:scale-95 group"
            >
               <div className="bg-gray-700/30 p-2 rounded-lg group-hover:bg-gray-600 transition">
                 <LogOut size={24} />
               </div>
              <span className="text-[10px] font-bold uppercase tracking-wide">{t.logout}</span>
            </button>

        </div>
      </div>
    </>
  );
};

export default HUD;