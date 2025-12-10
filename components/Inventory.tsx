

import React from 'react';
import { Backpack, X, Zap, Shield, UserPlus, Skull, Crosshair, ShieldCheck } from 'lucide-react';
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
      case 'UserPlus': return <UserPlus size={20} />;
      case 'Shield': return <Shield size={20} />;
      case 'Skull': return <Skull size={20} />;
      case 'Zap': return <Zap size={20} />;
      case 'Crosshair': return <Crosshair size={20} />;
      case 'ShieldCheck': return <ShieldCheck size={20} />;
      default: return <Backpack size={20} />;
    }
  };

  const ownedItems = SHOP_ITEMS.filter(shopItem => (items[shopItem.id] || 0) > 0);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-panel-bg border border-neon-blue rounded-xl p-6 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-neon-blue mb-4 flex items-center gap-2">
          <Backpack /> {t.inventory}
        </h2>

        {ownedItems.length === 0 ? (
            <div className="text-gray-500 text-center py-8 italic">Mochila Vazia</div>
        ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {ownedItems.map((item) => (
                <div key={item.id} className="bg-black/40 border border-gray-700 p-4 rounded-lg flex items-center justify-between hover:border-gray-500 transition">
                <div className="flex items-center gap-3">
                    <div className="text-neon-green">{getIcon(item.icon)}</div>
                    <div>
                    <h3 className="font-bold text-white">{(t as any)[item.nameKey]}</h3>
                    <p className="text-xs text-gray-400">Qtd: {items[item.id]}</p>
                    </div>
                </div>
                <button
                    onClick={() => onUseItem(item.id, item.type as ShopItem['type'])}
                    className="px-4 py-2 rounded font-bold text-xs bg-neon-green text-black hover:bg-green-400 uppercase"
                >
                    {t.use}
                </button>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};