
import React from 'react';
import { ShoppingCart, Shield, UserPlus, Skull, X, Zap, Crosshair, ShieldCheck } from 'lucide-react';
import { SHOP_ITEMS, TRANSLATIONS } from '../constants';
import { Language, ShopItem } from '../types';

interface ShopProps {
  language: Language;
  currentMoney: number;
  onPurchase: (item: ShopItem) => void;
  onClose: () => void;
}

export const Shop: React.FC<ShopProps> = ({ language, currentMoney, onPurchase, onClose }) => {
  const t = TRANSLATIONS[language];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'UserPlus': return <UserPlus size={24} />;
      case 'Shield': return <Shield size={24} />;
      case 'Skull': return <Skull size={24} />;
      case 'Zap': return <Zap size={24} />;
      case 'Crosshair': return <Crosshair size={24} />;
      case 'ShieldCheck': return <ShieldCheck size={24} />;
      default: return <ShoppingCart size={24} />;
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-panel-bg border border-neon-blue rounded-xl p-6 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-neon-blue mb-4 flex items-center gap-2">
          <ShoppingCart /> {t.shop}
        </h2>
        
        <div className="mb-4 text-neon-green font-mono text-xl">
           {t.money}: ${currentMoney}
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {SHOP_ITEMS.map((item) => (
            <div key={item.id} className="bg-black/40 border border-gray-700 p-4 rounded-lg flex items-center justify-between hover:border-gray-500 transition">
              <div className="flex items-center gap-3">
                <div className="text-neon-blue">{getIcon(item.icon)}</div>
                <div>
                  <h3 className="font-bold text-white">{(t as any)[item.nameKey]}</h3>
                  <p className="text-xs text-gray-400">Cost: ${item.cost}</p>
                </div>
              </div>
              <button
                onClick={() => onPurchase(item)}
                disabled={currentMoney < item.cost}
                className={`px-4 py-2 rounded font-bold text-xs uppercase ${
                  currentMoney >= item.cost 
                    ? "bg-neon-blue text-black hover:bg-cyan-400" 
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                {t.buy}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
