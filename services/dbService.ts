import { GameState, Player, Territory } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, INCOME_PER_TERRITORY, GRID_SIZE } from '../constants';

const STORAGE_KEY = 'geoconquest_state_v4_grid';

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
      centerLat: 0,
      centerLng: 0
    };
  }

  private saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  // Generate a grid around the player's start location
  public initLocalGrid(centerLat: number, centerLng: number) {
    this.state.centerLat = centerLat;
    this.state.centerLng = centerLng;

    const radius = 3; // 3x3 grid around center to start = 7x7 total area
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        // Snap lat/lng to grid
        const lat = centerLat + (x * GRID_SIZE);
        const lng = centerLng + (y * GRID_SIZE);
        const id = this.getGridId(lat, lng);

        if (!this.state.territories[id]) {
          this.state.territories[id] = {
            id,
            name: `Sector ${x},${y}`,
            ownerId: null,
            strength: Math.floor(Math.random() * 20) + 5,
            lat: this.snapToGrid(lat),
            lng: this.snapToGrid(lng)
          };
        }
      }
    }
    this.saveState();
  }

  private snapToGrid(val: number): number {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }

  public getGridId(lat: number, lng: number): string {
    const snappedLat = this.snapToGrid(lat).toFixed(4);
    const snappedLng = this.snapToGrid(lng).toFixed(4);
    return `${snappedLat}_${snappedLng}`;
  }

  public ensureTerritory(lat: number, lng: number): Territory {
    const id = this.getGridId(lat, lng);
    if (!this.state.territories[id]) {
       this.state.territories[id] = {
         id,
         name: `Unknown Sector`,
         ownerId: null,
         strength: 10,
         lat: this.snapToGrid(lat),
         lng: this.snapToGrid(lng)
       };
       this.saveState();
    }
    return this.state.territories[id];
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
      { id: 'bot_alpha', username: 'OmegaCorp', color: '#ff003c', money: 1000 },
      { id: 'bot_beta', username: 'CyberSys', color: '#00f3ff', money: 1000 },
    ];
    bots.forEach(bot => {
      if (!this.state.players[bot.id]) {
        this.state.players[bot.id] = bot;
      }
    });
    this.saveState();
  }

  public async captureTerritory(playerId: string, territoryId: string) {
    const t = this.state.territories[territoryId];
    if (t) {
      t.ownerId = playerId;
      t.strength = INITIAL_STRENGTH;
      this.saveState();
      
      // Expand visibility? We could generate neighbors here
      this.generateNeighbors(t.lat, t.lng);
    }
  }

  private generateNeighbors(lat: number, lng: number) {
     const offsets = [[0,1], [0,-1], [1,0], [-1,0]];
     offsets.forEach(([ox, oy]) => {
        const nLat = lat + (ox * GRID_SIZE);
        const nLng = lng + (oy * GRID_SIZE);
        const id = this.getGridId(nLat, nLng);
        if (!this.state.territories[id]) {
           this.state.territories[id] = {
             id,
             name: `Sector`,
             ownerId: null,
             strength: Math.floor(Math.random() * 15) + 5,
             lat: this.snapToGrid(nLat),
             lng: this.snapToGrid(nLng)
           };
        }
     });
     this.saveState();
  }

  public isAdjacent(t1: Territory, t2: Territory): boolean {
    // Check if centers are within roughly 1.5 * GRID_SIZE distance
    const dLat = Math.abs(t1.lat - t2.lat);
    const dLng = Math.abs(t1.lng - t2.lng);
    const tolerance = GRID_SIZE * 1.5;
    return (dLat < tolerance && dLng < 0.0001) || (dLng < tolerance && dLat < 0.0001);
  }

  public async attackTerritory(attackerId: string, sourceId: string, targetId: string): Promise<{success: boolean, message: string}> {
    const source = this.state.territories[sourceId];
    const target = this.state.territories[targetId];

    if (!source || !target) return { success: false, message: "Invalid territory" };
    if (source.ownerId !== attackerId) return { success: false, message: "You don't own the source!" };
    if (target.ownerId === attackerId) return { success: false, message: "You already own this!" };
    
    if (!this.isAdjacent(source, target)) {
      return { success: false, message: "Target is not adjacent!" };
    }

    if (source.strength <= 1) return { success: false, message: "Not enough troops!" };

    const attackPower = source.strength - 1; 
    const defensePower = target.strength;

    // Combat logic
    if (attackPower > defensePower) {
      const remaining = attackPower - defensePower;
      this.state.territories[sourceId].strength = 1;
      this.state.territories[targetId].strength = remaining;
      this.state.territories[targetId].ownerId = attackerId;
      this.saveState();
      this.generateNeighbors(target.lat, target.lng); // Discover new lands
      return { success: true, message: `Conquered!` };
    } else {
      this.state.territories[sourceId].strength = 1; 
      this.state.territories[targetId].strength = Math.max(1, defensePower - Math.floor(attackPower * 0.8));
      this.saveState();
      return { success: false, message: `Attack failed!` };
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
      // 1. Growth
      Object.values(this.state.territories).forEach(t => {
        if (t.ownerId && t.strength < 5000) {
          t.strength += 1;
        }
      });
      
      // 2. Economy
      Object.keys(this.state.players).forEach(pid => {
         if (pid.startsWith('bot_')) return;
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
    // Find a bot territory that is strong
    const botTerritories = all.filter(t => t.ownerId && t.ownerId.startsWith('bot_') && t.strength > 20);
    
    if (botTerritories.length > 0) {
      const attacker = botTerritories[Math.floor(Math.random() * botTerritories.length)];
      // Find adjacent target
      const target = all.find(t => t.id !== attacker.id && t.ownerId !== attacker.ownerId && this.isAdjacent(attacker, t));
      
      if (target) {
         if (attacker.strength > target.strength + 5) {
            this.attackTerritory(attacker.ownerId!, attacker.id, target.id);
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