

import React, { useState, useEffect, useRef } from 'react';
import { GameStatus, Player, GameState, Language, ShopItem, VisualEffect, ChatMessage } from './types';
import { getUserLocation } from './services/geoService';
import { gameService } from './services/dbService';
import MapComponent from './components/Map';
import MapControls from './components/MapControls';
import HUD from './components/HUD';
import { Shop } from './components/Shop';
import { Inventory } from './components/Inventory';
import Chat from './components/Chat';
import { Loader2, Crosshair, MapPin, Play, Wifi, WifiOff, AlertTriangle, MousePointer2, XCircle } from 'lucide-react';
import { TRANSLATIONS } from './constants';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOGIN);
  const [username, setUsername] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [language, setLanguage] = useState<Language>('pt-BR');
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Login UI state
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
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
  const [showInventory, setShowInventory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(16);
  const [recenterTrigger, setRecenterTrigger] = useState(0); 
  const [visualEffects, setVisualEffects] = useState<VisualEffect[]>([]);
  
  // Action Modes
  const [targetingItem, setTargetingItem] = useState<{id: string, type: string} | null>(null);
  const [transferSource, setTransferSource] = useState<string | null>(null);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  // Keep track of user's real location for recentering
  const userRealLocation = useRef<{lat: number, lng: number} | null>(null);

  const t = TRANSLATIONS[language];

  // Initialize DB
  useEffect(() => {
    const init = async () => {
         // Setup Chat Callback before Init
         gameService.setChatCallback((msg) => {
             setChatMessages(prev => {
                 // Prevent dupes
                 if (prev.some(p => p.id === msg.id)) return prev;
                 return [...prev, msg].slice(-50); // Keep last 50
             });
             if (!showChat) setHasUnread(true);
         });

         await gameService.initDatabase();
         setIsInitializing(false);
    };
    init();
  }, [showChat]); 

  // Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem('geoconquest_user');
    if (savedUser) {
      try {
        const p = JSON.parse(savedUser);
        setUsername(p.username);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Sync Loop
  useEffect(() => {
    if (status === GameStatus.PLAYING || status === GameStatus.SETUP) {
      const interval = setInterval(async () => {
        const syncedState = await gameService.syncState(player?.id || null);
        
        // Permadeath Check
        if (player && syncedState.players && !syncedState.players[player.id]) {
           showToast("FATAL ERROR: SIGNAL LOST. BASE DESTROYED.", 'error');
           localStorage.removeItem('geoconquest_user');
           setTimeout(() => window.location.reload(), 3000);
           return;
        }

        setGameState(prev => {
          if (player && syncedState.players[player.id]) {
            setPlayer(prevP => {
                if (!prevP) return null;
                const pData = syncedState.players[player.id];
                return { 
                    ...prevP, 
                    money: pData.money,
                    energy: pData.energy,
                    inventory: pData.inventory
                };
            });
          }
          return {
            ...syncedState,
            currentPlayerId: prev.currentPlayerId,
            selectedTerritoryId: prev.selectedTerritoryId,
            centerLat: prev.centerLat,
            centerLng: prev.centerLng
          };
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [status, player]);

  // Setup Phase: Auto-locate and Check if new or returning
  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setIsLocating(true);
      getUserLocation()
        .then(async (loc) => {
           userRealLocation.current = { lat: loc.lat, lng: loc.lng };
           
           await gameService.initLocalGrid(loc.lat, loc.lng);
           const latestState = await gameService.syncState(player?.id || null);
           
           // CHECK IF RETURNING PLAYER
           if (player) {
               const ownedCount = await gameService.getUserTerritoryCount(player.id);
               if (ownedCount > 0) {
                   // Skip Setup
                   setGameState(prev => ({ 
                    ...prev, 
                    ...latestState,
                    centerLat: loc.lat,
                    centerLng: loc.lng 
                   }));
                   setRecenterTrigger(prev => prev + 1);
                   setStatus(GameStatus.PLAYING);
                   showToast(`Welcome back, Commander. You own ${ownedCount} sectors.`, 'success');
                   setIsLocating(false);
                   return;
               }
           }

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

  const handleSendMessage = async (text: string) => {
      if (!player) return;
      await gameService.sendGlobalMessage(player.username, text);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInitializing || isLoggingIn) return;

    let finalUsername = username.trim();
    if (!finalUsername) {
        finalUsername = `Guest_${Math.floor(Math.random()*9999)}`;
    }

    setIsLoggingIn(true);

    try {
      const user = await gameService.login(finalUsername);
      setPlayer(user);
      
      try {
        localStorage.setItem('geoconquest_user', JSON.stringify(user));
      } catch (storageError) {
        try {
            localStorage.clear(); 
            localStorage.setItem('geoconquest_user', JSON.stringify(user));
        } catch (retryError) {
            showToast("Warning: Session won't persist (Storage Full)", 'error');
        }
      }

      setStatus(GameStatus.SETUP);
    } catch (error: any) {
      console.error(error);
      setMessage(`ERROR: ${error.message || "Login failed"}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStartGame = async () => {
    if (!player || !gameState.selectedTerritoryId) return;

    const tStart = gameState.territories[gameState.selectedTerritoryId];
    if (tStart && tStart.ownerId && tStart.ownerId !== player.id) {
        showToast(t.error_occupied, 'error');
        return;
    }

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

    // --- MODE: ITEM TARGETING ---
    if (targetingItem) {
        const result = await gameService.useItem(player.id, targetingItem.id, clickedId);
        showToast(result.message, result.success ? 'success' : 'error');
        if (result.success) {
            setTargetingItem(null);
            addVisualEffect("ITEM USED", clickedTerritory.lat, clickedTerritory.lng, 'info');
        }
        return;
    }

    // --- MODE: TROOP TRANSFER ---
    if (transferSource) {
        if (transferSource === clickedId) {
            setTransferSource(null); // Cancel
            return;
        }
        const sourceT = gameState.territories[transferSource];
        if (sourceT) {
            if (!gameService.isAdjacent(sourceT, clickedTerritory)) {
                showToast(t.error_adjacent, 'error');
                return;
            }
            const amount = Math.floor(sourceT.strength / 2);
            if (amount < 5) {
                showToast("Not enough troops", 'error');
                return;
            }
            const result = await gameService.transferTroops(player.id, transferSource, clickedId, amount);
            showToast(result.message, result.success ? 'success' : 'error');
            if (result.success) {
                setTransferSource(null);
                addVisualEffect(`moved ${amount}`, clickedTerritory.lat, clickedTerritory.lng, 'heal');
            }
        }
        return;
    }

    // --- NORMAL MODE ---

    // 1. Clicked OWNED territory -> Select it
    if (clickedTerritory.ownerId === player.id) {
      setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
    } else {
      // 2. Clicked ENEMY/NEUTRAL -> Attempt Attack from SELECTED owned territory
      if (gameState.selectedTerritoryId) {
        const source = gameState.territories[gameState.selectedTerritoryId];
        
        // Validation: Must own source, and must be neighbor
        if (source && source.ownerId === player.id) {
          if (!gameService.isAdjacent(source, clickedTerritory)) {
             showToast(t.error_adjacent, 'error');
             return;
          }

          const result = await gameService.attackTerritory(player.id, gameState.selectedTerritoryId, clickedId);
          
          if (result.success) {
            addVisualEffect("VICTORY", clickedTerritory.lat, clickedTerritory.lng, 'heal');
            addVisualEffect("-1", source.lat, source.lng, 'info');
            // Auto select conquered
            setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
          } else {
             if (result.message && result.message.includes("Defense")) {
                addVisualEffect("BLOCKED", clickedTerritory.lat, clickedTerritory.lng, 'damage');
             }
             showToast(result.message || "Attack failed", 'error');
          }
        } else {
             setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
        }
      } else {
        setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
      }
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (!player) return;
    const result = await gameService.purchaseItem(player.id, item.id, item.cost);
    showToast(result.message, result.success ? 'success' : 'error');
    
    if (result.success) {
      const newState = await gameService.syncState(player.id);
      setGameState(prev => ({ ...prev, ...newState }));
    }
  };

  const handleUseItemStart = (itemId: string, type: 'territory'|'player'|'enemy') => {
      if (type === 'player') {
          // Instant use
          gameService.useItem(player!.id, itemId).then(res => {
             showToast(res.message, res.success ? 'success' : 'error');
             setShowInventory(false);
          });
      } else {
          // Enter targeting mode
          setTargetingItem({id: itemId, type});
          setShowInventory(false);
          showToast(t.select_target, 'info');
      }
  };

  const showToast = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRecenter = () => {
    if (userRealLocation.current) {
       setGameState(prev => ({ 
         ...prev, 
         centerLat: userRealLocation.current!.lat, 
         centerLng: userRealLocation.current!.lng 
       }));
       setZoomLevel(16);
       setRecenterTrigger(prev => prev + 1);
       return;
    }
    if (gameState.selectedTerritoryId) {
       const t = gameState.territories[gameState.selectedTerritoryId];
       if (t) {
         setGameState(prev => ({ ...prev, centerLat: t.lat, centerLng: t.lng }));
         setRecenterTrigger(prev => prev + 1);
       }
    }
  };

  return (
    <div className={`w-screen h-screen overflow-hidden bg-dark-bg text-white font-sans relative select-none ${targetingItem ? 'cursor-crosshair' : ''}`}>
      
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

      {/* Target Mode Overlay HUD */}
      {targetingItem && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[900] bg-neon-green/90 text-black px-6 py-3 rounded-full font-bold animate-pulse flex items-center gap-4 shadow-[0_0_30px_rgba(10,255,0,0.6)] border-2 border-white cursor-pointer" onClick={() => setTargetingItem(null)}>
              <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <MousePointer2 size={24} /> 
                    <span className="uppercase tracking-wider">{t.select_target}</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-mono">
                      {targetingItem.type === 'enemy' ? t.targets_enemy : t.targets_own}
                  </span>
              </div>
              <div className="h-8 w-px bg-black/20"></div>
              <div className="flex items-center gap-1 text-xs hover:bg-black/10 px-2 py-1 rounded">
                  <XCircle size={16} /> {t.cancel}
              </div>
          </div>
      )}

      {transferSource && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[900] bg-blue-500/90 text-white px-6 py-3 rounded-full font-bold animate-pulse flex items-center gap-4 shadow-[0_0_30px_rgba(59,130,246,0.6)] border-2 border-white cursor-pointer" onClick={() => setTransferSource(null)}>
              <div className="flex flex-col items-start">
                 <div className="flex items-center gap-2">
                    <MousePointer2 size={24} /> 
                    <span className="uppercase tracking-wider">{t.select_transfer}</span>
                 </div>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="flex items-center gap-1 text-xs hover:bg-white/10 px-2 py-1 rounded">
                  <XCircle size={16} /> {t.cancel}
              </div>
          </div>
      )}

      {/* Map Controls */}
      {(status === GameStatus.PLAYING || status === GameStatus.SETUP) && (
        <MapControls 
          zoom={zoomLevel}
          onZoomChange={setZoomLevel}
          onRecenter={handleRecenter}
        />
      )}

      {/* Initializing Spinner */}
      {isInitializing && (
         <div className="absolute inset-0 flex flex-col items-center justify-center z-[1100] bg-black/80 backdrop-blur-md">
            <Loader2 className="animate-spin text-neon-blue mb-4" size={48} />
            <div className="font-mono text-neon-blue animate-pulse tracking-widest">INITIALIZING UPLINK...</div>
            <div className="text-xs text-gray-500 mt-2">Connecting to Satellite Network</div>
         </div>
      )}

      {/* Login Screen */}
      {!isInitializing && status === GameStatus.LOGIN && (
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
                  className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition font-mono mb-2"
                  placeholder="CODENAME (Optional for Guest)"
                  maxLength={12}
                  disabled={isLoggingIn}
                />
              </div>
              
              <div className="bg-red-900/30 border border-red-500/50 p-2 rounded text-[10px] text-gray-300 flex items-start gap-2">
                 <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                 {t.permadeathWarn}
              </div>

              <button 
                type="submit"
                disabled={isLoggingIn}
                className={`w-full font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${
                  isLoggingIn 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-neon-blue hover:bg-cyan-400 text-black'
                }`}
              >
                {isLoggingIn ? (
                  <>
                     <Loader2 className="animate-spin" size={20} />
                     Autenticando...
                  </>
                ) : (
                  username ? t.loginBtn : t.guestLogin
                )}
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
      {!isInitializing && status === GameStatus.SETUP && (
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
      {!isInitializing && status === GameStatus.PLAYING && player && (
        <HUD 
          player={player} 
          territories={gameState.territories} 
          language={language}
          connected={gameState.connected}
          hasUnreadMessages={hasUnread}
          selectedTerritory={gameState.selectedTerritoryId ? gameState.territories[gameState.selectedTerritoryId] : null}
          onLanguageChange={setLanguage}
          onToggleShop={() => setShowShop(true)}
          onToggleInventory={() => setShowInventory(true)}
          onToggleChat={() => {
             setShowChat(!showChat);
             if (!showChat) setHasUnread(false);
          }}
          onTransferStart={() => setTransferSource(gameState.selectedTerritoryId)}
          onReset={() => gameService.resetGame()}
          onLogout={() => window.location.reload()}
        />
      )}

      {/* Shop */}
      {!isInitializing && showShop && player && (
        <Shop 
          language={language}
          currentMoney={player.money}
          onPurchase={handlePurchase}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* Inventory */}
      {!isInitializing && showInventory && player && (
        <Inventory 
          player={player}
          language={language}
          onUseItem={handleUseItemStart}
          onClose={() => setShowInventory(false)}
        />
      )}

      {/* Chat */}
      {!isInitializing && status === GameStatus.PLAYING && player && (
         <Chat 
           messages={chatMessages}
           player={player}
           language={language}
           isOpen={showChat}
           onClose={() => setShowChat(false)}
           onSendMessage={handleSendMessage}
         />
      )}

      {/* Notifications */}
      {message && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-[1100] w-max max-w-[90vw] animate-in slide-in-from-top-4 fade-in duration-300">
           <div className={`backdrop-blur-md border px-6 py-3 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-3 ${
             message.includes("Error") || message.includes("Offline") || message.includes("Failed") || message.includes("!")
             ? 'bg-red-900/80 border-red-500 text-white' 
             : 'bg-black/80 border-neon-blue/30 text-white'
           }`}>
              {message.includes("Online") || message.includes("Connected") ? <Wifi size={20} className="text-neon-green" /> : 
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
