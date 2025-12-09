import React, { useState, useEffect, useRef } from 'react';
import { GameStatus, Player, GameState, Territory } from './types';
import { getUserLocation } from './services/geoService';
import { gameService } from './services/dbService';
import MapComponent from './components/Map';
import HUD from './components/HUD';
import { Tooltip } from 'react-tooltip';
import { Loader2, Crosshair } from 'lucide-react';

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

  // Initial Data Load (TopoJSON features mapping to game state)
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json")
      .then(res => res.json())
      .then(topology => {
        // @ts-ignore
        const { features } = topology.objects.countries1; // Depends on topojson structure
        // Usually we need to convert to geojson using 'topojson-client', but react-simple-maps does it internally.
        // However, to init our DB state, we need the IDs.
        // For simplicity, we trust the MapComponent will render based on IDs, but let's pre-seed the Service
        // We can't easily extract features here without the library, so we will lazy-init inside the map click or first render
        // Actually, we can just let the map render and we init territories as they are interacted with or fully mocked.
        
        // BETTER: Fetch the GeoJSON version directly to init state IDs
      });
      
      // Since we don't have topojson-client, we will init territories on the fly or load a pre-set list?
      // Hack: We'll wait for the Map to load geographics and use `onTerritoryClick` logic, 
      // but actually `react-simple-maps` fetches internally. 
      // We will perform a fetch here just to get IDs to init the "database"
      fetch("https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json")
       .then(r => r.json())
       .then(data => {
          // This is a topojson file. We need to iterate objects.
          // Since we can't parse efficiently without library, we will rely on a generic list of country codes 
          // or just init them in the `gameService` when map is interacted.
          // But `initMapData` expects something.
          // Let's assume the user clicks start and we can use a hardcoded list of major countries for the MVP if needed, 
          // or just let them be created dynamically.
          // Let's try to extract IDs if possible, if not, we wait.
       });
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setStatus(GameStatus.LOCATING);
    
    try {
      // 1. Get User
      const user = await gameService.login(username);
      setPlayer(user);

      // 2. Get Location
      try {
        const location = await getUserLocation();
        console.log("User location:", location);
        
        // 3. Assign Start Territory
        // In a real app using d3-geo, we would check which feature contains the point.
        // Here, we might check if we got a country code from IP API
        if (location.countryCode) {
           await gameService.captureTerritory(user.id, location.countryCode);
        } else {
           // Fallback: Assign a random one or USA/CHN if code unknown
           await gameService.captureTerritory(user.id, "USA");
        }
      } catch (err) {
        console.warn("Location failed, defaulting to USA");
        await gameService.captureTerritory(user.id, "USA");
      }

      setStatus(GameStatus.PLAYING);
    } catch (error) {
      console.error(error);
      setMessage("Login failed.");
      setStatus(GameStatus.LOGIN);
    }
  };

  const handleTerritoryClick = async (geo: any) => {
    if (!player) return;

    // Ensure territory exists in DB
    if (!gameState.territories[geo.id]) {
      // It's a new territory discovered by interaction (since we lazy loaded)
      // Ideally this should be pre-seeded.
      gameService.initMapData([{ id: geo.id, properties: geo.properties }]);
    }

    const clickedId = geo.id;
    const clickedTerritory = gameState.territories[clickedId]; // Might be undefined briefly if not synced yet
    
    // If not in state yet, wait for next tick or force init?
    // We will rely on the next polling tick to pick it up if we just init'd it, 
    // but for instant UI feedback let's be careful.
    if (!clickedTerritory) return; 

    // Logic:
    // 1. If we own it -> Select it
    // 2. If we have a selection and click another -> Attack?

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
           selectedTerritoryId: result.success ? null : prev.selectedTerritoryId // Deselect on win? or keep? Keep is better for chain attacks
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

  return (
    <div className="w-screen h-screen overflow-hidden bg-dark-bg text-white font-sans relative">
      
      {/* Background Map - Always visible but maybe blurred on login */}
      <div className={`transition-opacity duration-1000 ${status === GameStatus.PLAYING ? 'opacity-100' : 'opacity-30'}`}>
         {/* We render map always so it loads in background */}
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
          <div className="bg-panel-bg p-8 rounded-2xl border border-neon-blue shadow-[0_0_50px_rgba(0,243,255,0.2)] backdrop-blur-xl max-w-md w-full mx-4">
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
                className="w-full bg-neon-blue hover:bg-cyan-400 text-black font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 transition transform hover:scale-[1.02] active:scale-95"
              >
                INITIALIZE UPLINK
              </button>
            </form>
            
            <div className="mt-6 text-xs text-gray-600 text-center">
              Powered by SQLite Cloud • Vercel • React
            </div>
          </div>
        </div>
      )}

      {/* Loading Screen */}
      {status === GameStatus.LOCATING && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
           <Loader2 size={64} className="text-neon-green animate-spin mb-4" />
           <h2 className="text-2xl font-mono text-neon-green">TRIANGULATING POSITION...</h2>
           <p className="text-gray-400 mt-2">Connecting to Satellite Feed</p>
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
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-50">
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