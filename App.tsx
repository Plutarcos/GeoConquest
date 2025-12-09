import React, { useState, useEffect } from 'react';
import { GameStatus, Player, GameState, Language, ShopItem } from './types';
import { getUserLocation } from './services/geoService';
import { gameService } from './services/dbService';
import MapComponent from './components/Map';
import HUD from './components/HUD';
import { Shop } from './components/Shop';
import { Loader2, Crosshair, MapPin, Play } from 'lucide-react';
import { TRANSLATIONS } from './constants';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOGIN);
  const [username, setUsername] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [language, setLanguage] = useState<Language>('pt-BR');
  const [gameState, setGameState] = useState<GameState>({
    territories: {},
    players: {},
    currentPlayerId: null,
    selectedTerritoryId: null,
    lastUpdate: 0,
    centerLat: 0,
    centerLng: 0,
    connected: false
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showShop, setShowShop] = useState(false);

  const t = TRANSLATIONS[language];

  // Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem('geoconquest_user');
    if (savedUser) {
      const p = JSON.parse(savedUser);
      setUsername(p.username);
    }
  }, []);

  // Sync Loop (Polling for Multiplayer)
  useEffect(() => {
    if (status === GameStatus.PLAYING || status === GameStatus.SETUP) {
      const interval = setInterval(async () => {
        // Sync with Cloud
        const syncedState = await gameService.syncState(player?.id || null);
        
        setGameState(prev => {
          // Sync player money which might change in background loop
          if (player && syncedState.players[player.id]) {
            // Keep local reference updated
            setPlayer(prevP => {
                if (!prevP) return null;
                return { ...prevP, money: syncedState.players[player.id].money };
            });
          }
          return {
            ...syncedState,
            currentPlayerId: prev.currentPlayerId, // Preserve UI selection state
            selectedTerritoryId: prev.selectedTerritoryId 
          };
        });
      }, 2000); // Poll every 2 seconds
      return () => clearInterval(interval);
    }
  }, [status, player]);

  // Setup Phase: Auto-locate
  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setIsLocating(true);
      getUserLocation()
        .then(loc => {
           console.log("Found location:", loc);
           // Initialize grid around this location
           gameService.initLocalGrid(loc.lat, loc.lng);
           
           // Determine the territory ID for this exact location
           const myTerritoryId = gameService.getGridId(loc.lat, loc.lng);
           
           setGameState(prev => ({ 
             ...prev, 
             ...gameService.getLatestState(),
             selectedTerritoryId: myTerritoryId 
           }));
           
           showToast(t.located, 'success');
        })
        .catch((e) => {
           console.error(e);
           showToast("GPS Error. Using fallback.", 'error');
           // Fallback is handled inside gameService defaults usually, but we ensure grid init
           gameService.initLocalGrid(-23.5505, -46.6333); // Default SP
           setGameState(prev => ({ ...prev, ...gameService.getLatestState() }));
        })
        .finally(() => setIsLocating(false));
    }
  }, [status, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    
    try {
      const user = await gameService.login(username);
      setPlayer(user);
      localStorage.setItem('geoconquest_user', JSON.stringify(user));
      setStatus(GameStatus.SETUP);
    } catch (error) {
      console.error(error);
      setMessage("Login failed.");
    }
  };

  const handleStartGame = async () => {
    if (!player || !gameState.selectedTerritoryId) return;
    
    try {
      await gameService.captureTerritory(player.id, gameState.selectedTerritoryId);
      setStatus(GameStatus.PLAYING);
      showToast(t.startConquest, 'success');
    } catch (e) {
      showToast("Error starting game", 'error');
    }
  };

  const handleTerritoryClick = async (clickedId: string) => {
    if (status === GameStatus.SETUP) {
      setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
      return;
    }

    if (status !== GameStatus.PLAYING || !player) return;

    const clickedTerritory = gameState.territories[clickedId]; 
    if (!clickedTerritory) return; 

    // Gameplay Logic
    if (clickedTerritory.ownerId === player.id) {
      setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
    } else {
      if (gameState.selectedTerritoryId) {
        // Attempt Attack
        const result = await gameService.attackTerritory(player.id, gameState.selectedTerritoryId, clickedId);
        showToast(result.message, result.success ? 'success' : 'error');
        
        // Force immediate sync to show result
        const newState = await gameService.syncState(player.id);
        setGameState(prev => ({
           ...prev, 
           ...newState,
           selectedTerritoryId: result.success ? null : prev.selectedTerritoryId
        }));
      } else {
        showToast(t.cmd_select, 'info');
      }
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (!player) return;
    
    let targetId: string | undefined = undefined;
    if (item.id === 'recruit') {
       if (!gameState.selectedTerritoryId) {
         showToast("Select a territory first!", 'error');
         return;
       }
       targetId = gameState.selectedTerritoryId;
    }

    const result = await gameService.purchaseUpgrade(player.id, item.id, targetId);
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      setPlayer(prev => prev ? ({ ...prev, money: prev.money - item.cost }) : null);
      const newState = await gameService.syncState(player.id);
      setGameState(prev => ({ ...prev, ...newState }));
    }
  };

  const showToast = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-dark-bg text-white font-sans relative">
      
      {/* Background Map - Now Leaflet */}
      <div className={`transition-all duration-1000 w-full h-full ${status === GameStatus.PLAYING || status === GameStatus.SETUP ? 'opacity-100' : 'opacity-30 blur-sm'}`}>
         {/* Only render map if we have a center, otherwise wait for init */}
         {(gameState.centerLat !== 0) && (
             <MapComponent 
                centerLat={gameState.centerLat}
                centerLng={gameState.centerLng}
                territories={gameState.territories}
                players={gameState.players}
                currentPlayerId={player?.id || null}
                selectedTerritoryId={gameState.selectedTerritoryId}
                onTerritoryClick={handleTerritoryClick}
             />
         )}
      </div>

      {/* Login Screen */}
      {status === GameStatus.LOGIN && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-auto">
          <div className="bg-panel-bg p-8 rounded-2xl border border-neon-blue shadow-[0_0_50px_rgba(0,243,255,0.2)] backdrop-blur-xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-500">
            <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-neon-blue to-neon-green bg-clip-text text-transparent">
              {t.gameTitle}
            </h1>
            <p className="text-gray-400 text-center mb-8">{t.subTitle}</p>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">{t.loginPrompt}</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none transition"
                  placeholder="..."
                  required
                  maxLength={12}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-neon-blue hover:bg-cyan-400 text-black font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              >
                {t.loginBtn}
              </button>
              
              <div className="flex justify-center gap-4 text-sm text-gray-500 mt-4">
                 <button type="button" onClick={() => setLanguage('pt-BR')} className={language === 'pt-BR' ? 'text-neon-blue' : ''}>PT</button>
                 <button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? 'text-neon-blue' : ''}>EN</button>
                 <button type="button" onClick={() => setLanguage('es')} className={language === 'es' ? 'text-neon-blue' : ''}>ES</button>
                 <button type="button" onClick={() => setLanguage('de')} className={language === 'de' ? 'text-neon-blue' : ''}>DE</button>
                 <button type="button" onClick={() => setLanguage('zh')} className={language === 'zh' ? 'text-neon-blue' : ''}>CN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Setup / Location Screen */}
      {status === GameStatus.SETUP && (
         <div className="absolute bottom-10 left-0 right-0 flex justify-center z-[1000] px-4">
           <div className="bg-panel-bg border border-neon-green/50 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 animate-in slide-in-from-bottom duration-500">
              <div className="flex items-start justify-between">
                <div>
                   <h2 className="text-neon-green font-bold text-xl flex items-center gap-2">
                     <MapPin size={24} /> {t.selectBase}
                   </h2>
                   <p className="text-gray-400 text-sm mt-1">
                     {isLocating ? t.scanning : t.selectBaseDesc}
                   </p>
                </div>
              </div>

              {isLocating && (
                <div className="flex items-center gap-2 text-neon-blue text-sm animate-pulse">
                   <Loader2 className="animate-spin" size={16} /> {t.scanning}
                </div>
              )}

              <button 
                 onClick={handleStartGame}
                 disabled={!gameState.selectedTerritoryId}
                 className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                    gameState.selectedTerritoryId 
                    ? "bg-neon-green text-black hover:bg-green-400 shadow-lg shadow-green-500/20" 
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                 }`}
              >
                <Play size={20} fill="currentColor" /> {t.startConquest}
              </button>
           </div>
         </div>
      )}

      {/* HUD */}
      {status === GameStatus.PLAYING && player && (
        <HUD 
          player={player} 
          territories={gameState.territories} 
          language={language}
          connected={gameState.connected}
          onLanguageChange={setLanguage}
          onToggleShop={() => setShowShop(true)}
          onReset={() => gameService.resetGame()}
          onLogout={() => window.location.reload()}
        />
      )}

      {/* Shop Modal */}
      {showShop && player && (
        <Shop 
          language={language}
          currentMoney={player.money}
          onPurchase={handlePurchase}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* Toast Notification */}
      {message && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-[1100] w-max max-w-[90vw]">
           <div className="bg-black/90 border border-gray-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
              <Crosshair size={20} className="text-neon-red" />
              <span className="font-mono text-sm">{message}</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;