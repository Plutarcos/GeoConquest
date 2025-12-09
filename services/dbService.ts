import { GameState, Player, Territory } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, INCOME_PER_TERRITORY } from '../constants';

const STORAGE_KEY = 'geoconquest_state_v3';

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
      // TopoJSON from unpkg often uses ISO 3 numeric codes or string codes as 'id'
      const id = feature.id; 
      // Ensure we treat numeric IDs as strings
      const idStr = String(id);
      
      if (!this.state.territories[idStr]) {
        this.state.territories[idStr] = {
          id: idStr,
          name: feature.properties.name || "Unknown Region",
          ownerId: null,
          strength: Math.floor(Math.random() * 20) + 5, // Random neutral strength
        };
        changed = true;
      }
    });
    if (changed) this.saveState();
  }

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
    await new Promise(r => setTimeout(r, 300));

    let player = Object.values(this.state.players).find(p => p.username === username);
    
    if (!player) {
      player = {
        id: `user_${Date.now()}`,
        username,
        color: '#0aff00',
        money: INITIAL_MONEY
      };
      this.state.players[player.id] = player;
      this.saveState();
    }
    
    if (Object.keys(this.state.players).length < 2) {
      this.spawnBots();
    }

    return player;
  }

  private spawnBots() {
    const bots = [
      { id: 'bot_china', username: 'DragonDynasty', color: '#ff003c', money: 1000 },
      { id: 'bot_eu', username: 'EuroUnion', color: '#00f3ff', money: 1000 },
      { id: 'bot_usa', username: 'EagleForce', color: '#eab308', money: 1000 },
    ];

    bots.forEach(bot => {
      if (!this.state.players[bot.id]) {
        this.state.players[bot.id] = bot;
      }
    });
    this.saveState();
  }

  public async captureTerritory(playerId: string, territoryId: string) {
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
    if (target.ownerId === attackerId) return { success: false, message: "You already own this!" };
    if (source.strength <= 1) return { success: false, message: "Not enough troops!" };

    const attackPower = source.strength - 1; 
    const defensePower = target.strength;

    if (attackPower > defensePower) {
      const remaining = attackPower - defensePower;
      this.state.territories[sourceId].strength = 1;
      this.state.territories[targetId].strength = remaining;
      this.state.territories[targetId].ownerId = attackerId;
      this.saveState();
      return { success: true, message: `Conquered ${target.name}!` };
    } else {
      this.state.territories[sourceId].strength = 1; 
      this.state.territories[targetId].strength = Math.max(1, defensePower - Math.floor(attackPower * 0.8));
      this.saveState();
      return { success: false, message: `Attack failed! ${target.name} held strong.` };
    }
  }

  public async purchaseUpgrade(playerId: string, itemId: string, targetTerritoryId?: string): Promise<{success: boolean, message: string}> {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: "Player not found" };

    let cost = 0;
    if (itemId === 'recruit') cost = 50;
    if (itemId === 'fortify') cost = 100;
    if (itemId === 'sabotage') cost = 200;

    if (player.money < cost) {
      return { success: false, message: "Insufficient Funds" };
    }

    if (itemId === 'recruit' && targetTerritoryId) {
      const t = this.state.territories[targetTerritoryId];
      if (t && t.ownerId === playerId) {
        t.strength += 10;
        player.money -= cost;
        this.saveState();
        return { success: true, message: "Troops Recruited!" };
      }
    }

    return { success: false, message: "Purchase failed" };
  }

  public getLatestState(): GameState {
    this.simulateGameLoop();
    return { ...this.state };
  }

  private lastTick = Date.now();
  private simulateGameLoop() {
    const now = Date.now();
    if (now - this.lastTick > 2000) { 
      // 1. Growth: Strength increases slowly
      Object.values(this.state.territories).forEach(t => {
        if (t.ownerId && t.strength < 5000) {
          t.strength += 1;
        }
      });
      
      // 2. Economy: Money increases based on territories
      Object.keys(this.state.players).forEach(pid => {
         if (pid.startsWith('bot_')) return; // Bots have infinite money in this sim
         const owned = Object.values(this.state.territories).filter(t => t.ownerId === pid).length;
         if (owned > 0) {
            this.state.players[pid].money += (owned * INCOME_PER_TERRITORY);
         }
      });

      // 3. Bot AI
      if (Math.random() > 0.6) {
         this.runBotAI();
      }

      this.lastTick = now;
      this.saveState();
    }
  }

  private runBotAI() {
    const all = Object.values(this.state.territories);
    const botTerritories = all.filter(t => t.ownerId && t.ownerId.startsWith('bot_') && t.strength > 20);
    
    if (botTerritories.length > 0) {
      const attacker = botTerritories[Math.floor(Math.random() * botTerritories.length)];
      const potentialTarget = all[Math.floor(Math.random() * all.length)];
      
      if (potentialTarget.id !== attacker.id && potentialTarget.ownerId !== attacker.ownerId) {
         if (attacker.strength > potentialTarget.strength + 5) {
            this.attackTerritory(attacker.ownerId!, attacker.id, potentialTarget.id);
         }
      }
    }
  }

  public resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('geoconquest_user');
    window.location.reload();
  }
}

export const gameService = new GameService();