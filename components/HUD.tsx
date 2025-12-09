import React from 'react';
import { Player, Territory } from '../types';
import { Trophy, Users, Globe, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

interface HUDProps {
  player: Player;
  territories: Record<string, Territory>;
  onReset: () => void;
  onLogout: () => void;
}

const HUD: React.FC<HUDProps> = ({ player, territories, onReset, onLogout }) => {
  const ownedTerritories = (Object.values(territories) as Territory[]).filter(t => t.ownerId === player.id);
  const totalStrength = ownedTerritories.reduce((acc, t) => acc + t.strength, 0);
  const totalCount = ownedTerritories.length;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-4 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-panel-bg backdrop-blur-md border border-gray-700 p-4 rounded-lg shadow-2xl flex flex-col gap-2 max-w-xs">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center font-bold text-xl text-white">
               {player.username.substring(0, 1).toUpperCase()}
             </div>
             <div>
               <h2 className="text-neon-blue font-bold text-lg tracking-wider">{player.username}</h2>
               <p className="text-xs text-gray-400">Commander</p>
             </div>
          </div>
          
          <div className="h-px bg-gray-700 my-1"></div>

          <div className="grid grid-cols-2 gap-4">
             <div className="flex items-center gap-2 text-gray-300">
                <Globe size={18} className="text-neon-green" />
                <div>
                   <span className="block text-xs text-gray-500">Territories</span>
                   <span className="font-mono font-bold text-lg">{totalCount}</span>
                </div>
             </div>
             <div className="flex items-center gap-2 text-gray-300">
                <ShieldAlert size={18} className="text-yellow-500" />
                <div>
                   <span className="block text-xs text-gray-500">Strength</span>
                   <span className="font-mono font-bold text-lg">{totalStrength}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="flex gap-2">
            <button 
              onClick={onReset}
              className="bg-red-900/80 hover:bg-red-800 text-white p-2 rounded-lg border border-red-700 backdrop-blur transition"
              title="Reset Game State"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={onLogout}
              className="bg-gray-800/80 hover:bg-gray-700 text-white p-2 rounded-lg border border-gray-600 backdrop-blur transition"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
        </div>
      </div>

      {/* Bottom Status */}
      <div className="pointer-events-auto self-center bg-panel-bg backdrop-blur-md border border-gray-700 px-6 py-2 rounded-full mb-4">
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Live Multiplayer Connection: <span className="text-neon-green">Active (Simulated)</span>
        </p>
      </div>

      {/* Legend / Instructions */}
      <div className="pointer-events-auto absolute bottom-4 left-4 bg-panel-bg backdrop-blur-md border border-gray-700 p-4 rounded-lg hidden md:block">
         <h3 className="text-gray-300 font-bold mb-2 text-sm uppercase">Commands</h3>
         <ul className="text-xs space-y-1 text-gray-400">
           <li className="flex items-center gap-2"><div className="w-3 h-3 bg-[#0aff00]"></div> Your Territory</li>
           <li className="flex items-center gap-2"><div className="w-3 h-3 bg-[#334155]"></div> Neutral</li>
           <li className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ff003c]"></div> Enemy</li>
           <li className="mt-2 text-white">1. Select your territory</li>
           <li className="text-white">2. Click neighbor to attack</li>
           <li className="text-white italic opacity-70">Requires Strength {'>'} Target</li>
         </ul>
      </div>
    </div>
  );
};

export default HUD;