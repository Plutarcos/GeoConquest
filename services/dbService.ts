import { GameState, Player, Territory } from '../types';
import { INITIAL_STRENGTH } from '../constants';

// NOTE: In a real environment with the correct drivers installed, we would import the driver here.
// import { Database } from '@sqlitecloud/drivers';

/**
 * Since we cannot reliably install/bundle the @sqlitecloud/drivers package in this 
 * strict runtime without a package.json install step, we will SIMULATE the 
 * multiplayer database experience using LocalStorage and "Fake" network delays.
 * 
 * However, the structure is designed so you can swap the methods below with actual
 * SQL queries.
 * 
 * Target Schema for SQLite:
 * - Table: users (id TEXT PRIMARY KEY, username TEXT, color TEXT)
 * - Table: territories (id TEXT PRIMARY KEY, owner_id TEXT, strength INTEGER)
 */

const STORAGE_KEY = 'geoconquest_state_v1';

export class GameService {
  private state: GameState;
  
  constructor() {
    this.state = this.loadState();
  }

  private loadState(): GameState {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      territories: {},
      players: {},
      currentPlayerId: null,
      selectedTerritoryId: null,
      lastUpdate: Date.now(),
    };
  }

  private saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  // Initialize the game map data
  public initMapData(geoJSONFeatures: any[]) {
    let changed = false;
    geoJSONFeatures.forEach(feature => {
      const id = feature.id; // ISO 3 code usually
      if (!this.state.territories[id]) {
        this.state.territories[id] = {
          id,
          name: feature.properties.name || "Unknown",
          ownerId: null,
          strength: Math.floor(Math.random() * 20) + 5, // Random neutral strength
        };
        changed = true;
      }
    });
    if (changed) this.saveState();
  }

  // Helper to ensure a territory exists (used during setup if map click hasn't init'd it yet)
  public ensureTerritory(id: string, name: string = "Unknown Region") {
    if (!this.state.territories[id]) {
      this.state.territories[id] = {
        id,
        name,
        ownerId: null,
        strength: 10
      };
      this.saveState();
    }
  }

  public async login(username: string): Promise<Player> {
    // Simulate DB latency
    await new Promise(r => setTimeout(r, 500));

    let player = Object.values(this.state.players).find(p => p.username === username);
    
    if (!player) {
      player = {
        id: `user_${Date.now()}`,
        username,
        color: '#0aff00' // Default player color
      };
      this.state.players[player.id] = player;
      this.saveState();
    }
    
    // Also create some "AI" bots if empty to simulate multiplayer
    if (Object.keys(this.state.players).length < 2) {
      this.spawnBots();
    }

    return player;
  }

  private spawnBots() {
    const bots = [
      { id: 'bot_china', username: 'DragonDynasty', color: '#ff003c' },
      { id: 'bot_eu', username: 'EuroUnion', color: '#00f3ff' },
      { id: 'bot_usa', username: 'EagleForce', color: '#eab308' },
    ];

    bots.forEach(bot => {
      if (!this.state.players[bot.id]) {
        this.state.players[bot.id] = bot;
      }
    });
    
    // Assign some random territories to bots
    const ids = Object.keys(this.state.territories);
    if (ids.length > 0) {
      // China
      const cn = ids.find(id => id === "CHN" || id === "156");
      if (cn) this.state.territories[cn].ownerId = 'bot_china';
      
      // USA
      const us = ids.find(id => id === "USA" || id === "840");
      if (us) this.state.territories[us].ownerId = 'bot_usa';

      // Brazil or France
      const br = ids.find(id => id === "BRA" || id === "076");
      if (br) this.state.territories[br].ownerId = 'bot_eu';
    }
    this.saveState();
  }

  public async captureTerritory(playerId: string, territoryId: string) {
    // Ensure exists just in case
    if (!this.state.territories[territoryId]) {
      this.ensureTerritory(territoryId);
    }

    const t = this.state.territories[territoryId];
    if (t) {
      t.ownerId = playerId;
      t.strength = INITIAL_STRENGTH;
      this.saveState();
    }
  }

  public async attackTerritory(attackerId: string, sourceId: string, targetId: string): Promise<{success: boolean, message: string}> {
    const source = this.state.territories[sourceId];
    const target = this.state.territories[targetId];

    if (!source || !target) return { success: false, message: "Invalid territory" };
    if (source.ownerId !== attackerId) return { success: false, message: "You don't own the source!" };

    // Simple Combat Logic
    // Must have > 1 strength to attack
    if (source.strength <= 1) return { success: false, message: "Not enough troops to attack!" };

    const attackPower = source.strength - 1; // Leave 1 behind
    
    // Defense bonus if occupied
    const defensePower = target.strength;

    if (attackPower > defensePower) {
      // Victory
      const remaining = attackPower - defensePower;
      
      this.state.territories[sourceId].strength = 1;
      this.state.territories[targetId].strength = remaining;
      this.state.territories[targetId].ownerId = attackerId;
      
      this.saveState();
      return { success: true, message: `Conquered ${target.name}!` };
    } else {
      // Defeat
      this.state.territories[sourceId].strength = 1; // Lost army
      this.state.territories[targetId].strength = defensePower - attackPower; // Defender losses
      
      this.saveState();
      return { success: false, message: `Attack failed! ${target.name} held strong.` };
    }
  }

  public async reinforce(territoryId: string, amount: number) {
     const t = this.state.territories[territoryId];
     if (t) {
       t.strength += amount;
       this.saveState();
     }
  }

  // Polling function to get latest state
  public getLatestState(): GameState {
    // In a real app, this would be a DB SELECT
    // Here we also simulate "Tick" updates (growth)
    this.simulateGameLoop();
    return { ...this.state };
  }

  private lastTick = Date.now();
  private simulateGameLoop() {
    const now = Date.now();
    if (now - this.lastTick > 2000) { // Every 2 seconds
      // Grow populations
      Object.values(this.state.territories).forEach(t => {
        if (t.ownerId && t.strength < 1000) {
          t.strength += 1;
        }
        // AI Logic: Randomly expand
        if (t.ownerId && t.ownerId.startsWith('bot_') && t.strength > 20) {
             // Basic AI: find a neighbor (mocking neighbor logic by random index nearby is hard without adjacency graph)
             // We will just let them accumulate strength for now to be "Bosses"
        }
      });
      this.lastTick = now;
      this.saveState();
    }
  }

  public resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
}

export const gameService = new GameService();