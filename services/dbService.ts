

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
      if (this.state.territories[t.id]) {
          this.state.territories[t.id] = {
              ...this.state.territories[t.id],
              ownerId: t.owner_id,
              strength: t.strength
          };
      }
  }

  private updateLocalPlayer(p: any) {
      // Ensure we treat inventory as an object even if DB sends string
      let inv = p.inventory || {};
      if (typeof inv === 'string') {
          try { inv = JSON.parse(inv); } catch (e) { inv = {}; }
      }

      if (this.state.players[p.id]) {
          this.state.players[p.id] = {
              ...this.state.players[p.id],
              money: Number(p.money),
              energy: Number(p.energy),
              inventory: inv
          };
      } else {
          // New player detected via realtime
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
  }

  // --- Game Logic ---

  public async login(username: string): Promise<Player> {
    const id = `user_${username.replace(/\s+/g, '_').toLowerCase()}`;
    const color = this.getRandomColor();
    const now = Date.now();

    // Helper to create an offline/default player object
    const createOfflinePlayer = (): Player => ({
        id, 
        username, 
        color, 
        money: INITIAL_MONEY, 
        energy: 100, 
        maxEnergy: 100, 
        lastSeen: now, 
        inventory: {}
    });

    if (this.offlineMode || !this.supabase) {
        const p = createOfflinePlayer();
        this.state.players[p.id] = p; // IMPORTANT: Add to local state
        return p;
    }

    // Wrap the entire DB Login Logic in a separate function to race against timeout
    const performDbLogin = async (): Promise<Player> => {
        if (!this.supabase) throw new Error("No DB");

        // 1. Try to FIND the user first
        let { data, error } = await this.supabase
            .from('players')
            .select('*')
            .eq('id', id)
            .single();

        // PGRST116 means "No rows found"
        if (error && error.code !== 'PGRST116' && error.code !== '406') {
             throw error;
        }

        // 2. If not found, CREATE the user
        if (!data || (error && (error.code === 'PGRST116' || error.code === '406'))) {
            console.log("User not found, creating new one...");
            const { data: newData, error: createError } = await this.supabase
                .from('players')
                .insert([{ 
                    id, 
                    username, 
                    color, 
                    money: INITIAL_MONEY,
                    energy: 100,
                    inventory: {},
                    last_seen: now 
                }])
                .select()
                .single();
            
            if (createError) throw createError;
            data = newData;
        }

        let inv = data.inventory || {};
        if (typeof inv === 'string') {
            try { inv = JSON.parse(inv); } catch (e) { inv = {}; }
        }

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
        // RACE: Database vs 5 second Timer
        // If Database is slow (cold start), we just let the user play offline.
        const p = await this.withTimeout(performDbLogin(), 5000);
        this.state.players[p.id] = p; // IMPORTANT: Add to local state immediately
        return p;
    } catch (e: any) {
        console.warn("Login timed out or failed. Switching to Offline Mode.", e);
        this.offlineMode = true;
        this.state.connected = false;
        const p = createOfflinePlayer();
        this.state.players[p.id] = p; // IMPORTANT: Add to local state
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
      } catch (e) {
        return 0; // Fail gracefully
      }
  }

  public async syncState(currentPlayerId: string | null): Promise<GameState> {
    if (this.offlineMode || !this.supabase) {
        return { ...this.state, connected: false };
    }

    try {
        // Process Passive Growth (Server RPC Trigger) - Fire and forget
        const now = Date.now();
        if (now - this.lastPassiveTick > 10000 && currentPlayerId) {
             this.supabase.rpc('passive_territory_growth', { player_id: currentPlayerId }).then(() => {});
             this.lastPassiveTick = now;
        }

        // Fetch Players
        const { data: playersData } = await this.supabase.from('players').select('*');

        const playersMap: Record<string, Player> = {};
        if (playersData) {
            playersData.forEach((p: any) => {
                let inv = p.inventory || {};
                if (typeof inv === 'string') {
                    try { inv = JSON.parse(inv); } catch (e) { inv = {}; }
                }

                playersMap[p.id] = {
                    id: p.id,
                    username: p.username,
                    color: p.color,
                    money: Number(p.money),
                    energy: Number(p.energy),
                    maxEnergy: 100,
                    lastSeen: p.last_seen,
                    inventory: inv
                };
            });
        }

        // Fetch Territories (Simplified View)
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

    } catch (e) {
        // Don't switch to offline immediately on sync fail, just mark disconnected temporarily
        console.warn("Sync glitch", e);
        this.state.connected = false;
    }

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
        try {
            // Only try to fetch if we have items
            const { data, error } = await this.supabase.from('territories').select('*').in('id', idsToFetch);
            
            if (error) throw error;

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
        } catch (e) {
            console.warn("Grid initialization failed (Network). Using Local fallback.", e);
            // Fallback: Generate local territories
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
    } else if (this.offlineMode) {
         // Generate in memory for offline
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
    if (this.offlineMode || !this.supabase) {
        // Offline simulation
        if (this.state.territories[territoryId]) {
            this.state.territories[territoryId].ownerId = playerId;
            this.state.territories[territoryId].strength = INITIAL_STRENGTH;
        }
        return;
    }

    try {
        await this.supabase.from('territories')
            .update({ owner_id: playerId, strength: INITIAL_STRENGTH })
            .eq('id', territoryId);
        
        const t = this.state.territories[territoryId];
        if (t) await this.generateNeighbors(t.lat, t.lng);
    } catch (e) {
        console.error("Capture failed:", e);
    }
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

  // --- Inventory & Items ---

  public async purchaseItem(playerId: string, itemId: string, cost: number): Promise<{success: boolean, message: string}> {
      // 1. Check Offline
      if (this.offlineMode || !this.supabase) {
           return this.offlinePurchase(playerId, itemId, cost);
      }
      
      let rpcFailed = false;

      // 2. Try RPC (Secure Server-side)
      try {
          const { data, error } = await this.supabase.rpc('purchase_item', {
              player_id: playerId,
              item_id: itemId,
              cost: cost
          });

          if (error) {
              console.warn("RPC Failed. Attempting Client-Side Fallback...", error);
              rpcFailed = true;
          } else {
              if (data === false) return { success: false, message: "Fundos insuficientes" };
              return { success: true, message: "Comprado" };
          }
      } catch (e) {
          console.warn("RPC Exception:", e);
          rpcFailed = true;
      }

      // 3. Fallback: Client-side Transaction
      if (rpcFailed) {
         try {
             // Fetch current state
             const { data: player, error: fetchError } = await this.supabase
                 .from('players')
                 .select('money, inventory')
                 .eq('id', playerId)
                 .single();
             
             if (fetchError || !player) throw new Error("Fetch player failed during fallback");

             const currentMoney = Number(player.money);
             if (currentMoney < cost) return { success: false, message: "Fundos insuficientes" };
             
             let currentInv = player.inventory || {};
             if (typeof currentInv === 'string') {
                 try { currentInv = JSON.parse(currentInv); } catch (e) { currentInv = {}; }
             }

             const currentCount = (currentInv[itemId] || 0);
             const newInventory = { ...currentInv, [itemId]: currentCount + 1 };

             const updates = {
                 money: currentMoney - cost,
                 inventory: newInventory
             };

             const { error: updateError } = await this.supabase
                 .from('players')
                 .update(updates)
                 .eq('id', playerId);

             if (updateError) throw updateError;
             
             return { success: true, message: "Comprado (Fallback)" };

         } catch (e) {
             console.error("Critical Purchase Failure:", e);
             return { success: false, message: "Erro de conexão" };
         }
      }

      return { success: false, message: "Erro desconhecido" };
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
          const p = this.state.players[playerId];
          if (p && p.inventory[itemId] > 0) {
              p.inventory[itemId]--;
              // Apply simple effects offline
              if (itemId === 'stimpack') p.energy = Math.min(p.energy + 50, 100);
              if (targetTerritoryId && this.state.territories[targetTerritoryId]) {
                   this.state.territories[targetTerritoryId].strength += 10;
              }
              return { success: true, message: "Item usado (Offline)" };
          }
          return { success: false, message: "Sem item" };
      }

      try {
        const { data, error } = await this.supabase.rpc('use_item', {
            player_id: playerId,
            item_id: itemId,
            target_territory_id: targetTerritoryId || null
        });

        if (error) throw error;
        return data;
      } catch (e) {
          console.error("Use Item Error:", e);
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
      } catch (e) {
          console.error("Chat Error", e);
      }
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
