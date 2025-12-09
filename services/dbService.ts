

import { GameState, Player, Territory, SqliteCloudResponse } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, INCOME_PER_TERRITORY, GRID_SIZE, DB_CONFIG, SQL_INIT_DB, SQL_INIT_TABLES } from '../constants';

export class GameService {
  private state: GameState;
  private endpoint: string;
  private offlineMode: boolean = false;
  private authHeader: string;
  private apiKeyHeader: string;

  constructor() {
    // Correct Endpoint: Standard HTTPS, no custom port needed
    this.endpoint = `https://${DB_CONFIG.host}/v2/webeditor/sql`;
    
    // Create Basic Auth Header using Admin credentials for DB Creation
    const credentials = btoa(`${DB_CONFIG.username}:${DB_CONFIG.password}`);
    this.authHeader = `Basic ${credentials}`;
    
    // Create Bearer Auth for standard queries using API Key
    this.apiKeyHeader = `Bearer ${DB_CONFIG.apiKey}`;

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
      // We don't load it into state immediately, we let syncState handle it
    }

    // Iniciar loop de renda passiva
    setInterval(() => this.passiveIncomeLoop(), 5000);
  }

  // --- Helpers de Banco de Dados ---

  private getLocalData() {
    const json = localStorage.getItem('geoconquest_offline_data');
    if (!json) return { players: [], territories: [] };
    return JSON.parse(json);
  }

  private saveLocalData(data: any) {
    localStorage.setItem('geoconquest_offline_data', JSON.stringify(data));
  }

  private async execLocalSql(sql: string): Promise<any[]> {
    const data = this.getLocalData();
    let result: any[] = [];
    const now = Date.now();

    // SELECT players
    if (sql.match(/^SELECT \* FROM players/i)) {
      if (sql.includes("WHERE id =")) {
        const idMatch = sql.match(/id = '([^']+)'/);
        if (idMatch) {
          result = data.players.filter((p: any) => p.id === idMatch[1]);
        }
      } else {
        result = data.players;
      }
    }
    // SELECT territories
    else if (sql.match(/^SELECT \* FROM territories/i)) {
      if (sql.includes("WHERE id =")) {
        const idMatch = sql.match(/id = '([^']+)'/);
        if (idMatch) {
          result = data.territories.filter((t: any) => t.id === idMatch[1]);
        }
      } else if (sql.includes("SELECT 1 FROM")) {
         const idMatch = sql.match(/id = '([^']+)'/);
         if (idMatch) {
           const exists = data.territories.some((t: any) => t.id === idMatch[1]);
           result = exists ? [{1:1}] : [];
         }
      } else {
        result = data.territories;
      }
    }
    // INSERT player
    else if (sql.match(/^INSERT INTO players/i)) {
      const valuesMatch = sql.match(/VALUES \('([^']+)', '([^']+)', '([^']+)', ([0-9.]+), ([0-9]+)\)/);
      if (valuesMatch) {
        data.players.push({
          id: valuesMatch[1],
          username: valuesMatch[2],
          color: valuesMatch[3],
          money: parseFloat(valuesMatch[4]),
          last_seen: parseInt(valuesMatch[5])
        });
        this.saveLocalData(data);
      }
    }
    // INSERT territory
    else if (sql.match(/^INSERT INTO territories/i)) {
      const valuesMatch = sql.match(/VALUES \('([^']+)', NULL, ([0-9]+), ([0-9.-]+), ([0-9.-]+), '([^']+)'\)/);
      if (valuesMatch) {
        data.territories.push({
          id: valuesMatch[1],
          owner_id: null,
          strength: parseInt(valuesMatch[2]),
          lat: parseFloat(valuesMatch[3]),
          lng: parseFloat(valuesMatch[4]),
          name: valuesMatch[5]
        });
        this.saveLocalData(data);
      }
    }
    // UPDATE player
    else if (sql.match(/^UPDATE players/i)) {
       const idMatch = sql.match(/id = '([^']+)'/);
       if (idMatch) {
         const pIndex = data.players.findIndex((p: any) => p.id === idMatch[1]);
         if (pIndex >= 0) {
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
    // UPDATE territory
    else if (sql.match(/^UPDATE territories/i)) {
       const idMatch = sql.match(/id = '([^']+)'/);
       if (idMatch) {
         const tIndex = data.territories.findIndex((t: any) => t.id === idMatch[1]);
         if (tIndex >= 0) {
           if (sql.includes("owner_id =")) {
             const ownerMatch = sql.match(/owner_id = '([^']+)'/);
             if (ownerMatch) data.territories[tIndex].owner_id = ownerMatch[1];
           }
           if (sql.includes("strength =")) {
             if (sql.includes("strength +")) {
               const val = parseInt(sql.match(/strength \+ ([0-9]+)/)![1]);
               data.territories[tIndex].strength += val;
             } else {
               const val = parseInt(sql.match(/strength = ([0-9]+)/)![1]);
               data.territories[tIndex].strength = val;
             }
           }
           this.saveLocalData(data);
         }
       }
    }

    return result;
  }

  private async createDatabase() {
     try {
        console.log("Attempting to create database...");
        // For Database creation, we use the Admin credentials (Basic Auth)
        // and connect to the default 'sqlite.db' or 'auth.sqlitecloud'
        const response = await fetch(this.endpoint, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': this.authHeader 
            },
            body: JSON.stringify({
              sql: SQL_INIT_DB,
              database: 'sqlite.db' 
            })
        });
        if (response.ok) {
            console.log("Database created or already exists.");
        } else {
            console.warn("DB Create failed status:", response.status);
            if(response.status === 401) console.warn("Authentication failed for DB Create.");
        }
     } catch (e) {
         console.warn("DB Create Network Error", e);
     }
  }

  private async execSql(sql: string, forceBasicAuth: boolean = false): Promise<any[]> {
    if (this.offlineMode) {
      return this.execLocalSql(sql);
    }

    try {
      // Use API Key (Bearer) for general queries unless forced otherwise
      const auth = forceBasicAuth ? this.authHeader : this.apiKeyHeader;
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth
        },
        body: JSON.stringify({
          sql: sql,
          database: DB_CONFIG.database
        })
      });

      if (!response.ok) {
        throw new Error(`DB Error (${response.status})`);
      }

      const data: SqliteCloudResponse = await response.json();
      
      if (data.data) {
        if (data.columns && data.data.length > 0) {
          return data.data.map((row: any[]) => {
            const obj: any = {};
            data.columns!.forEach((col: string, index: number) => {
              obj[col] = row[index];
            });
            return obj;
          });
        }
        return data.data;
      }
      return [];

    } catch (error) {
      console.warn("SQL Exec Error:", error);
      console.log("Switching to Offline Mode due to connection error.");
      this.offlineMode = true; 
      this.state.connected = false;
      return this.execLocalSql(sql);
    }
  }

  public async initDatabase() {
    console.log("Initializing Game DB Connection...");
    
    // Step 1: Try to create the database if it doesn't exist
    await this.createDatabase();

    // Step 2: Initialize Tables
    // Use Basic Auth here too to ensure we have rights to modify schema if the API key is restricted
    for (const sql of SQL_INIT_TABLES) {
      // Trying with Basic Auth for schema updates just to be safe
      await this.execSql(sql, true); 
    }

    // Step 3: Verify connection by reading back
    if (!this.offlineMode) {
      this.state.connected = true;
      console.log("Cloud DB Connected & Initialized.");
    } else {
      console.log("Could not connect to Cloud. Starting in Local Mode.");
    }
  }

  // --- Lógica do Jogo ---

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
        money: parseFloat(p.money),
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
    const playersData = await this.execSql(`SELECT * FROM players`);
    const playersMap: Record<string, Player> = {};
    if (Array.isArray(playersData)) {
      playersData.forEach((p: any) => {
        playersMap[p.id] = {
          id: p.id,
          username: p.username,
          color: p.color,
          money: parseFloat(p.money),
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
          strength: parseInt(t.strength),
          lat: parseFloat(t.lat),
          lng: parseFloat(t.lng),
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

    if (player.money < cost) {
      return { success: false, message: "Fundos Insuficientes" };
    }

    if (itemId === 'recruit' && targetTerritoryId) {
      const t = this.state.territories[targetTerritoryId];
      if (t && t.ownerId === playerId) {
        await this.execSql(`UPDATE territories SET strength = strength + 10 WHERE id = '${targetTerritoryId}'`);
        await this.execSql(`UPDATE players SET money = money - ${cost} WHERE id = '${playerId}'`);
        return { success: true, message: "Tropas Recrutadas!" };
      }
    }

    await this.execSql(`UPDATE players SET money = money - ${cost} WHERE id = '${playerId}'`);
    return { success: true, message: "Compra realizada" };
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