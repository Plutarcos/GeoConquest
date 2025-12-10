import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GameState, Player, Territory } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, GRID_SIZE, SUPABASE_URL, SUPABASE_ANON_KEY, ENERGY_COST_ATTACK, ENERGY_MAX } from '../constants';

export class GameService {
  private state: GameState;
  private offlineMode: boolean = false;
  private supabase: SupabaseClient | null = null;

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
       // Local data handling
    }
  }

  // --- Helpers for Offline Mode ---
  private getLocalData() {
    const json = localStorage.getItem('geoconquest_offline_data');
    if (!json) return { players: [], territories: [] };
    const data = JSON.parse(json);
    return data;
  }

  private saveLocalData(data: any) {
    localStorage.setItem('geoconquest_offline_data', JSON.stringify(data));
  }

  private async execLocalSql(action: string, payload: any): Promise<any> {
    const data = this.getLocalData();
    // Simplified offline logic logic for brevity - focus on Supabase
    // Ideally duplicate some of the robust logic from before if offline is critical
    // For now, we assume online priority
    return { success: false, message: "Offline mode limited" };
  }

  // --- Supabase Init ---

  public async initDatabase() {
    console.log("Initializing Supabase...");
    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
      });
      
      // Test connection
      const { error } = await this.supabase.from('players').select('id').limit(1);
      
      if (error && error.code !== 'PGRST116') { // Ignore empty result error, check connection error
          throw error;
      }

      this.state.connected = true;
      this.offlineMode = false;
      console.log("Supabase Connected.");
      
    } catch (e) {
      console.error("Supabase Connection Failed:", e);
      this.offlineMode = true;
      this.state.connected = false;
    }
  }

  // --- Game Logic ---

  public async login(username: string, password?: string): Promise<Player> {
    const id = `user_${username.replace(/\s+/g, '_').toLowerCase()}`;
    const color = this.getRandomColor();
    const now = Date.now();

    if (this.offlineMode || !this.supabase) {
        // Simple offline fallback
        return {
            id, username, color, money: INITIAL_MONEY, energy: 100, maxEnergy: 100, lastSeen: now
        };
    }

    // Upsert Player
    const { data, error } = await this.supabase
        .from('players')
        .upsert({ 
            id, 
            username, 
            color, 
            last_seen: now,
            ...(password ? { password } : {})
        }, { onConflict: 'id', ignoreDuplicates: false })
        .select()
        .single();

    if (error || !data) {
        console.error("Login Error", error);
        throw new Error("Login failed");
    }

    // Ensure defaults if new
    if (data.money === null) data.money = INITIAL_MONEY;
    if (data.energy === null) data.energy = 100;

    return {
        id: data.id,
        username: data.username,
        color: data.color,
        money: Number(data.money),
        energy: Number(data.energy),
        maxEnergy: 100,
        lastSeen: data.last_seen
    };
  }

  public async syncState(currentPlayerId: string | null): Promise<GameState> {
    if (this.offlineMode || !this.supabase) {
        return { ...this.state, connected: false };
    }

    // Fetch Players
    const { data: playersData } = await this.supabase.from('players').select('*');
    const playersMap: Record<string, Player> = {};
    if (playersData) {
        playersData.forEach((p: any) => {
            playersMap[p.id] = {
                id: p.id,
                username: p.username,
                color: p.color,
                money: Number(p.money),
                energy: Number(p.energy),
                maxEnergy: 100,
                lastSeen: p.last_seen
            };
        });
    }

    // Fetch Territories
    // Optimization: In a real world app, fetch based on viewport bounds (lat/lng)
    const { data: terrData } = await this.supabase.from('territories').select('*');
    const terrMap: Record<string, Territory> = {};
    if (terrData) {
        terrData.forEach((t: any) => {
            terrMap[t.id] = {
                id: t.id,
                name: t.name,
                ownerId: t.owner_id,
                strength: t.strength,
                lat: t.lat,
                lng: t.lng
            };
        });
    }

    this.state.players = playersMap;
    this.state.territories = terrMap;
    this.state.connected = true;

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

    // Local optimisic
    const strength = Math.floor(Math.random() * 20) + 5;
    const t: Territory = {
        id, name, ownerId: null, strength, lat: snappedLat, lng: snappedLng
    };

    if (!this.offlineMode && this.supabase) {
        // Check DB
        const { data } = await this.supabase.from('territories').select('id').eq('id', id).single();
        if (!data) {
            // Insert
            await this.supabase.from('territories').insert({
                id,
                name,
                lat: snappedLat,
                lng: snappedLng,
                strength,
                owner_id: null
            });
        }
    } else {
        // Offline logic
    }
    
    return t;
  }

  public async captureTerritory(playerId: string, territoryId: string) {
    // Initial capture (usually free or setup phase)
    if (!this.offlineMode && this.supabase) {
        await this.supabase.from('territories')
            .update({ owner_id: playerId, strength: INITIAL_STRENGTH })
            .eq('id', territoryId);
        
        const t = this.state.territories[territoryId];
        if (t) await this.generateNeighbors(t.lat, t.lng);
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
    if (this.offlineMode || !this.supabase) return { success: false, message: "Offline" };

    const { data, error } = await this.supabase.rpc('attack_territory', {
        attacker_id: attackerId,
        source_id: sourceId,
        target_id: targetId,
        energy_cost: ENERGY_COST_ATTACK
    });

    if (error) {
        console.error(error);
        return { success: false, message: "Erro no ataque" };
    }

    if (data.success) {
        // Trigger neighbor generation on success
        const t = this.state.territories[targetId];
        if (t) this.generateNeighbors(t.lat, t.lng);
    }

    return data;
  }

  public async purchaseUpgrade(playerId: string, itemId: string, targetTerritoryId?: string): Promise<{success: boolean, message: string}> {
    if (this.offlineMode || !this.supabase) return { success: false, message: "Offline" };

    let cost = 0;
    let boost = 0;
    if (itemId === 'recruit') { cost = 50; boost = 10; }
    if (itemId === 'fortify') { cost = 100; boost = 20; }
    if (itemId === 'shield') { cost = 300; boost = 50; }
    
    // Airstrike and sabotage logic handled slightly differently in RPC ideally, 
    // but for now mapping to strength_boost parameter or custom RPC
    // To keep it simple with the provided RPC `purchase_upgrade`:
    
    if (itemId === 'airstrike') {
        // Airstrike reduces strength, so negative boost. 
        // Need to check ownership logic (RPC assumes we upgrade OUR territory usually, or check SQL)
        // For simplicity let's handle specific logic via direct update if the RPC is too simple, 
        // BUT RPC is safer.
        // Assuming user added comprehensive RPC or we use client-side logic + safe update
        // Let's use specific logic here for complex items
        
        const { error } = await this.supabase.rpc('purchase_upgrade', {
             player_id: playerId,
             cost: 500,
             territory_id: targetTerritoryId,
             strength_boost: -50 // Damage
        });
        if(error) return { success: false, message: "Erro na compra" };
        return { success: true, message: "Ataque Aéreo!" };
    }

    const { data, error } = await this.supabase.rpc('purchase_upgrade', {
        player_id: playerId,
        cost: cost,
        territory_id: targetTerritoryId,
        strength_boost: boost
    });

    if (error) return { success: false, message: "Fundos insuficientes ou Erro" };
    return { success: data, message: data ? "Comprado!" : "Falha" };
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
}

export const gameService = new GameService();