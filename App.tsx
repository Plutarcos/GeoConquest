

import React, { useState, useEffect, useRef } from 'react';
import { GameStatus, Player, GameState, Language, ShopItem, VisualEffect, ChatMessage } from './types';
import { getUserLocation } from './services/geoService';
import { gameService } from './services/dbService';
import MapComponent from './components/Map';
import MapControls from './components/MapControls';
import HUD from './components/HUD';
import { Shop } from './components/Shop';
import Chat from './components/Chat';
import { Loader2, Crosshair, MapPin, Play, Wifi, WifiOff } from 'lucide-react';
import { TRANSLATIONS } from './constants';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOGIN);
  const [username, setUsername] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [language, setLanguage] = useState<Language>('pt-BR');
  
  // Game State
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
  
  // UI State
  const [message, setMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(16);
  const [recenterTrigger, setRecenterTrigger] = useState(0); 
  const [visualEffects, setVisualEffects] = useState<VisualEffect[]>([]);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  // Keep track of user's real location for recentering
  const userRealLocation = useRef<{lat: number, lng: number} | null>(null);

  const t = TRANSLATIONS[language];

  // Initialize DB
  useEffect(() => {
    const init = async () => {
       try {
         await gameService.initDatabase();
         const state = gameService.getLatestState();
         setGameState(prev => ({...prev, connected: state.connected}));
         
         if(state.connected) {
             showToast("Online Mode Active", 'success');
         } else {
             showToast("Offline / Local Mode Active", 'info');
         }
       } catch (e) {
         console.error("DB Init critical fail", e);
         showToast("Connection Failed - Local Mode", 'error');
       }
    };
    init();
  }, []);

  // Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem('geoconquest_user');
    if (savedUser) {
      const p = JSON.parse(savedUser);
      setUsername(p.username);
    }
  }, []);

  // Sync Loop
  useEffect(() => {
    if (status === GameStatus.PLAYING || status === GameStatus.SETUP) {
      const interval = setInterval(async () => {
        const syncedState = await gameService.syncState(player?.id || null);
        setGameState(prev => {
          if (player && syncedState.players[player.id]) {
            setPlayer(prevP => {
                if (!prevP) return null;
                return { ...prevP, money: syncedState.players[player.id].money };
            });
          }
          return {
            ...syncedState,
            currentPlayerId: prev.currentPlayerId,
            selectedTerritoryId: prev.selectedTerritoryId,
            // Don't override center if user is dragging, unless recentered
            centerLat: prev.centerLat,
            centerLng: prev.centerLng
          };
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [status, player]);

  // Setup Phase: Auto-locate
  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setIsLocating(true);
      getUserLocation()
        .then(async (loc) => {
           userRealLocation.current = { lat: loc.lat, lng: loc.lng };
           
           // Gera grid local
           await gameService.initLocalGrid(loc.lat, loc.lng);
           
           // Força sincronização imediata
           const latestState = await gameService.syncState(player?.id || null);
           
           const myTerritoryId = gameService.getGridId(loc.lat, loc.lng);
           
           setGameState(prev => ({ 
             ...prev, 
             ...latestState,
             centerLat: loc.lat,
             centerLng: loc.lng,
             selectedTerritoryId: myTerritoryId 
           }));
           setRecenterTrigger(prev => prev + 1);
           showToast(t.located, 'success');
        })
        .catch((e) => {
           console.error(e);
           showToast("GPS Error. Using fallback.", 'error');
           const defLat = -23.5505; 
           const defLng = -46.6333;
           userRealLocation.current = { lat: defLat, lng: defLng };
           gameService.initLocalGrid(defLat, defLng);
           setGameState(prev => ({ 
             ...prev, 
             ...gameService.getLatestState(),
             centerLat: defLat, 
             centerLng: defLng 
            }));
        })
        .finally(() => setIsLocating(false));
    }
  }, [status, t]);

  // Cleanup effects
  useEffect(() => {
    if (visualEffects.length > 0) {
      const timer = setTimeout(() => {
        setVisualEffects(prev => prev.slice(1)); // Remove oldest
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [visualEffects]);

  const addVisualEffect = (text: string, lat: number, lng: number, type: 'damage' | 'heal' | 'info') => {
    setVisualEffects(prev => [...prev, {
      id: Date.now() + Math.random(),
      lat,
      lng,
      text,
      type,
      color: type === 'damage' ? 'red' : type === 'heal' ? 'green' : 'white'
    }]);
  };

  const addChatMessage = (text: string, sender: string = "System", isSystem: boolean = false) => {
    setChatMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      sender,
      text,
      timestamp: Date.now(),
      isSystem
    }]);
    if (!showChat) setHasUnread(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    try {
      const user = await gameService.login(username);
      setPlayer(user);
      localStorage.setItem('geoconquest_user', JSON.stringify(user));
      setStatus(GameStatus.SETUP);
      addChatMessage(`Agent ${user.username} connected.`, "System", true);
    } catch (error) {
      console.error(error);
      setMessage("Login failed. Check Connection.");
    }
  };

  const handleStartGame = async () => {
    if (!player || !gameState.selectedTerritoryId) return;
    try {
      await gameService.captureTerritory(player.id, gameState.selectedTerritoryId);
      setStatus(GameStatus.PLAYING);
      showToast(t.startConquest, 'success');
      addChatMessage("Sector occupation initiated.", "System", true);
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

    // Visual feedback
    if (clickedTerritory.ownerId === player.id) {
      setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
    } else {
      if (gameState.selectedTerritoryId) {
        // Attack Logic
        const source = gameState.territories[gameState.selectedTerritoryId];
        const result = await gameService.attackTerritory(player.id, gameState.selectedTerritoryId, clickedId);
        
        // Show combat text
        if (source) {
          if (result.success) {
            addVisualEffect("VICTORY", clickedTerritory.lat, clickedTerritory.lng, 'heal');
            addVisualEffect("-1", source.lat, source.lng, 'info');
            addChatMessage(`${player.username} conquered ${clickedTerritory.name}!`, "System", true);
          } else {
            if (result.message.includes("failed")) {
               addVisualEffect("DEFENDED", clickedTerritory.lat, clickedTerritory.lng, 'damage');
               addVisualEffect("-1", source.lat, source.lng, 'damage');
            } else {
               showToast(result.message, 'error');
            }
          }
        }

        // Force Sync immediately
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
      if (targetId && item.id === 'recruit') {
         const t = gameState.territories[targetId];
         if (t) addVisualEffect("+10", t.lat, t.lng, 'heal');
      }

      setPlayer(prev => prev ? ({ ...prev, money: prev.money - item.cost }) : null);
      const newState = await gameService.syncState(player.id);
      setGameState(prev => ({ ...prev, ...newState }));
    }
  };

  const showToast = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRecenter = () => {
    // If we have GPS location, use it
    if (userRealLocation.current) {
       setGameState(prev => ({ 
         ...prev, 
         centerLat: userRealLocation.current!.lat, 
         centerLng: userRealLocation.current!.lng 
       }));
       setZoomLevel(16); // Reset Zoom
       setRecenterTrigger(prev => prev + 1);
       return;
    }

    // Fallback to selected territory
    if (gameState.selectedTerritoryId) {
       const t = gameState.territories[gameState.selectedTerritoryId];
       if (t) {
         setGameState(prev => ({ ...prev, centerLat: t.lat, centerLng: t.lng }));
         setRecenterTrigger(prev => prev + 1);
       }
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-dark-bg text-white font-sans relative select-none">
      
      {/* Background Map */}
      <div className={`transition-all duration-1000 w-full h-full ${status === GameStatus.PLAYING || status === GameStatus.SETUP ? 'opacity-100' : 'opacity-30 blur-sm'}`}>
         {(gameState.centerLat !== 0) && (
             <MapComponent 
                centerLat={gameState.centerLat}
                centerLng={gameState.centerLng}
                zoomLevel={zoomLevel}
                territories={gameState.territories}
                players={gameState.players}
                currentPlayerId={player?.id || null}
                selectedTerritoryId={gameState.selectedTerritoryId}
                visualEffects={visualEffects}
                onTerritoryClick={handleTerritoryClick}
                onZoomChange={setZoomLevel}
                recenterTrigger={recenterTrigger}
             />
         )}
      </div>

      {/* Map Controls */}
      {(status === GameStatus.PLAYING || status === GameStatus.SETUP) && (
        <MapControls 
          zoom={zoomLevel}
          onZoomChange={setZoomLevel}
          onRecenter={handleRecenter}
        />
      )}

      {/* Login Screen */}
      {status === GameStatus.LOGIN && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-auto bg-black/40 backdrop-blur-sm">
          <div className="bg-panel-bg p-8 rounded-2xl border border-neon-blue shadow-[0_0_50px_rgba(0,243,255,0.2)] max-w-md w-full mx-4 animate-in fade-in zoom-in duration-500">
            <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-neon-blue to-neon-green bg-clip-text text-transparent tracking-widest">
              {t.gameTitle}
            </h1>
            <p className="text-gray-400 text-center mb-8 font-mono text-xs">{t.subTitle}</p>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">{t.loginPrompt}</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition font-mono"
                  placeholder="CODENAME"
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
              
              <div className="flex justify-center gap-4 text-sm text-gray-500 mt-4 border-t border-gray-800 pt-4">
                 <button type="button" onClick={() => setLanguage('pt-BR')} className={language === 'pt-BR' ? 'text-neon-blue font-bold' : 'hover:text-gray-300'}>PT</button>
                 <button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? 'text-neon-blue font-bold' : 'hover:text-gray-300'}>EN</button>
                 <button type="button" onClick={() => setLanguage('es')} className={language === 'es' ? 'text-neon-blue font-bold' : 'hover:text-gray-300'}>ES</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Setup Screen */}
      {status === GameStatus.SETUP && (
         <div className="absolute bottom-24 md:bottom-10 left-0 right-0 flex justify-center z-[1000] px-4 pointer-events-none">
           <div className="pointer-events-auto bg-panel-bg border border-neon-green/50 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 animate-in slide-in-from-bottom duration-500">
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
                <div className="flex items-center gap-2 text-neon-blue text-sm animate-pulse font-mono">
                   <Loader2 className="animate-spin" size={16} /> {t.scanning}
                </div>
              )}

              <button 
                 onClick={handleStartGame}
                 disabled={!gameState.selectedTerritoryId}
                 className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                    gameState.selectedTerritoryId 
                    ? "bg-neon-green text-black hover:bg-green-400 shadow-lg shadow-green-500/20 transform hover:scale-[1.02]" 
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
          hasUnreadMessages={hasUnread}
          onLanguageChange={setLanguage}
          onToggleShop={() => setShowShop(true)}
          onToggleChat={() => {
             setShowChat(!showChat);
             if (!showChat) setHasUnread(false);
          }}
          onReset={() => gameService.resetGame()}
          onLogout={() => window.location.reload()}
        />
      )}

      {/* Shop */}
      {showShop && player && (
        <Shop 
          language={language}
          currentMoney={player.money}
          onPurchase={handlePurchase}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* Chat */}
      {status === GameStatus.PLAYING && player && (
         <Chat 
           messages={chatMessages}
           player={player}
           language={language}
           isOpen={showChat}
           onClose={() => setShowChat(false)}
           onSendMessage={(text) => addChatMessage(text, player.username)}
         />
      )}

      {/* Notifications */}
      {message && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-[1100] w-max max-w-[90vw] animate-in slide-in-from-top-4 fade-in duration-300">
           <div className={`backdrop-blur-md border px-6 py-3 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-3 ${
             message.includes("Error") || message.includes("Offline") || message.includes("Failed")
             ? 'bg-red-900/80 border-red-500 text-white' 
             : 'bg-black/80 border-neon-blue/30 text-white'
           }`}>
              {message.includes("Online") ? <Wifi size={20} className="text-neon-green" /> : 
               message.includes("Offline") ? <WifiOff size={20} className="text-red-400" /> :
               <Crosshair size={20} className="text-neon-blue" />
              }
              <span className="font-mono text-sm tracking-wide">{message}</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;