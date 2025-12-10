

// Leaflet Tile Layer (Dark Matter)
export const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Grid Configuration
export const GRID_SIZE = 0.003; 

export const COLORS = {
  NEUTRAL: "#1e293b", // slate-800
  PLAYER: "#0aff00",  // neon-green
  ENEMY: "#ff003c",   // neon-red
  ENEMY_2: "#00f3ff", // neon-blue
  ENEMY_3: "#eab308", // yellow-500
  SELECTED: "#ffffff",
  HOVER: "rgba(255, 255, 255, 0.4)",
  WATER: "#050510",
  STROKE: "rgba(255,255,255,0.1)" 
};

export const INITIAL_STRENGTH = 10;
export const INITIAL_MONEY = 100;
export const INCOME_PER_TERRITORY = 5;
export const GROWTH_RATE_MS = 10000; // 10 seconds passive tick
export const MAX_STRENGTH = 5000;
export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 5; 
export const ENERGY_COST_ATTACK = 20;

// Supabase Configuration
export const SUPABASE_URL = "https://jushyrehjgudedaavzcg.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1c2h5cmVoamd1ZGVkYWF2emNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjYyODIsImV4cCI6MjA4MDkwMjI4Mn0.UIbSeC_hzydRHI5I-3rANjUj_MU1k9CDyE3opcEdxM8";

// SQL Commands Reference
export const SQL_INIT_COMMANDS = `
-- 1. Create Players Table
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    color TEXT NOT NULL,
    money NUMERIC DEFAULT 100,
    energy NUMERIC DEFAULT 100,
    inventory JSONB DEFAULT '{}'::jsonb,
    last_seen BIGINT
);

-- 2. Create Territories Table
CREATE TABLE IF NOT EXISTS territories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT REFERENCES players(id),
    strength INTEGER DEFAULT 10,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL
);

-- 3. Create Messages Table (NEW)
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Realtime
alter publication supabase_realtime add table territories;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table messages;

-- 5. Enable Public Access
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Players Access" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Territories Access" ON territories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Messages Access" ON messages FOR ALL USING (true) WITH CHECK (true);

-- 6. Helper Functions

-- Purchase Item (FIXED v2)
CREATE OR REPLACE FUNCTION purchase_item(
  player_id TEXT, 
  item_id TEXT, 
  cost NUMERIC
) 
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  current_money NUMERIC;
  current_inv JSONB;
  new_count INTEGER;
BEGIN
  SELECT money, COALESCE(inventory, '{}'::jsonb) INTO current_money, current_inv 
  FROM players WHERE id = player_id;
  
  IF current_money IS NULL OR current_money < cost THEN 
     RETURN FALSE;
  END IF;

  -- Update Money
  UPDATE players SET money = money - cost WHERE id = player_id;
  
  -- Calculate new count
  new_count := COALESCE((current_inv->>item_id)::INTEGER, 0) + 1;
  
  -- Update Inventory
  UPDATE players 
  SET inventory = jsonb_set(current_inv, ARRAY[item_id], to_jsonb(new_count))
  WHERE id = player_id;
  
  RETURN TRUE;
END;
$$;

-- Attack Territory
CREATE OR REPLACE FUNCTION attack_territory(
  attacker_id TEXT,
  source_id TEXT,
  target_id TEXT,
  energy_cost NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  att_strength INTEGER;
  def_strength INTEGER;
  attacker_energy NUMERIC;
  def_owner TEXT;
  def_territory_count INTEGER;
  defense_bonus INTEGER;
BEGIN
  SELECT strength, owner_id INTO att_strength, def_owner FROM territories WHERE id = source_id;
  SELECT strength, owner_id INTO def_strength, def_owner FROM territories WHERE id = target_id;
  SELECT energy INTO attacker_energy FROM players WHERE id = attacker_id;

  IF attacker_energy < energy_cost OR att_strength <= 1 THEN
     RETURN jsonb_build_object('success', false, 'message', 'Recursos insuficientes');
  END IF;

  UPDATE players SET energy = energy - energy_cost WHERE id = attacker_id;
  UPDATE territories SET strength = 1 WHERE id = source_id;

  defense_bonus := FLOOR(def_strength * 1.2);

  IF att_strength > defense_bonus THEN
     UPDATE territories SET strength = (att_strength - defense_bonus), owner_id = attacker_id WHERE id = target_id;
     
     IF def_owner IS NOT NULL THEN
        SELECT COUNT(*) INTO def_territory_count FROM territories WHERE owner_id = def_owner;
        IF def_territory_count = 0 THEN
           DELETE FROM players WHERE id = def_owner;
        END IF;
     END IF;

     RETURN jsonb_build_object('success', true, 'message', 'Conquistado');
  ELSE
     UPDATE territories SET strength = GREATEST(1, def_strength - FLOOR(att_strength * 0.8)) WHERE id = target_id;
     RETURN jsonb_build_object('success', false, 'message', 'Defesa resistiu (+20% Bônus)');
  END IF;
END;
$$;

-- Passive Growth
CREATE OR REPLACE FUNCTION passive_territory_growth(player_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  terr_count INTEGER;
  total_strength INTEGER;
  income_amount NUMERIC;
BEGIN
  UPDATE territories 
  SET strength = strength + 1 
  WHERE owner_id = player_id AND strength < 100;

  SELECT COUNT(*), COALESCE(SUM(strength), 0) 
  INTO terr_count, total_strength 
  FROM territories 
  WHERE owner_id = player_id;

  IF terr_count > 0 THEN
    income_amount := (terr_count * 5) + FLOOR(total_strength * 0.1);
    UPDATE players 
    SET money = money + income_amount, energy = LEAST(100, energy + 5)
    WHERE id = player_id;
  ELSE
    UPDATE players SET energy = LEAST(100, energy + 2) WHERE id = player_id;
  END IF;
END;
$$;

-- Use Item
CREATE OR REPLACE FUNCTION use_item(
  player_id TEXT,
  item_id TEXT,
  target_territory_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_inv JSONB;
  item_count INTEGER;
BEGIN
  SELECT inventory INTO current_inv FROM players WHERE id = player_id;
  item_count := COALESCE((current_inv->>item_id)::INTEGER, 0);

  IF item_count > 0 THEN
    IF item_id = 'stimpack' THEN
       UPDATE players SET energy = LEAST(100, energy + 50) WHERE id = player_id;
    ELSIF target_territory_id IS NOT NULL THEN
       IF item_id = 'recruit' THEN
          UPDATE territories SET strength = strength + 10 WHERE id = target_territory_id;
       ELSIF item_id = 'fortify' THEN
          UPDATE territories SET strength = strength + 20 WHERE id = target_territory_id;
       ELSIF item_id = 'bunker' THEN
          UPDATE territories SET strength = strength + 50 WHERE id = target_territory_id;
       ELSIF item_id = 'sabotage' THEN
          UPDATE territories SET strength = GREATEST(1, strength - 15) WHERE id = target_territory_id;
       ELSIF item_id = 'airstrike' THEN
          UPDATE territories SET strength = GREATEST(1, strength - 50) WHERE id = target_territory_id;
       END IF;
    END IF;

    UPDATE players 
    SET inventory = jsonb_set(inventory, ARRAY[item_id], to_jsonb(item_count - 1))
    WHERE id = player_id;

    RETURN jsonb_build_object('success', true, 'message', 'Item usado');
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Item não encontrado');
  END IF;
END;
$$;

-- Transfer Troops
CREATE OR REPLACE FUNCTION transfer_strength(
  player_id TEXT,
  source_id TEXT,
  target_id TEXT,
  amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  source_str INTEGER;
  source_owner TEXT;
BEGIN
  SELECT strength, owner_id INTO source_str, source_owner FROM territories WHERE id = source_id;
  
  IF source_owner != player_id OR source_str <= amount THEN
    RETURN FALSE;
  END IF;

  UPDATE territories SET strength = strength - amount WHERE id = source_id;
  UPDATE territories SET strength = strength + amount WHERE id = target_id;
  
  RETURN TRUE;
END;
$$;
`;

