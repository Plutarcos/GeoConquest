

import React from 'react';
import { Backpack, X, Zap, Shield, UserPlus, Skull, Crosshair, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { SHOP_ITEMS, TRANSLATIONS } from '../constants';
import { Language, Player, ShopItem } from '../types';

interface InventoryProps {
  player: Player;
  language: Language;
  onUseItem: (itemId: string, type: 'territory' | 'player' | 'enemy') => void;
  onClose: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ player, language, onUseItem, onClose }) => {
  const t = TRANSLATIONS[language];
  const items = player.inventory || {};
  
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'UserPlus': return <UserPlus size={28} />;
      case 'Shield': return <Shield size={28} />;
      case 'Skull': return <Skull size={28} />;
      case 'Zap': return <Zap size={28} />;
      case 'Crosshair': return <Crosshair size={28} />;
      case 'ShieldCheck': return <ShieldCheck size={28} />;
      default: return <Backpack size={28} />;
    }
  };

  const ownedItems = SHOP_ITEMS.filter(shopItem => (items[shopItem.id] || 0) > 0);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in p-4">
      <div className="bg-panel-bg border border-neon-green/50 rounded-2xl w-full max-w-2xl h-[70vh] flex flex-col shadow-[0_0_50px_rgba(10,255,0,0.1)] relative">
        
        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-black/20">
            <div className="flex items-center gap-3">
                <div className="bg-neon-green/20 p-2 rounded-lg text-neon-green">
                   <Backpack size={28} />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-wide">{t.inventory}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition">
                <X size={24} />
            </button>
        </div>

        {ownedItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                <Backpack size={64} strokeWidth={1} className="opacity-20" />
                <p className="italic text-lg">Mochila Vazia</p>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ownedItems.map((item) => (
                        <div key={item.id} className="bg-black/40 border border-gray-700 p-5 rounded-xl flex flex-col gap-4 hover:border-gray-500 transition-all hover:bg-black/60">
                            
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="text-neon-green p-2 bg-gray-900 rounded-lg border border-gray-700">
                                        {getIcon(item.icon)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{(t as any)[item.nameKey]}</h3>
                                        <div className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full mt-1">
                                            {item.type === 'player' ? t.targets_player : item.type === 'enemy' ? t.targets_enemy : t.targets_own}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-2xl font-mono font-bold text-white opacity-50">
                                    x{items[item.id]}
                                </div>
                            </div>

                            <button
                                onClick={() => onUseItem(item.id, item.type as ShopItem['type'])}
                                className="w-full py-3 rounded-lg font-bold text-xs bg-neon-green text-black hover:bg-green-400 uppercase tracking-wider shadow-lg shadow-green-500/10 flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                {t.use} <ArrowUpRight size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
