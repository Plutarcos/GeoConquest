
import { GameState, Player, Territory } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, INCOME_PER_TERRITORY, GRID_SIZE, SQL_INIT_DB, SQL_INIT_TABLES, SYSTEM_CONN_STRING, GAME_CONN_STRING, DB_DATABASE_NAME } from '../constants';

export class GameService {
  private state: GameState;
  private offlineMode: boolean = false;
  private db: any = null; // SQLiteCloud Database instance

  constructor() {
    this.state = {
      territories: {},
      players: {},
      currentPlayerId: null,
      selectedTerritoryId: null,
      lastUpdate: Date.now(),
      centerLat: 0,
      centerLng: 0,
      connected: false
    };

    // Load offline data if exists
    if (localStorage.getItem('geoconquest_offline_data')) {
      // Data exists, but we wait for init to decide mode
    }

    // Passive income loop
    setInterval(() => this.passiveIncomeLoop(), 5000);
  }

  // --- Helpers ---

  private getLocalData() {
    const json = localStorage.getItem('geoconquest_offline_data');
    if (!json) return { players: [], territories: [] };
    
    const data = JSON.parse(json);
    
    // Auto-fix corrupted duplicates in local storage
    if (data.territories) {
        const uniqueTerritories = new Map();
        data.territories.forEach((t: any) => {
            if (!uniqueTerritories.has(t.id)) {
                uniqueTerritories.set(t.id, t);
            }
        });
        if (uniqueTerritories.size !== data.territories.length) {
             console.log("Fixed corrupted local data (duplicates removed)");
             data.territories = Array.from(uniqueTerritories.values());
             localStorage.setItem('geoconquest_offline_data', JSON.stringify(data));
        }
    }
    return data;
  }

  private saveLocalData(data: any) {
    localStorage.setItem('geoconquest_offline_data', JSON.stringify(data));
  }

