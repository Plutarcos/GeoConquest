import React from 'react';
import { Player, Territory, Language } from '../types';
import { Globe, ShieldAlert, LogOut, RefreshCw, ShoppingCart, DollarSign } from 'lucide-react';
import { TRANSLATIONS } from '../constants';

interface HUDProps {
  player: Player;
  territories: Record<string, Territory>;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onToggleShop: () => void;
  onReset: () => void;
  onLogout: () => void;
}

const HUD: React.FC<HUDProps> = ({ 
  player, 
  territories, 
  language, 
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
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-2 md:p-4 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-panel-bg backdrop-blur-md border border-gray-700 p-3 md:p-4 rounded-lg shadow-2xl flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center font-bold text-xl text-white">
               {player.username.substring(0, 1).toUpperCase()}
             </div>
             <div>
               <h2 className="text-neon-blue font-bold text-lg tracking-wider">{player.username}</h2>
               <div className="flex gap-2">
                 <button onClick={() => onLanguageChange('pt-BR')} className={`text-xs ${language === 'pt-BR' ? 'text-white' : 'text-gray-500'}`}>PT</button>
                 <button onClick={() => onLanguageChange('en')} className={`text-xs ${language === 'en' ? 'text-white' : 'text-gray-500'}`}>EN</button>
                 <button onClick={() => onLanguageChange('zh')} className={`text-xs ${language === 'zh' ? 'text-white' : 'text-gray-500'}`}>CN</button>
               </div>
             </div>
          </div>
          
          <div className="h-px bg-gray-700 my-1"></div>

          <div className="grid grid-cols-2 gap-2 md:gap-4">
             <div className="flex items-center gap-2 text-gray-300">
                <Globe size={16} className="text-neon-green" />
                <div>
                   <span className="block text-[10px] text-gray-500 uppercase">{t.territories}</span>
                   <span className="font-mono font-bold text-md">{totalCount}</span>
                </div>
             </div>
             <div className="flex items-center gap-2 text-gray-300">
                <ShieldAlert size={16} className="text-yellow-500" />
                <div>
                   <span className="block text-[10px] text-gray-500 uppercase">{t.strength}</span>
                   <span className="font-mono font-bold text-md">{totalStrength}</span>
                </div>
             </div>
             <div className="col-span-2 flex items-center gap-2 text-neon-green bg-black/30 p-1 rounded">
                <DollarSign size={16} />
                <span className="font-mono font-bold text-lg">${Math.floor(player.money)}</span>
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
            <button 
              onClick={onToggleShop}
              className="bg-yellow-600/80 hover:bg-yellow-500 text-white p-3 rounded-lg border border-yellow-400 backdrop-blur transition shadow-lg shadow-yellow-500/20"
              title={t.shop}
            >
              <ShoppingCart size={20} />
            </button>
            <div className="flex gap-2">
              <button 
                onClick={onReset}
                className="bg-red-900/80 hover:bg-red-800 text-white p-2 rounded-lg border border-red-700 backdrop-blur transition"
                title={t.reset}
              >
                <RefreshCw size={20} />
              </button>
              <button 
                onClick={onLogout}
                className="bg-gray-800/80 hover:bg-gray-700 text-white p-2 rounded-lg border border-gray-600 backdrop-blur transition"
                title={t.logout}
              >
                <LogOut size={20} />
              </button>
            </div>
        </div>
      </div>

      {/* Bottom Status */}
      <div className="pointer-events-auto self-center bg-panel-bg backdrop-blur-md border border-gray-700 px-6 py-2 rounded-full mb-4 hidden sm:flex">
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          {t.live}: <span className="text-neon-green">{t.active}</span>
        </p>
      </div>

      {/* Legend / Instructions */}
      <div className="pointer-events-auto absolute bottom-4 left-4 bg-panel-bg backdrop-blur-md border border-gray-700 p-4 rounded-lg hidden md:block max-w-xs">
         <h3 className="text-gray-300 font-bold mb-2 text-sm uppercase">{t.commands}</h3>
         <ul className="text-xs space-y-1 text-gray-400">
           <li className="flex items-center gap-2"><div className="w-3 h-3 bg-[#0aff00]"></div> {t.yours}</li>
           <li className="flex items-center gap-2"><div className="w-3 h-3 bg-[#1e293b]"></div> {t.neutral}</li>
           <li className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ff003c]"></div> {t.enemy}</li>
           <li className="mt-2 text-white">{t.cmd_select}</li>
           <li className="text-white">{t.cmd_attack}</li>
           <li className="text-white italic opacity-70">{t.cmd_req}</li>
         </ul>
      </div>
    </div>
  );
};

export default HUD;