export const TRANSLATIONS = {
  'pt-BR': {
    territories: 'Territórios',
    strength: 'Força',
    active: 'Online',
    offline: 'Offline',
    transfer: 'Transferir',
    chat: 'Chat Global',
    shop: 'Loja',
    inventory: 'Mochila',
    logout: 'Sair',
    gameTitle: 'GEO CONQUEST',
    subTitle: 'Dominação Global Baseada em Localização',
    loginPrompt: 'Identificação do Agente',
    permadeathWarn: 'Aviso: Se todas as suas bases forem capturadas, sua conta será deletada permanentemente.',
    loginBtn: 'Conectar',
    guestLogin: 'Entrar como Convidado',
    selectBase: 'Estabelecer Base',
    selectBaseDesc: 'Selecione um setor vazio no mapa para iniciar suas operações.',
    scanning: 'Escaneando Localização...',
    startConquest: 'Iniciar Conquista',
    located: 'Localização Confirmada',
    error_occupied: 'Este setor já está ocupado!',
    error_adjacent: 'Alvo fora de alcance! Ataque apenas setores adjacentes.',
    select_target: 'Selecione um Alvo no Mapa',
    select_transfer: 'Selecione Destino para Transferência',
    money: 'Créditos',
    buy: 'COMPRAR',
    use: 'USAR',
    sendMessage: 'Enviar mensagem para todos...',
    item_recruit: 'Recrutar (+10)',
    item_fortify: 'Fortificar (+20)',
    item_bunker: 'Bunker (+50)',
    item_sabotage: 'Sabotar (-15)',
    item_airstrike: 'Ataque Aéreo (-50)',
    item_stimpack: 'Estimulante (+50 Energia)',
    cancel: 'Cancelar',
    targets_own: 'Use em: Seus Territórios',
    targets_enemy: 'Use em: Territórios Inimigos',
    targets_player: 'Uso Instantâneo',
    category_offense: 'Ataque',
    category_defense: 'Defesa',
    category_utility: 'Utilidade',
    tab_all: 'Todos'
  },
  'en': {
    territories: 'Territories',
    strength: 'Strength',
    active: 'Online',
    offline: 'Offline',
    transfer: 'Transfer',
    chat: 'Global Chat',
    shop: 'Shop',
    inventory: 'Inventory',
    logout: 'Logout',
    gameTitle: 'GEO CONQUEST',
    subTitle: 'Location Based Global Domination',
    loginPrompt: 'Agent Identification',
    permadeathWarn: 'Warning: If all your bases are captured, your account is permanently deleted.',
    loginBtn: 'Connect',
    guestLogin: 'Login as Guest',
    selectBase: 'Establish Base',
    selectBaseDesc: 'Select an empty sector on the map to start operations.',
    scanning: 'Scanning Location...',
    startConquest: 'Start Conquest',
    located: 'Location Confirmed',
    error_occupied: 'Sector already occupied!',
    error_adjacent: 'Target out of range! Attack adjacent sectors only.',
    select_target: 'Select Target on Map',
    select_transfer: 'Select Transfer Destination',
    money: 'Credits',
    buy: 'BUY',
    use: 'USE',
    sendMessage: 'Send message to all...',
    item_recruit: 'Recruit (+10)',
    item_fortify: 'Fortify (+20)',
    item_bunker: 'Bunker (+50)',
    item_sabotage: 'Sabotage (-15)',
    item_airstrike: 'Airstrike (-50)',
    item_stimpack: 'Stimpack (+50 Energy)',
    cancel: 'Cancel',
    targets_own: 'Target: Your Territories',
    targets_enemy: 'Target: Enemy Territories',
    targets_player: 'Instant Use',
    category_offense: 'Offense',
    category_defense: 'Defense',
    category_utility: 'Utility',
    tab_all: 'All'
  },
  'es': {
    territories: 'Territorios',
    strength: 'Fuerza',
    active: 'En Línea',
    offline: 'Desconectado',
    transfer: 'Transferir',
    chat: 'Chat Global',
    shop: 'Tienda',
    inventory: 'Inventario',
    logout: 'Salir',
    gameTitle: 'GEO CONQUEST',
    subTitle: 'Dominación Global Basada en Ubicación',
    loginPrompt: 'Identificación de Agente',
    permadeathWarn: 'Advertencia: Si capturan todas tus bases, tu cuenta será eliminada permanentemente.',
    loginBtn: 'Conectar',
    guestLogin: 'Entrar como Invitado',
    selectBase: 'Establecer Base',
    selectBaseDesc: 'Selecciona un sector vacío para iniciar operaciones.',
    scanning: 'Escaneando Ubicación...',
    startConquest: 'Iniciar Conquista',
    located: 'Ubicación Confirmada',
    error_occupied: '¡Sector ya ocupado!',
    error_adjacent: '¡Objetivo fuera de alcance! Ataca solo sectores adyacentes.',
    select_target: 'Selecciona Objetivo en Mapa',
    select_transfer: 'Selecciona Destino',
    money: 'Créditos',
    buy: 'COMPRAR',
    use: 'USAR',
    sendMessage: 'Enviar mensaje...',
    item_recruit: 'Reclutar (+10)',
    item_fortify: 'Fortificar (+20)',
    item_bunker: 'Bunker (+50)',
    item_sabotage: 'Sabotaje (-15)',
    item_airstrike: 'Ataque Aéreo (-50)',
    item_stimpack: 'Estimulante (+50 Energía)',
    cancel: 'Cancelar',
    targets_own: 'Objetivo: Tus Territorios',
    targets_enemy: 'Objetivo: Enemigos',
    targets_player: 'Uso Instantáneo',
    category_offense: 'Ataque',
    category_defense: 'Defensa',
    category_utility: 'Utilidad',
    tab_all: 'Todos'
  }
};

