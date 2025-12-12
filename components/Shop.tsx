

import React, { useState } from 'react';
import { ShoppingCart, Shield, UserPlus, Skull, X, Zap, Crosshair, ShieldCheck, Filter, Loader2, Info } from 'lucide-react';
import { SHOP_ITEMS, TRANSLATIONS } from '../constants';
import { Language, ShopItem } from '../types';

interface ShopProps {
  language: Language;
  currentMoney: number;
  onPurchase: (item: ShopItem) => Promise<void>;
  onClose: () => void;
}

export const Shop: React.FC<ShopProps> = ({ language, currentMoney, onPurchase, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'offense' | 'defense' | 'utility'>('all');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const t = TRANSLATIONS[language];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'UserPlus': return <UserPlus size={40} strokeWidth={1.5} />;
      case 'Shield': return <Shield size={40} strokeWidth={1.5} />;
      case 'Skull': return <Skull size={40} strokeWidth={1.5} />;
      case 'Zap': return <Zap size={40} strokeWidth={1.5} />;
      case 'Crosshair': return <Crosshair size={40} strokeWidth={1.5} />;
      case 'ShieldCheck': return <ShieldCheck size={40} strokeWidth={1.5} />;
      default: return <ShoppingCart size={40} strokeWidth={1.5} />;
    }
  };

  const handleBuy = async (item: ShopItem) => {
      setPurchasingId(item.id);
      await onPurchase(item);
      setPurchasingId(null);
  };

  const filteredItems = SHOP_ITEMS.filter(item => {
      if (filter === 'all') return true;
      return (item as any).category === filter;
  });

  return (
    <div className="absolute inset-0 z-[1400] flex items-center justify-center bg-black/90 backdrop-blur-lg animate-fade-in p-4">
      <div className="bg-dark-bg border border-neon-blue rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-[0_0_80px_rgba(0,243,255,0.1)] relative overflow-hidden">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-neon-blue/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-purple/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-black/40 z-10">
            <div className="flex items-center gap-4">
                <div className="bg-neon-blue/10 p-3 rounded-xl text-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.3)] border border-neon-blue/30">
                   <ShoppingCart size={28} />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-widest uppercase font-mono">{t.shop}</h2>
                    <div className="text-neon-green font-mono text-base flex items-center gap-2 mt-1">
                         <span className="text-gray-500 uppercase text-xs tracking-wide">{t.money}:</span> 
                         <span className="font-bold text-xl">${currentMoney}</span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white hover:bg-white/10 p-3 rounded-full transition-all active:scale-95">
                <X size={28} />
            </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex px-6 py-4 gap-3 overflow-x-auto border-b border-gray-800 z-10">
            {[
                { id: 'all', label: t.tab_all },
                { id: 'offense', label: t.category_offense },
                { id: 'defense', label: t.category_defense },
                { id: 'utility', label: t.category_utility },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${
                        filter === tab.id 
                        ? 'bg-neon-blue/20 text-neon-blue border-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.2)]' 
                        : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200'
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
               const canAfford = currentMoney >= item.cost;
               const isBuying = purchasingId === item.id;
               const descKey = (item as any).descKey;
               
               return (
                <div key={item.id} className={`group relative bg-gray-900/40 backdrop-blur border ${canAfford ? 'border-gray-700 hover:border-neon-blue/50' : 'border-red-900/30 opacity-70'} p-0 rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden`}>
                    
                    {/* Item Image/Icon Area */}
                    <div className={`h-32 flex items-center justify-center bg-gradient-to-b ${canAfford ? 'from-gray-800 to-gray-900/0' : 'from-red-900/20 to-gray-900/0'}`}>
                        <div className={`transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl ${canAfford ? 'text-neon-blue' : 'text-gray-600'}`}>
                            {getIcon(item.icon)}
                        </div>
                    </div>

                    <div className="p-5 flex flex-col gap-3 flex-1">
                        <div className="flex justify-between items-start">
                             <h3 className="font-bold text-xl text-white group-hover:text-neon-blue transition-colors uppercase tracking-wide">{(t as any)[item.nameKey]}</h3>
                             <span className={`font-mono font-bold text-sm px-3 py-1 rounded-full border ${canAfford ? 'bg-black/50 text-neon-green border-neon-green/30 shadow-[0_0_10px_rgba(10,255,0,0.1)]' : 'text-red-500 bg-red-900/10 border-red-900/30'}`}>
                                ${item.cost}
                            </span>
                        </div>

                        <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-800 pt-3 min-h-[60px]">
                           {(t as any)[descKey]}
                        </div>

                        <div className="mt-auto pt-2">
                             <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold mb-3 tracking-wider">
                                <Info size={12} />
                                {item.type === 'territory' ? t.targets_own : item.type === 'enemy' ? t.targets_enemy : t.targets_player}
                             </div>

                            <button
                                onClick={() => handleBuy(item as ShopItem)}
                                disabled={!canAfford || isBuying}
                                className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                                canAfford 
                                    ? "bg-white text-black hover:bg-neon-blue hover:text-black hover:shadow-[0_0_20px_rgba(0,243,255,0.5)]" 
                                    : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"
                                }`}
                            >
                                {isBuying ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} /> PROCESSING
                                    </>
                                ) : (
                                    <>
                                        {canAfford ? t.buy : t.insufficient_funds}
                                    </>
                                )}
                            </button>
                        </div>
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
