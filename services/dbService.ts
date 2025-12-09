
import { GameState, Player, Territory, SqliteCloudResponse } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, INCOME_PER_TERRITORY, GRID_SIZE, DB_CONFIG, SQL_INIT } from '../constants';

export class GameService {
  private state: GameState;
  private endpoint: string;

  constructor() {
    // FIX: Remove port 8860 for HTTP requests. The REST API runs on standard HTTPS (443).
    this.endpoint = `https://${DB_CONFIG.host}/v2/webeditor/sql`;

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

    // Iniciar loop de renda passiva (simulação simplificada, em prod idealmente seria server-side)
    setInterval(() => this.passiveIncomeLoop(), 5000);
  }

  // --- Helpers de Banco de Dados (HTTP) ---

  private async execSql(sql: string): Promise<any[]> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        mode: 'cors', // Ensure CORS is handled
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DB_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          sql: sql,
          database: DB_CONFIG.database
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DB Error (${response.status}): ${errText}`);
      }

      const data: SqliteCloudResponse = await response.json();
      
      // A API retorna um array de resultados. O formato varia dependendo do comando.
      // Geralmente data.data contém as linhas para SELECT
      if (data.data) {
        // Transformar formato de array de arrays para array de objetos baseado nas colunas
        if (data.columns && data.data.length > 0) {
          return data.data.map((row: any[]) => {
            const obj: any = {};
            data.columns.forEach((col: string, index: number) => {
              obj[col] = row[index];
            });
            return obj;
          });
        }
        return data.data; // Retorno bruto se não houver colunas
      }
      
      return [];
    } catch (error) {
      console.error("SQL Exec failed:", error);
      // Don't throw here to prevent crashing the UI loop, but log it
      return [];
    }
  }

  public async initDatabase() {
    console.log("Initializing Cloud DB...");
    // Try to create database first if possible, or just rely on existing
    // Note: CREATE DATABASE might require admin permissions not available in this context,
    // so we assume the DB 'geoconquest.sqlite' exists or will be auto-created by the platform if configured.
    
    for (const sql of SQL_INIT) {
      await this.execSql(sql);
    }
    this.state.connected = true;
    console.log("Cloud DB Initialized.");
  }

  // --- Lógica do Jogo ---

  public async login(username: string): Promise<Player> {
    const id = `user_${username.replace(/\s+/g, '_').toLowerCase()}`;
    const color = this.getRandomColor();
    const now = Date.now();

    // Tenta inserir ou ignorar se já existir
    // Nota: SQLiteCloud HTTP pode não suportar múltiplas queries complexas de uma vez, fazemos simples
    
    // Verificar se existe
    const existing = await this.execSql(`SELECT * FROM players WHERE id = '${id}'`);
    
    if (existing && existing.length > 0) {
      // Atualizar last_seen
      await this.execSql(`UPDATE players SET last_seen = ${now} WHERE id = '${id}'`);
      const p = existing[0];
      // Garantir tipos corretos
      return {
        id: p.id,
        username: p.username,
        color: p.color,
        money: parseFloat(p.money),
        lastSeen: p.last_seen
      };
    } else {
      // Criar novo
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
    // 1. Fetch Players
    const playersData = await this.execSql(`SELECT * FROM players`);
    const playersMap: Record<string, Player> = {};
    playersData.forEach((p: any) => {
      playersMap[p.id] = {
        id: p.id,
        username: p.username,
        color: p.color,
        money: parseFloat(p.money),
        lastSeen: p.last_seen
      };
    });

    // 2. Fetch Territories
    const terrData = await this.execSql(`SELECT * FROM territories`);
    const terrMap: Record<string, Territory> = {};
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

    // Atualizar estado local
    this.state.players = playersMap;
    this.state.territories = terrMap;
    this.state.connected = true;

    return { ...this.state };
  }

  // Gera o grid localmente, mas verifica/salva no DB
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

    // Verificar se já existe no estado local sincronizado
    if (this.state.territories[id]) {
      return this.state.territories[id];
    }

    // Tentar criar no DB (INSERT OR IGNORE)
    const strength = Math.floor(Math.random() * 20) + 5;
    
    // Check first to avoid complex SQL
    const check = await this.execSql(`SELECT 1 FROM territories WHERE id = '${id}'`);
    if (check.length === 0) {
         await this.execSql(`INSERT INTO territories (id, owner_id, strength, lat, lng, name) VALUES ('${id}', NULL, ${strength}, ${snappedLat}, ${snappedLng}, '${name}')`);
    }

    // Retorna um objeto temporário até o próximo sync
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
      // Update DB
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
    // Precisamos garantir que temos o estado mais recente antes de calcular o ataque
    // Para UX rápida, usamos o estado local, mas o DB é a verdade.
    
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
      // Atualizar DB: Fonte perde força, Alvo muda dono e ganha força restante
      await this.execSql(`UPDATE territories SET strength = 1 WHERE id = '${sourceId}'`);
      await this.execSql(`UPDATE territories SET strength = ${remaining}, owner_id = '${attackerId}' WHERE id = '${targetId}'`);
      
      await this.generateNeighbors(target.lat, target.lng);
      return { success: true, message: `Conquistado!` };
    } else {
      const newDefense = Math.max(1, defensePower - Math.floor(attackPower * 0.8));
      // Atualizar DB: Fonte perde força, Alvo perde força mas mantém dono
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
        // Transação DB
        await this.execSql(`UPDATE territories SET strength = strength + 10 WHERE id = '${targetTerritoryId}'`);
        await this.execSql(`UPDATE players SET money = money - ${cost} WHERE id = '${playerId}'`);
        return { success: true, message: "Tropas Recrutadas!" };
      }
    }

    // Generic purchase
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

  // Simulação de renda passiva "Client-Side Authoritative" (apenas para o próprio player para evitar conflitos)
  // Em produção real, isso seria um Job no servidor.
  private async passiveIncomeLoop() {
    const currentUserJson = localStorage.getItem('geoconquest_user');
    if (!currentUserJson) return;
    
    const user = JSON.parse(currentUserJson);
    const userId = user.id;

    // Contar territórios deste usuário no estado atual
    const ownedCount = Object.values(this.state.territories).filter(t => t.ownerId === userId).length;
    
    if (ownedCount > 0) {
      const income = ownedCount * INCOME_PER_TERRITORY;
      // Enviar incremento para o DB
      // Usamos UPDATE money = money + X para evitar race conditions simples de leitura
      await this.execSql(`UPDATE players SET money = money + ${income} WHERE id = '${userId}'`);
    }
  }
}

export const gameService = new GameService();