export const SHOP_ITEMS = [
  {
    id: 'recruit',
    nameKey: 'item_recruit',
    cost: 50,
    effect: '+10 Strength',
    icon: 'UserPlus',
    type: 'territory',
    category: 'defense'
  },
  {
    id: 'fortify',
    nameKey: 'item_fortify',
    cost: 100,
    effect: '+20 Strength',
    icon: 'Shield',
    type: 'territory',
    category: 'defense'
  },
  {
    id: 'stimpack',
    nameKey: 'item_stimpack',
    cost: 75,
    effect: '+50 Energy',
    icon: 'Zap',
    type: 'player',
    category: 'utility'
  },
  {
    id: 'sabotage',
    nameKey: 'item_sabotage',
    cost: 150,
    effect: '-15 Strength (Enemy)',
    icon: 'Skull',
    type: 'enemy',
    category: 'offense'
  },
  {
    id: 'bunker',
    nameKey: 'item_bunker',
    cost: 300,
    effect: '+50 Strength',
    icon: 'ShieldCheck',
    type: 'territory',
    category: 'defense'
  },
  {
    id: 'airstrike',
    nameKey: 'item_airstrike',
    cost: 500,
    effect: '-50 Strength (Enemy)',
    icon: 'Crosshair',
    type: 'enemy',
    category: 'offense'
  }
];
