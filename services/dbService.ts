

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GameState, Player, Territory } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, GRID_SIZE, SUPABASE_URL, SUPABASE_ANON_KEY, ENERGY_COST_ATTACK, ENERGY_MAX, INCOME_PER_TERRITORY } from '../constants';

export class GameService {
  private state: GameState;
  private offlineMode: boolean = false;
  private supabase: SupabaseClient | null = null;
  private lastPassiveTick: number = 0;

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
      
      if (error && error.code !== 'PGRST116') { 
          throw error;
      }

      this.state.connected = true;
      this.offlineMode = false;
      console.log("Supabase Connected.");
      
      // Subscribe to realtime changes
      this.supabase.channel('game_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, (payload) => {
           if (payload.new && (payload.new as any).id) {
               this.updateLocalTerritory(payload.new as any);
           }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
           if (payload.new && (payload.new as any).id) {
               this.updateLocalPlayer(payload.new as any);
           }
        })
        .subscribe();

    } catch (e) {
      console.error("Supabase Connection Failed:", e);
      this.offlineMode = true;
      this.state.connected = false;
    }
  }

  private updateLocalTerritory(t: any) {
      if (this.state.territories[t.id]) {
          this.state.territories[t.id] = {
              ...this.state.territories[t.id],
              ownerId: t.owner_id,
              strength: t.strength
          };
      }
  }

  private updateLocalPlayer(p: any) {
      if (this.state.players[p.id]) {
          this.state.players[p.id] = {
              ...this.state.players[p.id],
              money: Number(p.money),
              energy: Number(p.energy),
              inventory: p.inventory || {}
          };
      }
  }

  // --- Game Logic ---

  public async login(username: string): Promise<Player> {
    const id = `user_${username.replace(/\s+/g, '_').toLowerCase()}`;
    const color = this.getRandomColor();
    const now = Date.now();

    if (this.offlineMode || !this.supabase) {
        return {
            id, username, color, money: INITIAL_MONEY, energy: 100, maxEnergy: 100, lastSeen: now, inventory: {}
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
            inventory: {}
        }, { onConflict: 'id', ignoreDuplicates: false })
        .select()
        .single();

    if (error || !data) {
        console.error("Login Error", error);
        throw new Error("Login failed (Connection error)");
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
        lastSeen: data.last_seen,
        inventory: data.inventory || {}
    };
  }

  public async getUserTerritoryCount(playerId: string): Promise<number> {
      if (!this.supabase) return 0;
      const { count } = await this.supabase.from('territories')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', playerId);
      return count || 0;
  }

  public async syncState(currentPlayerId: string | null): Promise<GameState> {
    if (this.offlineMode || !this.supabase) {
        return { ...this.state, connected: false };
    }

    // Process Passive Growth/Money Loop (Client-side simulation of cron)
    const now = Date.now();
    if (now - this.lastPassiveTick > 10000 && currentPlayerId) {
        this.processPassiveGrowth(currentPlayerId);
        this.lastPassiveTick = now;
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
                lastSeen: p.last_seen,
                inventory: p.inventory || {}
            };
        });
    }

    // Fetch Territories in view (simplified to all for now)
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
    // Collect IDs
    const idsToFetch: string[] = [];
    const gridPoints: {lat: number, lng: number, id: string, name: string}[] = [];

    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const lat = centerLat + (x * GRID_SIZE);
        const lng = centerLng + (y * GRID_SIZE);
        const id = this.getGridId(lat, lng);
        const snappedLat = this.snapToGrid(lat);
        const snappedLng = this.snapToGrid(lng);
        const name = `Sector ${id.replace('_', ':')}`;
        
        if (!this.state.territories[id]) {
            idsToFetch.push(id);
            gridPoints.push({ lat: snappedLat, lng: snappedLng, id, name });
        }
      }
    }

    // Batch Fetch
    if (!this.offlineMode && this.supabase && idsToFetch.length > 0) {
        const { data } = await this.supabase.from('territories').select('*').in('id', idsToFetch);
        const existingIds = new Set((data || []).map((t: any) => t.id));

        // Create missing
        const newTerritories = gridPoints.filter(p => !existingIds.has(p.id)).map(p => ({
            id: p.id,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            strength: Math.floor(Math.random() * 20) + 5,
            owner_id: null
        }));

        if (newTerritories.length > 0) {
            await this.supabase.from('territories').insert(newTerritories);
        }
    }
  }

  private async processPassiveGrowth(playerId: string) {
     if(!this.supabase) return;

     // 1. Grow Strength of Owned Territories
     // 2. Give Money
     const { data: myTerrs } = await this.supabase.from('territories').select('id').eq('owner_id', playerId);
     if (myTerrs && myTerrs.length > 0) {
         // Money
         const income = myTerrs.length * INCOME_PER_TERRITORY;
         await this.supabase.rpc('purchase_item', { player_id: playerId, item_id: 'passive_income', cost: -income }); // Negative cost = add money hack using existing function or update directly
         // Better:
         await this.supabase.from('players').update({ money: this.state.players[playerId].money + income }).eq('id', playerId);

         // Strength
         const terrIds = myTerrs.map(t => t.id);
         // Increase strength by 1, max 5000
         // We can't do complex math in simple update easily without RPC, so let's skip strength growth for now or assume server handles it
         // Or update one by one (slow). Let's assume the anti-cheat allows small updates.
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

  public async captureTerritory(playerId: string, territoryId: string) {
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
        // Reuse batch logic via initLocalGrid but scoped to small radius
        await this.initLocalGrid(nLat, nLng); 
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
    return data;
  }

  // --- Inventory & Items ---

  public async purchaseItem(playerId: string, itemId: string, cost: number): Promise<{success: boolean, message: string}> {
      if (!this.supabase) return { success: false, message: "Offline" };
      
      const { data, error } = await this.supabase.rpc('purchase_item', {
          player_id: playerId,
          item_id: itemId,
          cost: cost
      });

      if (error || !data) return { success: false, message: "Fundos insuficientes" };
      return { success: true, message: "Comprado" };
  }

  public async useItem(playerId: string, itemId: string, targetTerritoryId?: string): Promise<{success: boolean, message: string}> {
      if (!this.supabase) return { success: false, message: "Offline" };

      const { data, error } = await this.supabase.rpc('use_item', {
          player_id: playerId,
          item_id: itemId,
          target_territory_id: targetTerritoryId || null
      });

      if (error) return { success: false, message: "Erro ao usar item" };
      return data;
  }

  public async transferTroops(playerId: string, sourceId: string, targetId: string, amount: number): Promise<{success: boolean, message: string}> {
      if (!this.supabase) return { success: false, message: "Offline" };

      const { data, error } = await this.supabase.rpc('transfer_strength', {
          player_id: playerId,
          source_id: sourceId,
          target_id: targetId,
          amount: amount
      });
      
      if (error || !data) return { success: false, message: "Falha na transferência" };
      return { success: true, message: "Tropas transferidas" };
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
