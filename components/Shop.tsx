

import React, { useState } from 'react';
import { ShoppingCart, Shield, UserPlus, Skull, X, Zap, Crosshair, ShieldCheck, Filter } from 'lucide-react';
import { SHOP_ITEMS, TRANSLATIONS } from '../constants';
import { Language, ShopItem } from '../types';

interface ShopProps {
  language: Language;
  currentMoney: number;
  onPurchase: (item: ShopItem) => void;
  onClose: () => void;
}

export const Shop: React.FC<ShopProps> = ({ language, currentMoney, onPurchase, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'offense' | 'defense' | 'utility'>('all');
  const t = TRANSLATIONS[language];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'UserPlus': return <UserPlus size={32} />;
      case 'Shield': return <Shield size={32} />;
      case 'Skull': return <Skull size={32} />;
      case 'Zap': return <Zap size={32} />;
      case 'Crosshair': return <Crosshair size={32} />;
      case 'ShieldCheck': return <ShieldCheck size={32} />;
      default: return <ShoppingCart size={32} />;
    }
  };

  const filteredItems = SHOP_ITEMS.filter(item => {
      if (filter === 'all') return true;
      return (item as any).category === filter;
  });

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in p-4">
      <div className="bg-panel-bg border border-neon-blue rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,243,255,0.15)] relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-black/20">
            <div className="flex items-center gap-3">
                <div className="bg-neon-blue/20 p-2 rounded-lg text-neon-blue">
                   <ShoppingCart size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide">{t.shop}</h2>
                    <div className="text-neon-green font-mono text-sm flex items-center gap-1">
                         <span className="text-gray-400">{t.money}:</span> ${currentMoney}
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition">
                <X size={24} />
            </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex p-4 gap-2 overflow-x-auto border-b border-gray-700/50">
            {[
                { id: 'all', label: t.tab_all },
                { id: 'offense', label: t.category_offense },
                { id: 'defense', label: t.category_defense },
                { id: 'utility', label: t.category_utility },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                        filter === tab.id 
                        ? 'bg-neon-blue text-black shadow-lg shadow-neon-blue/20' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
               const canAfford = currentMoney >= item.cost;
               return (
                <div key={item.id} className={`group relative bg-black/40 border ${canAfford ? 'border-gray-700 hover:border-neon-blue' : 'border-red-900/30'} p-5 rounded-xl flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                    
                    <div className="flex justify-between items-start">
                        <div className={`${canAfford ? 'text-neon-blue group-hover:text-white' : 'text-gray-600'} transition-colors`}>
                            {getIcon(item.icon)}
                        </div>
                        <span className={`font-mono font-bold text-sm px-2 py-1 rounded ${canAfford ? 'bg-black/50 text-neon-green border border-neon-green/30' : 'text-red-500 bg-red-900/20'}`}>
                            ${item.cost}
                        </span>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg text-white group-hover:text-neon-blue transition-colors">{(t as any)[item.nameKey]}</h3>
                        <p className="text-xs text-gray-400 mt-1">{item.effect}</p>
                    </div>

                    <div className="mt-auto pt-4">
                        <button
                            onClick={() => onPurchase(item as ShopItem)}
                            disabled={!canAfford}
                            className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
                            canAfford 
                                ? "bg-neon-blue text-black hover:bg-cyan-300 shadow-lg shadow-cyan-500/20 active:scale-95" 
                                : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
                            }`}
                        >
                            {canAfford ? t.buy : 'Insuficiente'}
                        </button>
                    </div>
                </div>
               );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
