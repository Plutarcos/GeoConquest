

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GameState, Player, Territory, ChatMessage } from '../types';
import { INITIAL_STRENGTH, INITIAL_MONEY, GRID_SIZE, SUPABASE_URL, SUPABASE_ANON_KEY, ENERGY_COST_ATTACK, ENERGY_MAX, INCOME_PER_TERRITORY } from '../constants';

export class GameService {
  private state: GameState;
  private offlineMode: boolean = false;
  private supabase: SupabaseClient | null = null;
  private lastPassiveTick: number = 0;
  private chatCallback: ((msg: ChatMessage) => void) | null = null;

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
       // Local data handling could go here
    }
  }

  public setChatCallback(cb: (msg: ChatMessage) => void) {
      this.chatCallback = cb;
  }

  // --- Helper to enforce timeout ---
  private async withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
      return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
              reject(new Error("Timeout"));
          }, ms);

          promise.then(
              (value) => {
                  clearTimeout(timer);
                  resolve(value);
              },
              (reason) => {
                  clearTimeout(timer);
                  reject(reason);
              }
          );
      });
  }

  // --- Supabase Init ---

  public async initDatabase() {
    if (this.supabase) return; // Prevent double init

    console.log("Initializing Supabase...");
    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        },
        global: {
            headers: { 'x-application-name': 'geoconquest' }
        }
      });
      
      // Test connection with a fast timeout (3s). If it fails, go offline immediately.
      await this.withTimeout(this.supabase.from('players').select('count', { count: 'exact', head: true }), 3000);

      this.state.connected = true;
      this.offlineMode = false;
      console.log("Supabase Client Initialized & Connected.");
      
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
           if (payload.new && this.chatCallback) {
               const msg = payload.new as any;
               this.chatCallback({
                   id: msg.id,
                   sender: msg.sender,
                   text: msg.text,
                   timestamp: new Date(msg.created_at).getTime(),
                   isSystem: false
               });
           }
        })
        .subscribe();

    } catch (e) {
      console.warn("Supabase Init Slow/Failed. Switching to Offline Mode.", e);
      this.offlineMode = true;
      this.state.connected = false;
    }
  }

  private updateLocalTerritory(t: any) {
      // Direct overwrite logic to ensure consistency
      this.state.territories[t.id] = {
          id: t.id,
          name: t.name,
          ownerId: t.owner_id,
          strength: t.strength,
          lat: t.lat,
          lng: t.lng
      };
  }

  private updateLocalPlayer(p: any) {
      let inv = p.inventory || {};
      if (typeof inv === 'string') {
          try { inv = JSON.parse(inv); } catch (e) { inv = {}; }
      }

      this.state.players[p.id] = {
          id: p.id,
          username: p.username,
          color: p.color,
          money: Number(p.money),
          energy: Number(p.energy),
          maxEnergy: 100,
          lastSeen: p.last_seen,
          inventory: inv
      };
  }

  // --- Game Logic ---

  public async login(username: string): Promise<Player> {
    const id = `user_${username.replace(/\s+/g, '_').toLowerCase()}`;
    const color = this.getRandomColor();
    const now = Date.now();

    const createOfflinePlayer = (): Player => ({
        id, username, color, money: INITIAL_MONEY, energy: 100, maxEnergy: 100, lastSeen: now, inventory: {}
    });

    if (this.offlineMode || !this.supabase) {
        const p = createOfflinePlayer();
        this.state.players[p.id] = p;
        return p;
    }

    const performDbLogin = async (): Promise<Player> => {
        if (!this.supabase) throw new Error("No DB");
        let { data, error } = await this.supabase.from('players').select('*').eq('id', id).single();

        if (error && error.code !== 'PGRST116' && error.code !== '406') throw error;

        if (!data || (error && (error.code === 'PGRST116' || error.code === '406'))) {
            const { data: newData, error: createError } = await this.supabase
                .from('players')
                .insert([{ id, username, color, money: INITIAL_MONEY, energy: 100, inventory: {}, last_seen: now }])
                .select().single();
            if (createError) throw createError;
            data = newData;
        }

        let inv = data.inventory || {};
        if (typeof inv === 'string') { try { inv = JSON.parse(inv); } catch (e) { inv = {}; } }

        return {
            id: data.id,
            username: data.username,
            color: data.color,
            money: Number(data.money),
            energy: Number(data.energy),
            maxEnergy: 100,
            lastSeen: data.last_seen,
            inventory: inv
        };
    };

    try {
        const p = await this.withTimeout(performDbLogin(), 5000);
        this.state.players[p.id] = p;
        return p;
    } catch (e: any) {
        this.offlineMode = true;
        this.state.connected = false;
        const p = createOfflinePlayer();
        this.state.players[p.id] = p;
        return p;
    }
  }

  public async getUserTerritoryCount(playerId: string): Promise<number> {
      if (!this.supabase || this.offlineMode) return 0;
      try {
        const { count } = await this.supabase.from('territories')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', playerId);
        return count || 0;
      } catch (e) { return 0; }
  }

  public async syncState(currentPlayerId: string | null): Promise<GameState> {
    if (this.offlineMode || !this.supabase) {
        return { ...this.state, connected: false };
    }

    try {
        const now = Date.now();
        if (now - this.lastPassiveTick > 10000 && currentPlayerId) {
             this.supabase.rpc('passive_territory_growth', { player_id: currentPlayerId }).then(() => {});
             this.lastPassiveTick = now;
        }

        const { data: playersData } = await this.supabase.from('players').select('*');
        if (playersData) {
            playersData.forEach((p: any) => this.updateLocalPlayer(p));
        }

        const { data: terrData } = await this.supabase.from('territories').select('*');
        if (terrData) {
            terrData.forEach((t: any) => this.updateLocalTerritory(t));
        }

        this.state.connected = true;
    } catch (e) {
        console.warn("Sync glitch", e);
        this.state.connected = false;
    }
    return { ...this.state };
  }

  public async initLocalGrid(centerLat: number, centerLng: number) {
    this.state.centerLat = centerLat;
    this.state.centerLng = centerLng;

    const radius = 3; 
    const idsToFetch: string[] = [];
    const gridPoints: {lat: number, lng: number, id: string, name: string}[] = [];

    // 1. Calculate Expected IDs
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const lat = centerLat + (x * GRID_SIZE);
        const lng = centerLng + (y * GRID_SIZE);
        const id = this.getGridId(lat, lng);
        const snappedLat = this.snapToGrid(lat);
        const snappedLng = this.snapToGrid(lng);
        const name = `Sector ${id.replace('_', ':')}`;
        
        idsToFetch.push(id);
        gridPoints.push({ lat: snappedLat, lng: snappedLng, id, name });
      }
    }

    // 2. Fetch existing from DB
    if (!this.offlineMode && this.supabase) {
        try {
            const { data, error } = await this.supabase.from('territories').select('*').in('id', idsToFetch);
            
            if (error) throw error;

            const fetchedMap = new Set<string>();

            // Populate state with REAL data from DB
            if (data) {
                data.forEach((t: any) => {
                    fetchedMap.add(t.id);
                    this.updateLocalTerritory(t);
                });
            }

            // 3. Only generate neutrals for IDs that do NOT exist in DB
            const newTerritories: any[] = [];
            gridPoints.forEach(p => {
                if (!fetchedMap.has(p.id)) {
                    // It doesn't exist in DB, so it's a new neutral territory
                    // Check if we already have it locally to avoid overwriting user actions
                    if (!this.state.territories[p.id]) {
                        const newT = {
                            id: p.id,
                            name: p.name,
                            lat: p.lat,
                            lng: p.lng,
                            strength: Math.floor(Math.random() * 20) + 5,
                            owner_id: null
                        };
                        newTerritories.push(newT);
                        // Optimistic update
                        this.state.territories[p.id] = { ...newT, ownerId: null }; 
                    }
                }
            });

            // Bulk insert new neutrals so other players see them too
            if (newTerritories.length > 0) {
                await this.supabase.from('territories').insert(newTerritories);
            }

        } catch (e) {
            console.warn("Grid fetch failed, using fallback.", e);
            this.fillGridWithOfflineDefaults(gridPoints);
        }
    } else {
         this.fillGridWithOfflineDefaults(gridPoints);
    }
  }

  private fillGridWithOfflineDefaults(gridPoints: any[]) {
      gridPoints.forEach(p => {
        if (!this.state.territories[p.id]) {
                this.state.territories[p.id] = {
                id: p.id,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                strength: 5,
                ownerId: null
                };
        }
    });
  }

  private snapToGrid(val: number): number {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }

  public getGridId(lat: number, lng: number): string {
    const snappedLat = this.snapToGrid(lat).toFixed(4);
    const snappedLng = this.snapToGrid(lng).toFixed(4);
    return `${snappedLat}_${snappedLng}`;
  }

  // --- ACTIONS ---

  // New Secure Method for Initial Claim
  public async claimTerritory(playerId: string, territoryId: string): Promise<boolean> {
      if (this.offlineMode || !this.supabase) {
          if (this.state.territories[territoryId] && !this.state.territories[territoryId].ownerId) {
             this.state.territories[territoryId].ownerId = playerId;
             this.state.territories[territoryId].strength = INITIAL_STRENGTH;
             return true;
          }
          return false;
      }

      try {
        // Try to update WHERE owner_id IS NULL to prevent overwriting
        const { data, error } = await this.supabase
            .from('territories')
            .update({ owner_id: playerId, strength: INITIAL_STRENGTH })
            .eq('id', territoryId)
            .is('owner_id', null) 
            .select();

        if (error || !data || data.length === 0) {
            await this.syncState(playerId);
            return false;
        }

        await this.generateNeighbors(this.state.territories[territoryId].lat, this.state.territories[territoryId].lng);
        return true;

      } catch (e) {
          console.error("Claim failed:", e);
          return false;
      }
  }

  // Kept for legacy/admin, but claimTerritory should be used for setup
  public async captureTerritory(playerId: string, territoryId: string) {
      return this.claimTerritory(playerId, territoryId);
  }

  private async generateNeighbors(lat: number, lng: number) {
     const offsets = [[0,1], [0,-1], [1,0], [-1,0]];
     for (const [ox, oy] of offsets) {
        const nLat = lat + (ox * GRID_SIZE);
        const nLng = lng + (oy * GRID_SIZE);
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
    if (this.offlineMode || !this.supabase) {
        // Simple offline logic
        const target = this.state.territories[targetId];
        if (target) {
            target.ownerId = attackerId;
            target.strength = 10;
            return { success: true, message: "Conquistado (Offline)" };
        }
        return { success: false, message: "Erro offline" };
    }

    try {
        const { data, error } = await this.supabase.rpc('attack_territory', {
            attacker_id: attackerId,
            source_id: sourceId,
            target_id: targetId,
            energy_cost: ENERGY_COST_ATTACK
        });

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Attack error:", e);
        return { success: false, message: "Erro no ataque" };
    }
  }

  public async purchaseItem(playerId: string, itemId: string, cost: number): Promise<{success: boolean, message: string}> {
      // 1. Check Offline
      if (this.offlineMode || !this.supabase) {
           return this.offlinePurchase(playerId, itemId, cost);
      }
      
      const p = this.state.players[playerId];
      if (!p) return { success: false, message: "Player error" };
      if (p.money < cost) return { success: false, message: "Fundos insuficientes" };

      // 2. OPTIMISTIC UPDATE (Client Side First)
      // This makes the UI feel instant
      const oldMoney = p.money;
      const oldInv = { ...p.inventory };
      
      p.money -= cost;
      p.inventory[itemId] = (p.inventory[itemId] || 0) + 1;

      try {
          // 3. Perform RPC
          const { data, error } = await this.supabase.rpc('purchase_item', {
              player_id: playerId,
              item_id: itemId,
              cost: cost
          });

          if (error) throw error;
          
          if (data === false) {
             // Rollback if server says no
             p.money = oldMoney;
             p.inventory = oldInv;
             return { success: false, message: "Fundos insuficientes" };
          }

          return { success: true, message: "Item Adquirido" };
      } catch (e) {
          console.error("Purchase Sync Error", e);
          // Rollback on network error? Or keep offline? 
          // For now, let's assume if it failed, we rollback to stay safe.
          p.money = oldMoney;
          p.inventory = oldInv;
          return { success: false, message: "Erro na transação" };
      }
  }

  private offlinePurchase(playerId: string, itemId: string, cost: number): {success: boolean, message: string} {
      const p = this.state.players[playerId];
      if (!p) return { success: false, message: "Erro player" };
      if (p.money < cost) return { success: false, message: "Fundos insuficientes" };
      
      p.money -= cost;
      p.inventory[itemId] = (p.inventory[itemId] || 0) + 1;
      return { success: true, message: "Comprado (Offline)" };
  }

  public async useItem(playerId: string, itemId: string, targetTerritoryId?: string): Promise<{success: boolean, message: string}> {
      if (this.offlineMode || !this.supabase) {
           return { success: true, message: "Item usado (Offline)" };
      }

      try {
        const { data, error } = await this.supabase.rpc('use_item', {
            player_id: playerId,
            item_id: itemId,
            target_territory_id: targetTerritoryId || null
        });

        if (error) throw error;
        
        // Ensure state sync after item use to show effect immediately
        await this.syncState(playerId);

        return data;
      } catch (e) {
          return { success: false, message: "Erro ao usar item" };
      }
  }

  public async transferTroops(playerId: string, sourceId: string, targetId: string, amount: number): Promise<{success: boolean, message: string}> {
      if (this.offlineMode || !this.supabase) return { success: true, message: "Transferido (Offline)" };

      try {
        const { data, error } = await this.supabase.rpc('transfer_strength', {
            player_id: playerId,
            source_id: sourceId,
            target_id: targetId,
            amount: amount
        });
        
        if (error || !data) return { success: false, message: "Falha na transferência" };
        return { success: true, message: "Tropas transferidas" };
      } catch (e) {
          return { success: false, message: "Erro de conexão" };
      }
  }

  public async sendGlobalMessage(sender: string, text: string) {
      if (this.offlineMode || !this.supabase) return;
      try {
          await this.supabase.from('messages').insert([{ sender, text }]);
      } catch (e) { console.error("Chat Error", e); }
  }

  public getLatestState(): GameState {
    return { ...this.state };
  }

  private getRandomColor() {
      const colors = ['#0aff00', '#00f3ff', '#ff003c', '#eab308', '#bf00ff', '#8b5cf6', '#ffffff', '#f97316'];
      return colors[Math.floor(Math.random() * colors.length)];
  }

  public resetGame() {
    localStorage.removeItem('geoconquest_user');
    window.location.reload();
  }
}

export const gameService = new GameService();