  // Robust SQL Parser for Offline Mode
  private async execLocalSql(sql: string): Promise<any[]> {
    const data = this.getLocalData();
    let result: any[] = [];
    const now = Date.now();

    const sqlUpper = sql.trim().toUpperCase();

    // 1. SELECT
    if (sqlUpper.startsWith("SELECT")) {
        // SELECT * FROM players
        if (sqlUpper.includes("FROM PLAYERS")) {
            if (sqlUpper.includes("WHERE ID =")) {
                const idMatch = sql.match(/id = '([^']+)'/i);
                if (idMatch) {
                    result = data.players.filter((p: any) => p.id === idMatch[1]);
                }
            } else {
                result = data.players;
            }
        }
        // SELECT ... FROM territories
        else if (sqlUpper.includes("FROM TERRITORIES")) {
            if (sqlUpper.includes("SELECT 1")) {
                 const idMatch = sql.match(/id = '([^']+)'/i);
                 if (idMatch) {
                     const exists = data.territories.some((t: any) => t.id === idMatch[1]);
                     result = exists ? [{1:1}] : [];
                 }
            } else if (sqlUpper.includes("WHERE ID =")) {
                const idMatch = sql.match(/id = '([^']+)'/i);
                if (idMatch) {
                    result = data.territories.filter((t: any) => t.id === idMatch[1]);
                }
            } else {
                result = data.territories;
            }
        }
    }
    // 2. INSERT
    else if (sqlUpper.startsWith("INSERT")) {
        if (sqlUpper.includes("INTO PLAYERS")) {
             // VALUES ('id', 'username', 'color', money, last_seen)
             const valuesStr = sql.substring(sql.indexOf("VALUES") + 6).trim().replace(/^\(|\)$/g, '');
             // Simple CSV split handling quotes
             const parts = valuesStr.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
             
             data.players.push({
                 id: parts[0],
                 username: parts[1],
                 color: parts[2],
                 money: parseFloat(parts[3]),
                 last_seen: parseInt(parts[4])
             });
             this.saveLocalData(data);
        }
        else if (sqlUpper.includes("INTO TERRITORIES")) {
            // VALUES ('id', NULL, strength, lat, lng, 'name')
            const valuesStr = sql.substring(sql.indexOf("VALUES") + 6).trim().replace(/^\(|\)$/g, '');
            const parts = valuesStr.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
            
            // Check for duplicate before inserting
            if (!data.territories.some((t: any) => t.id === parts[0])) {
                data.territories.push({
                    id: parts[0],
                    owner_id: parts[1] === 'NULL' ? null : parts[1],
                    strength: parseInt(parts[2]),
                    lat: parseFloat(parts[3]),
                    lng: parseFloat(parts[4]),
                    name: parts[5]
                });
                this.saveLocalData(data);
            }
        }
    }
    // 3. UPDATE
    else if (sqlUpper.startsWith("UPDATE")) {
        // UPDATE territories SET ... WHERE ...
        if (sqlUpper.includes("TERRITORIES")) {
             const whereIndex = sqlUpper.indexOf("WHERE");
             if (whereIndex !== -1) {
                 const setPart = sql.substring(sqlUpper.indexOf("SET") + 3, whereIndex).trim();
                 const wherePart = sql.substring(whereIndex + 5).trim();
                 
                 const idMatch = wherePart.match(/id = '([^']+)'/i);
                 if (idMatch) {
                     const tIndex = data.territories.findIndex((t: any) => t.id === idMatch[1]);
                     if (tIndex !== -1) {
                         // Split SET assignments by comma
                         const assignments = setPart.split(',');
                         assignments.forEach(assign => {
                             const [col, valExpr] = assign.split('=').map(s => s.trim());
                             
                             if (col.toLowerCase() === 'owner_id') {
                                 data.territories[tIndex].owner_id = valExpr.replace(/'/g, '');
                             }
                             else if (col.toLowerCase() === 'strength') {
                                 const currentStrength = data.territories[tIndex].strength;
                                 if (valExpr.includes('strength +')) {
                                     const add = parseInt(valExpr.split('+')[1]);
                                     data.territories[tIndex].strength = currentStrength + add;
                                 } else if (valExpr.includes('strength -')) {
                                     const sub = parseInt(valExpr.split('-')[1]);
                                     // Handle MAX logic approximately
                                     let newVal = currentStrength - sub;
                                     if (valExpr.toUpperCase().includes("MAX")) {
                                        newVal = Math.max(1, newVal);
                                     }
                                     data.territories[tIndex].strength = newVal;
                                 } else if (valExpr.toUpperCase().includes("MAX")) {
                                     // Simple parser for MAX(1, strength - X) logic used in airstrike
                                     if(valExpr.includes('-')) {
                                        const sub = parseInt(valExpr.split('-')[1]);
                                        data.territories[tIndex].strength = Math.max(1, currentStrength - sub);
                                     }
                                 } else {
                                     data.territories[tIndex].strength = parseInt(valExpr);
                                 }
                             }
                         });
                         this.saveLocalData(data);
                     }
                 }
             }
        }
        // UPDATE players
        else if (sqlUpper.includes("PLAYERS")) {
             const idMatch = sql.match(/id = '([^']+)'/i);
             if (idMatch) {
                 const pIndex = data.players.findIndex((p: any) => p.id === idMatch[1]);
                 if (pIndex !== -1) {
                     // Check for specific updates
                     if (sql.includes("last_seen")) {
                         data.players[pIndex].last_seen = now;
                     }
                     if (sql.includes("money = money +")) {
                         const amount = parseFloat(sql.match(/money \+ ([0-9.]+)/)![1]);
                         data.players[pIndex].money += amount;
                     }
                     if (sql.includes("money = money -")) {
                         const amount = parseFloat(sql.match(/money \- ([0-9.]+)/)![1]);
                         data.players[pIndex].money -= amount;
                     }
                     this.saveLocalData(data);
                 }
             }
        }
    }

    return result;
  }

  // --- Cloud Logic with SDK ---

  private async waitForSdk(timeoutMs = 15000): Promise<boolean> {
    const start = Date.now();
    
    // Safety check: if the script is missing, inject it
    if (!document.querySelector('script[src*="sqlitecloud"]')) {
         console.warn("SQLiteCloud SDK script missing. Injecting fallback...");
         const script = document.createElement('script');
         script.src = "https://cdn.jsdelivr.net/npm/@sqlitecloud/drivers@1.0.126/dist/sqlitecloud.bundle.min.js";
         script.async = true;
         document.head.appendChild(script);
    }

    while (Date.now() - start < timeoutMs) {
      if (window.sqlitecloud && window.sqlitecloud.Database) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  private async createDatabaseIfNeeded() {
     console.log("Checking DB existence...");
     try {
        // Connect to System DB
        const sysDb = new window.sqlitecloud.Database(SYSTEM_CONN_STRING);
        await sysDb.sql(SQL_INIT_DB);
        console.log(`Database ${DB_DATABASE_NAME} checked/created.`);
        sysDb.close();
     } catch (e) {
        console.warn("DB Creation check failed (might already exist or network error):", e);
        // Continue to try connecting to the game DB anyway
     }
  }

  private async execSql(sql: string): Promise<any[]> {
    if (this.offlineMode) {
      return this.execLocalSql(sql);
    }

    try {
      if (!this.db) throw new Error("Database not initialized");
      
      const result = await this.db.sql(sql);
      
      // SDK returns data usually as array of objects or array of arrays
      // The official SDK often returns just the array of row objects
      if (Array.isArray(result)) {
        return result;
      }
      return [];

    } catch (error) {
      console.warn("SQL Exec Error (SDK):", error);
      console.log("Switching to Offline Mode due to connection error.");
      this.offlineMode = true; 
      this.state.connected = false;
      return this.execLocalSql(sql);
    }
  }

  public async initDatabase() {
    console.log("Initializing Game DB Connection...");
    
    // Wait for SDK to load (async script)
    const sdkLoaded = await this.waitForSdk();
    if (!sdkLoaded) {
        console.error("SQLiteCloud SDK failed to load (timeout). Starting in Offline Mode.");
        this.offlineMode = true;
        this.state.connected = false;
        return;
    }

    // Step 1: Create DB if needed
    await this.createDatabaseIfNeeded();

    // Step 2: Connect to Game DB
    try {
        this.db = new window.sqlitecloud.Database(GAME_CONN_STRING);
        // Test connection
        await this.db.sql('SELECT 1');
        
        // Step 3: Initialize Tables
        for (const sql of SQL_INIT_TABLES) {
            await this.db.sql(sql); 
        }

        this.state.connected = true;
        this.offlineMode = false;
        console.log("Cloud DB Connected & Initialized.");

    } catch (e) {
        console.error("Failed to connect to Game DB:", e);
        this.offlineMode = true;
        this.state.connected = false;
        console.log("Starting in Local Mode.");
    }
  }

  // --- Game Logic ---

  public async login(username: string): Promise<Player> {
    const id = `user_${username.replace(/\s+/g, '_').toLowerCase()}`;
    const color = this.getRandomColor();
    const now = Date.now();

    const existing = await this.execSql(`SELECT * FROM players WHERE id = '${id}'`);
    
    if (existing && existing.length > 0) {
      await this.execSql(`UPDATE players SET last_seen = ${now} WHERE id = '${id}'`);
      const p = existing[0];
      return {
        id: p.id,
        username: p.username,
        color: p.color,
        money: typeof p.money === 'string' ? parseFloat(p.money) : p.money,
        lastSeen: p.last_seen
      };
    } else {
      await this.execSql(`INSERT INTO players (id, username, color, money, last_seen) VALUES ('${id}', '${username}', '${color}', ${INITIAL_MONEY}, ${now})`);
      return {
        id,
        username,
        color,
        money: INITIAL_MONEY,
        lastSeen: now
      };
    }
  }

  public async syncState(currentPlayerId: string | null): Promise<GameState> {
    // If offline, ensure we have local data structure initiated
    if (this.offlineMode && !localStorage.getItem('geoconquest_offline_data')) {
        this.saveLocalData({ players: [], territories: [] });
    }

    const playersData = await this.execSql(`SELECT * FROM players`);
    const playersMap: Record<string, Player> = {};
    if (Array.isArray(playersData)) {
      playersData.forEach((p: any) => {
        playersMap[p.id] = {
          id: p.id,
          username: p.username,
          color: p.color,
          money: typeof p.money === 'string' ? parseFloat(p.money) : p.money,
          lastSeen: p.last_seen
        };
      });
    }

    const terrData = await this.execSql(`SELECT * FROM territories`);
    const terrMap: Record<string, Territory> = {};
    if (Array.isArray(terrData)) {
      terrData.forEach((t: any) => {
        terrMap[t.id] = {
          id: t.id,
          ownerId: t.owner_id,
          strength: typeof t.strength === 'string' ? parseInt(t.strength) : t.strength,
          lat: typeof t.lat === 'string' ? parseFloat(t.lat) : t.lat,
          lng: typeof t.lng === 'string' ? parseFloat(t.lng) : t.lng,
          name: t.name
        };
      });
    }

    this.state.players = playersMap;
    this.state.territories = terrMap;
    this.state.connected = !this.offlineMode;

    return { ...this.state };
  }

  public async initLocalGrid(centerLat: number, centerLng: number) {
    this.state.centerLat = centerLat;
    this.state.centerLng = centerLng;

    const radius = 3; 
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const lat = centerLat + (x * GRID_SIZE);
        const lng = centerLng + (y * GRID_SIZE);
        await this.ensureTerritory(lat, lng);
        // Small delay to prevent blocking UI on large grid generation
        if (this.offlineMode) await new Promise(r => setTimeout(r, 10));
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
    const snappedLat = this.snapToGrid(lat);
    const snappedLng = this.snapToGrid(lng);
    const name = `Sector ${id.replace('_', ':')}`;

    if (this.state.territories[id]) {
      return this.state.territories[id];
    }

    const strength = Math.floor(Math.random() * 20) + 5;
    
    // Check if exists
    const check = await this.execSql(`SELECT 1 FROM territories WHERE id = '${id}'`);
    if (check.length === 0) {
         await this.execSql(`INSERT INTO territories (id, owner_id, strength, lat, lng, name) VALUES ('${id}', NULL, ${strength}, ${snappedLat}, ${snappedLng}, '${name}')`);
    }

    const t: Territory = {
      id,
      name,
      ownerId: null,
      strength,
      lat: snappedLat,
      lng: snappedLng
    };
    return t;
  }

  public async captureTerritory(playerId: string, territoryId: string) {
    const t = this.state.territories[territoryId];
    if (t) {
      await this.execSql(`UPDATE territories SET owner_id = '${playerId}', strength = ${INITIAL_STRENGTH} WHERE id = '${territoryId}'`);
      await this.generateNeighbors(t.lat, t.lng);
    }
  }

  private async generateNeighbors(lat: number, lng: number) {
     const offsets = [[0,1], [0,-1], [1,0], [-1,0]];
     for (const [ox, oy] of offsets) {
        const nLat = lat + (ox * GRID_SIZE);
        const nLng = lng + (oy * GRID_SIZE);
        await this.ensureTerritory(nLat, nLng);
     }
  }

  public isAdjacent(t1: Territory, t2: Territory): boolean {
    const dLat = Math.abs(t1.lat - t2.lat);
    const dLng = Math.abs(t1.lng - t2.lng);
    const tolerance = GRID_SIZE * 1.5;
    return (dLat < tolerance && dLng < 0.0001) || (dLng < tolerance && dLat < 0.0001);
  }

  public async attackTerritory(attackerId: string, sourceId: string, targetId: string): Promise<{success: boolean, message: string}> {
    const source = this.state.territories[sourceId];
    const target = this.state.territories[targetId];

    if (!source || !target) return { success: false, message: "Território inválido" };
    if (source.ownerId !== attackerId) return { success: false, message: "Você não possui a base!" };
    if (target.ownerId === attackerId) return { success: false, message: "Já é seu!" };
    
    if (!this.isAdjacent(source, target)) {
      return { success: false, message: "Alvo muito distante!" };
    }

    if (source.strength <= 1) return { success: false, message: "Tropas insuficientes!" };

    const attackPower = source.strength - 1; 
    const defensePower = target.strength;

    if (attackPower > defensePower) {
      const remaining = attackPower - defensePower;
      await this.execSql(`UPDATE territories SET strength = 1 WHERE id = '${sourceId}'`);
      await this.execSql(`UPDATE territories SET strength = ${remaining}, owner_id = '${attackerId}' WHERE id = '${targetId}'`);
      
      await this.generateNeighbors(target.lat, target.lng);
      return { success: true, message: `Conquistado!` };
    } else {
      const newDefense = Math.max(1, defensePower - Math.floor(attackPower * 0.8));
      await this.execSql(`UPDATE territories SET strength = 1 WHERE id = '${sourceId}'`);
      await this.execSql(`UPDATE territories SET strength = ${newDefense} WHERE id = '${targetId}'`);
      return { success: false, message: `Ataque falhou!` };
    }
  }

  public async purchaseUpgrade(playerId: string, itemId: string, targetTerritoryId?: string): Promise<{success: boolean, message: string}> {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: "Jogador não encontrado" };

    let cost = 0;
    if (itemId === 'recruit') cost = 50;
    if (itemId === 'fortify') cost = 100;
    if (itemId === 'sabotage') cost = 200;
    if (itemId === 'shield') cost = 300;
    if (itemId === 'airstrike') cost = 500;

    if (player.money < cost) {
      return { success: false, message: "Fundos Insuficientes" };
    }

    // -- Skill Logic --

    if (itemId === 'recruit' && targetTerritoryId) {
      const t = this.state.territories[targetTerritoryId];
      if (t && t.ownerId === playerId) {
        await this.execSql(`UPDATE territories SET strength = strength + 10 WHERE id = '${targetTerritoryId}'`);
      } else {
          return { success: false, message: "Precisa ser seu território" };
      }
    }

    else if (itemId === 'fortify' && targetTerritoryId) {
       const t = this.state.territories[targetTerritoryId];
       if (t && t.ownerId === playerId) {
         await this.execSql(`UPDATE territories SET strength = strength + 20 WHERE id = '${targetTerritoryId}'`);
       } else {
          return { success: false, message: "Precisa ser seu território" };
       }
    }

    else if (itemId === 'sabotage' && targetTerritoryId) {
       const t = this.state.territories[targetTerritoryId];
       if (t && t.ownerId !== playerId) {
         await this.execSql(`UPDATE territories SET strength = MAX(1, strength - 15) WHERE id = '${targetTerritoryId}'`);
       } else {
         return { success: false, message: "Alvo deve ser inimigo" };
       }
    }

    else if (itemId === 'airstrike') {
        if (!targetTerritoryId) return { success: false, message: "Selecione um alvo" };
        const t = this.state.territories[targetTerritoryId];
        // Can bomb anyone, even neutral
        if (t) {
            await this.execSql(`UPDATE territories SET strength = MAX(1, strength - 50) WHERE id = '${targetTerritoryId}'`);
        } else {
            return { success: false, message: "Alvo inválido" };
        }
    }

    else if (itemId === 'shield') {
        if (!targetTerritoryId) return { success: false, message: "Selecione uma base" };
        const t = this.state.territories[targetTerritoryId];
        if (t && t.ownerId === playerId) {
            await this.execSql(`UPDATE territories SET strength = strength + 50 WHERE id = '${targetTerritoryId}'`);
        } else {
            return { success: false, message: "Precisa ser seu território" };
        }
    }

    // Pay costs
    await this.execSql(`UPDATE players SET money = money - ${cost} WHERE id = '${playerId}'`);
    
    let msg = "Compra realizada";
    if (itemId === 'airstrike') msg = "Ataque Aéreo Confirmado!";
    if (itemId === 'shield') msg = "Escudos Ativados!";
    if (itemId === 'recruit') msg = "Tropas Recrutadas!";

    return { success: true, message: msg };
  }

  public getLatestState(): GameState {
    return { ...this.state };
  }

  private getRandomColor() {
      const colors = ['#0aff00', '#00f3ff', '#ff003c', '#eab308', '#ec4899', '#8b5cf6', '#ffffff', '#f97316'];
      return colors[Math.floor(Math.random() * colors.length)];
  }

  public resetGame() {
    localStorage.removeItem('geoconquest_user');
    window.location.reload();
  }

  private async passiveIncomeLoop() {
    const currentUserJson = localStorage.getItem('geoconquest_user');
    if (!currentUserJson) return;
    
    const user = JSON.parse(currentUserJson);
    const userId = user.id;

    // Must verify if we have data to avoid errors
    if (!this.state.territories) return;

    const ownedCount = Object.values(this.state.territories).filter(t => t.ownerId === userId).length;
    
    if (ownedCount > 0) {
      const income = ownedCount * INCOME_PER_TERRITORY;
      await this.execSql(`UPDATE players SET money = money + ${income} WHERE id = '${userId}'`);
    }
  }
}

export const gameService = new GameService();
