import React, { useState, useEffect, useRef } from 'react';
import { GameStatus, Player, GameState, Territory } from './types';
import { getUserLocation } from './services/geoService';
import { gameService } from './services/dbService';
import MapComponent from './components/Map';
import HUD from './components/HUD';
import { Tooltip } from 'react-tooltip';
import { Loader2, Crosshair, MapPin, Play } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.LOGIN);
  const [username, setUsername] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    territories: {},
    players: {},
    currentPlayerId: null,
    selectedTerritoryId: null,
    lastUpdate: 0
  });
  const [message, setMessage] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  // Initial Data Load (TopoJSON features mapping to game state)
  useEffect(() => {
      // Init logic if needed, currently MapComponent + lazy init handles it
  }, []);

  // Game Loop Polling
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      const interval = setInterval(() => {
        setGameState(prev => {
          const freshState = gameService.getLatestState();
          return {
            ...freshState,
            // Keep local UI state like selection
            currentPlayerId: prev.currentPlayerId,
            selectedTerritoryId: prev.selectedTerritoryId 
          };
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Setup Phase: Auto-locate
  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setIsLocating(true);
      getUserLocation()
        .then(loc => {
           if (loc.countryCode) {
             console.log("Auto-located:", loc.countryCode);
             // We need to ensure the territory exists in state so we can select it
             gameService.ensureTerritory(loc.countryCode);
             setGameState(prev => ({ ...prev, selectedTerritoryId: loc.countryCode! }));
             showToast(`Located: ${loc.countryCode}`, 'success');
           } else {
             showToast("Could not determine location. Please select on map.", 'info');
           }
        })
        .finally(() => setIsLocating(false));
    }
  }, [status]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    
    try {
      const user = await gameService.login(username);
      setPlayer(user);
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
      showToast("Game Started! Territory Captured.", 'success');
    } catch (e) {
      showToast("Error starting game", 'error');
    }
  };

  const handleTerritoryClick = async (geo: any) => {
    // Ensure territory exists in DB
    if (!gameState.territories[geo.id]) {
      gameService.initMapData([{ id: geo.id, properties: geo.properties }]);
    }
    const clickedId = geo.id;

    if (status === GameStatus.SETUP) {
      // In setup mode, clicking just selects the starting point
      setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
      return;
    }

    if (status !== GameStatus.PLAYING || !player) return;

    const clickedTerritory = gameState.territories[clickedId]; 
    if (!clickedTerritory) return; 

    // Gameplay Logic
    if (clickedTerritory.ownerId === player.id) {
      setGameState(prev => ({ ...prev, selectedTerritoryId: clickedId }));
      showToast(`Selected ${clickedTerritory.name}`);
    } else {
      if (gameState.selectedTerritoryId) {
        // Attempt Attack
        const result = await gameService.attackTerritory(player.id, gameState.selectedTerritoryId, clickedId);
        showToast(result.message, result.success ? 'success' : 'error');
        // Force update
        setGameState(prev => ({
           ...prev, 
           ...gameService.getLatestState(),
           selectedTerritoryId: result.success ? null : prev.selectedTerritoryId
        }));
      } else {
        showToast("Select your territory first to attack!", 'info');
      }
    }
  };

  const showToast = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const getSelectedTerritoryName = () => {
    if (!gameState.selectedTerritoryId) return null;
    const t = gameState.territories[gameState.selectedTerritoryId];
    return t ? t.name : gameState.selectedTerritoryId;
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-dark-bg text-white font-sans relative">
      
      {/* Background Map - Always visible */}
      <div className={`transition-all duration-1000 ${status === GameStatus.PLAYING || status === GameStatus.SETUP ? 'opacity-100' : 'opacity-30 blur-sm'}`}>
         <MapComponent 
            territories={gameState.territories}
            players={gameState.players}
            currentPlayerId={player?.id || null}
            selectedTerritoryId={gameState.selectedTerritoryId}
            onTerritoryClick={handleTerritoryClick}
            setTooltipContent={setTooltipContent}
         />
         <Tooltip id="my-tooltip" content={tooltipContent} />
      </div>

      {/* Login Screen */}
      {status === GameStatus.LOGIN && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-panel-bg p-8 rounded-2xl border border-neon-blue shadow-[0_0_50px_rgba(0,243,255,0.2)] backdrop-blur-xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-500">
            <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-neon-blue to-neon-green bg-clip-text text-transparent">
              GEOCONQUEST
            </h1>
            <p className="text-gray-400 text-center mb-8">World Domination Strategy</p>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Codename</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none transition"
                  placeholder="Enter your alias..."
                  required
                  maxLength={12}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-neon-blue hover:bg-cyan-400 text-black font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              >
                INITIALIZE UPLINK
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Setup / Location Screen */}
      {status === GameStatus.SETUP && (
         <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50 px-4">
           <div className="bg-panel-bg border border-neon-green/50 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 animate-in slide-in-from-bottom duration-500">
              <div className="flex items-start justify-between">
                <div>
                   <h2 className="text-neon-green font-bold text-xl flex items-center gap-2">
                     <MapPin size={24} /> SELECT STARTING BASE
                   </h2>
                   <p className="text-gray-400 text-sm mt-1">
                     {isLocating ? "Scanning satellite feed..." : "Select a territory on the map to begin your conquest."}
                   </p>
                </div>
                {isLocating && <Loader2 className="animate-spin text-neon-green" />}
              </div>

              <div className="bg-black/40 p-3 rounded-lg border border-gray-700">
                <span className="text-xs text-gray-500 uppercase block mb-1">Selected Region</span>
                <span className="text-xl font-mono text-white font-bold">
                   {getSelectedTerritoryName() || "NO TERRITORY SELECTED"}
                </span>
              </div>

              <button 
                 onClick={handleStartGame}
                 disabled={!gameState.selectedTerritoryId}
                 className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                    gameState.selectedTerritoryId 
                    ? "bg-neon-green text-black hover:bg-green-400 shadow-lg shadow-green-500/20" 
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                 }`}
              >
                <Play size={20} fill="currentColor" /> START CONQUEST
              </button>
           </div>
         </div>
      )}

      {/* HUD */}
      {status === GameStatus.PLAYING && player && (
        <HUD 
          player={player} 
          territories={gameState.territories} 
          onReset={() => gameService.resetGame()}
          onLogout={() => window.location.reload()}
        />
      )}

      {/* Toast Notification */}
      {message && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-50 w-max max-w-[90vw]">
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