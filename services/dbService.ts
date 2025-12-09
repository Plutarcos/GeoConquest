import { GameState, Player, Territory } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, INCOME_PER_TERRITORY, GRID_SIZE, DB_CONFIG } from '../constants';
import { Database } from '@sqlitecloud/drivers';

const STORAGE_KEY = 'geoconquest_state_v5_cloud';

export class GameService {
  private state: GameState;
  private db: Database | null = null;
  private useLocalFallback: boolean = false;
  
  constructor() {
    this.state = this.loadLocalState();
    this.initCloudDB();
  }

  private loadLocalState(): GameState {
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
      centerLng: 0,
      connected: false
    };
  }

  private saveLocalState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  // --- SQLite Cloud Integration ---

  private async initCloudDB() {
    try {
      this.db = new Database(DB_CONFIG.connectionString);
      
      // Test connection
      await this.db.sql('SELECT 1');
      console.log("Connected to SQLiteCloud");
      this.state.connected = true;

      // Create Tables if not exist
      await this.db.sql(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY, 
          username TEXT, 
          color TEXT, 
          money INTEGER, 
          last_seen INTEGER
        );
      `);
      
      await this.db.sql(`
        CREATE TABLE IF NOT EXISTS territories (
          id TEXT PRIMARY KEY, 
          name TEXT, 
          ownerId TEXT, 
          strength INTEGER, 
          lat REAL, 
          lng REAL
        );
      `);

    } catch (error) {
      console.warn("Failed to connect to SQLiteCloud (using local fallback):", error);
      this.useLocalFallback = true;
      this.state.connected = false;
    }
  }

  public async syncState(currentPlayerId: string | null) {
    if (this.useLocalFallback || !this.db) {
      this.simulateGameLoop();
      return this.state;
    }

    try {
      // 1. Update heartbeat for current player
      if (currentPlayerId) {
        await this.db.sql`UPDATE players SET last_seen = ${Date.now()} WHERE id = ${currentPlayerId}`;
      }

      // 2. Fetch all territories
      const territoriesData = await this.db.sql('SELECT * FROM territories');
      const playersData = await this.db.sql('SELECT * FROM players');

      // 3. Merge into local state
      (territoriesData as any[]).forEach(row => {
        this.state.territories[row.id] = {
          id: row.id,
          name: row.name,
          ownerId: row.ownerId,
          strength: row.strength,
          lat: row.lat,
          lng: row.lng
        };
      });

      (playersData as any[]).forEach(row => {
        this.state.players[row.id] = {
          id: row.id,
          username: row.username,
          color: row.color,
          money: row.money,
          lastSeen: row.last_seen
        };
      });

      this.state.connected = true;
      this.saveLocalState();
    } catch (e) {
      console.error("Sync error:", e);
      this.state.connected = false;
      this.useLocalFallback = true; // Temporary fallback on error
    }
    
    return this.state;
  }

  // --- Game Logic ---

  public initLocalGrid(centerLat: number, centerLng: number) {
    this.state.centerLat = centerLat;
    this.state.centerLng = centerLng;

    const radius = 3; 
    const promises = [];

    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const lat = centerLat + (x * GRID_SIZE);
        const lng = centerLng + (y * GRID_SIZE);
        promises.push(this.ensureTerritory(lat, lng));
      }
    }
  }

  private snapToGrid(val: number): number {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }

  public getGridId(lat: number, lng: number): string {
    const snappedLat = this.snapToGrid(lat).toFixed(4);
    const snappedLng = this.snapToGrid(lng).toFixed(4);
    return `${snappedLat}_${snappedLng}`;
  }

  public async ensureTerritory(lat: number, lng: number): Promise<Territory> {
    const id = this.getGridId(lat, lng);
    
    // Check local cache first
    if (this.state.territories[id]) {
        return this.state.territories[id];
    }

    const t: Territory = {
        id,
        name: `Sector ${id.replace('_', ':')}`,
        ownerId: null,
        strength: Math.floor(Math.random() * 20) + 5,
        lat: this.snapToGrid(lat),
        lng: this.snapToGrid(lng)
    };

    this.state.territories[id] = t;

    // Push to DB if connected
    if (!this.useLocalFallback && this.db) {
        try {
            await this.db.sql`INSERT OR IGNORE INTO territories (id, name, ownerId, strength, lat, lng) VALUES (${t.id}, ${t.name}, ${t.ownerId}, ${t.strength}, ${t.lat}, ${t.lng})`;
        } catch (e) { console.warn("DB Insert fail", e); }
    }

    return t;
  }

  public async login(username: string): Promise<Player> {
    const id = `user_${username.replace(/\s+/g, '_').toLowerCase()}`;
    
    let player: Player = {
        id,
        username,
        color: this.getRandomColor(),
        money: INITIAL_MONEY,
        lastSeen: Date.now()
    };

    if (!this.useLocalFallback && this.db) {
        // Try fetch existing
        const res = await this.db.sql`SELECT * FROM players WHERE id = ${id}`;
        if (Array.isArray(res) && res.length > 0) {
            const row = res[0] as any;
            player = {
                id: row.id,
                username: row.username,
                color: row.color,
                money: row.money,
                lastSeen: row.last_seen
            };
        } else {
            // Register new
            await this.db.sql`INSERT INTO players (id, username, color, money, last_seen) VALUES (${player.id}, ${player.username}, ${player.color}, ${player.money}, ${player.lastSeen})`;
        }
    }

    this.state.players[id] = player;
    this.saveLocalState();
    return player;
  }

  private getRandomColor() {
      const colors = ['#0aff00', '#00f3ff', '#ff003c', '#eab308', '#ec4899', '#8b5cf6'];
      return colors[Math.floor(Math.random() * colors.length)];
  }

  public async captureTerritory(playerId: string, territoryId: string) {
    const t = this.state.territories[territoryId];
    if (t) {
      t.ownerId = playerId;
      t.strength = INITIAL_STRENGTH;
      this.updateTerritory(t);
      this.generateNeighbors(t.lat, t.lng);
    }
  }

  private async updateTerritory(t: Territory) {
      if (!this.useLocalFallback && this.db) {
          try {
             await this.db.sql`UPDATE territories SET ownerId = ${t.ownerId}, strength = ${t.strength} WHERE id = ${t.id}`;
          } catch(e) { console.warn("Update failed", e); }
      }
      this.saveLocalState();
  }

  private updatePlayer(p: Player) {
      if (!this.useLocalFallback && this.db) {
          try {
              // Note: using raw string interpolation for simplicity in this demo, but parameters are safer
              this.db.sql`UPDATE players SET money = ${p.money}, last_seen = ${Date.now()} WHERE id = ${p.id}`;
          } catch(e) {}
      }
      this.saveLocalState();
  }

  private generateNeighbors(lat: number, lng: number) {
     const offsets = [[0,1], [0,-1], [1,0], [-1,0]];
     offsets.forEach(([ox, oy]) => {
        const nLat = lat + (ox * GRID_SIZE);
        const nLng = lng + (oy * GRID_SIZE);
        this.ensureTerritory(nLat, nLng);
     });
  }

  public isAdjacent(t1: Territory, t2: Territory): boolean {
    const dLat = Math.abs(t1.lat - t2.lat);
    const dLng = Math.abs(t1.lng - t2.lng);
    const tolerance = GRID_SIZE * 1.5;
    return (dLat < tolerance && dLng < 0.0001) || (dLng < tolerance && dLat < 0.0001);
  }

  public async attackTerritory(attackerId: string, sourceId: string, targetId: string): Promise<{success: boolean, message: string}> {
    // Refresh state before attacking to prevent conflicts
    await this.syncState(attackerId);

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

    if (attackPower > defensePower) {
      const remaining = attackPower - defensePower;
      source.strength = 1;
      target.strength = remaining;
      target.ownerId = attackerId;
      this.updateTerritory(source);
      this.updateTerritory(target);
      this.generateNeighbors(target.lat, target.lng);
      return { success: true, message: `Conquered!` };
    } else {
      source.strength = 1; 
      target.strength = Math.max(1, defensePower - Math.floor(attackPower * 0.8));
      this.updateTerritory(source);
      this.updateTerritory(target);
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
        this.updateTerritory(t);
        this.updatePlayer(player);
        return { success: true, message: "Troops Recruited!" };
      }
    }

    // Default deduction if generic item
    player.money -= cost;
    this.updatePlayer(player);
    return { success: true, message: "Purchase successful" };
  }

  public getLatestState(): GameState {
    return { ...this.state };
  }

  private lastTick = Date.now();
  private simulateGameLoop() {
    const now = Date.now();
    if (now - this.lastTick > 2000) { 
      // Only run simulation logic locally if we can't trust the server to do it
      // In this client-authoritative setup, each client processes their own growth
      Object.values(this.state.territories).forEach(t => {
        if (t.ownerId && t.strength < 5000) {
          t.strength += 1;
        }
      });
      
      Object.keys(this.state.players).forEach(pid => {
         const owned = Object.values(this.state.territories).filter(t => t.ownerId === pid).length;
         if (owned > 0) {
            this.state.players[pid].money += (owned * INCOME_PER_TERRITORY);
         }
      });

      this.lastTick = now;
      this.saveLocalState();
    }
  }

  public resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('geoconquest_user');
    window.location.reload();
  }
}

export const gameService = new GameService();