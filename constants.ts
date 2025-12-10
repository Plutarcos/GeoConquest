

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
export const ENERGY_REGEN = 2; 
export const ENERGY_COST_ATTACK = 20;

// Supabase Configuration
export const SUPABASE_URL = "https://jushyrehjgudedaavzcg.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1c2h5cmVoamd1ZGVkYWF2emNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjYyODIsImV4cCI6MjA4MDkwMjI4Mn0.UIbSeC_hzydRHI5I-3rANjUj_MU1k9CDyE3opcEdxM8";

// SQL Commands Reference
export const SQL_INIT_COMMANDS = `
-- Run these in Supabase SQL Editor

-- 1. Add Inventory & Password Columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '{}'::jsonb;
ALTER TABLE players ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Purchase Item to Inventory Function
CREATE OR REPLACE FUNCTION purchase_item(
  player_id TEXT, 
  item_id TEXT, 
  cost NUMERIC
) 
RETURNS BOOLEAN 
LANGUAGE plpgsql 
AS $$
DECLARE
  current_money NUMERIC;
  current_inv JSONB;
  new_count INTEGER;
BEGIN
  SELECT money, inventory INTO current_money, current_inv FROM players WHERE id = player_id;
  
  IF current_money >= cost THEN
    -- Deduct Money
    UPDATE players SET money = money - cost WHERE id = player_id;
    
    -- Update Inventory
    new_count := COALESCE((current_inv->>item_id)::INTEGER, 0) + 1;
    UPDATE players 
    SET inventory = jsonb_set(COALESCE(inventory, '{}'::jsonb), ARRAY[item_id], to_jsonb(new_count))
    WHERE id = player_id;
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- 3. Use Item Function
CREATE OR REPLACE FUNCTION use_item(
  player_id TEXT,
  item_id TEXT,
  target_territory_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  current_inv JSONB;
  item_count INTEGER;
BEGIN
  SELECT inventory INTO current_inv FROM players WHERE id = player_id;
  item_count := COALESCE((current_inv->>item_id)::INTEGER, 0);

  IF item_count > 0 THEN
    -- Consumable Logic
    IF item_id = 'stimpack' THEN
       UPDATE players SET energy = LEAST(100, energy + 50) WHERE id = player_id;
    ELSIF target_territory_id IS NOT NULL THEN
       -- Territory Effects
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

    -- Decrement Inventory
    UPDATE players 
    SET inventory = jsonb_set(inventory, ARRAY[item_id], to_jsonb(item_count - 1))
    WHERE id = player_id;

    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Item not found');
  END IF;
END;
$$;

-- 4. Transfer Troops Function
CREATE OR REPLACE FUNCTION transfer_strength(
  player_id TEXT,
  source_id TEXT,
  target_id TEXT,
  amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  source_str INTEGER;
  source_owner TEXT;
BEGIN
  SELECT strength, owner_id INTO source_str, source_owner FROM territories WHERE id = source_id;
  
  IF source_owner != player_id OR source_str <= amount THEN
    RETURN FALSE;
  END IF;

  -- Move troops
  UPDATE territories SET strength = strength - amount WHERE id = source_id;
  UPDATE territories SET strength = strength + amount WHERE id = target_id;
  
  -- If target was empty/enemy and adjacent (logic handled in client for adjacency, but here for ownership update if needed)
  -- For now assumes friendly transfer or reinforcement. 
  -- If attacking via transfer, ownership change logic would be here, but let's keep transfer for logistics.
  UPDATE territories SET owner_id = player_id WHERE id = target_id AND owner_id IS NULL;

  RETURN TRUE;
END;
$$;
`;

export const SHOP_ITEMS = [
  { id: 'recruit', cost: 50, nameKey: 'recruit_troops', effect: '+10 Str', icon: 'UserPlus', type: 'territory' },
  { id: 'fortify', cost: 100, nameKey: 'fortify_base', effect: '+20 Str', icon: 'Shield', type: 'territory' },
  { id: 'bunker', cost: 250, nameKey: 'bunker_defense', effect: '+50 Str', icon: 'ShieldCheck', type: 'territory' },
  { id: 'stimpack', cost: 150, nameKey: 'stimpack', effect: '+50 Energy', icon: 'Zap', type: 'player' },
  { id: 'sabotage', cost: 200, nameKey: 'sabotage_enemy', effect: '-15 Enemy', icon: 'Skull', type: 'enemy' },
  { id: 'airstrike', cost: 500, nameKey: 'air_strike', effect: '-50 Enemy', icon: 'Crosshair', type: 'enemy' },
];

export const TRANSLATIONS = {
  'pt-BR': {
    gameTitle: "GEOCONQUISTA",
    subTitle: "Dominação de Bairros em Tempo Real",
    loginPrompt: "Insira seu Codinome",
    loginBtn: "INICIAR UPLINK",
    scanning: "Triangulando Posição...",
    selectBase: "SELECIONE BASE INICIAL",
    selectBaseDesc: "Sua localização real foi detectada. Inicie dominando o setor onde você está.",
    located: "Setor Identificado",
    startConquest: "INICIAR CONQUISTA",
    territories: "Setores",
    strength: "Força",
    money: "Créditos",
    shop: "Loja",
    inventory: "Mochila",
    use: "USAR",
    move: "Mover",
    transfer: "Transferir Tropas",
    cancel: "Cancelar",
    reset: "Resetar",
    logout: "Sair",
    recruit_troops: "Reforços (+10)",
    fortify_base: "Fortificar (+20)",
    bunker_defense: "Bunker (+50)",
    stimpack: "Stimpack (+50 En)",
    sabotage_enemy: "Sabotar (-15)",
    air_strike: "Ataque Aéreo (-50)",
    buy: "Comprar",
    close: "Fechar",
    active: "Conectado",
    chat: "Comunicação",
    sendMessage: "Enviar mensagem...",
    newMsg: "Nova Msg",
    permadeathWarn: "Atenção: Se perder todos os territórios, sua conta será deletada.",
    guestLogin: "Entrar como Convidado",
    error_occupied: "Setor Ocupado! Escolha outro para iniciar.",
    error_adjacent: "Alvo muito distante! Deve ser adjacente.",
    select_target: "Selecione um alvo no mapa",
    select_transfer: "Selecione destino da transferência",
    item_bought: "Item adicionado à mochila"
  },
  'en': {
    gameTitle: "GEOCONQUEST",
    subTitle: "Real-time Neighborhood Domination",
    loginPrompt: "Enter Codename",
    loginBtn: "INITIALIZE UPLINK",
    scanning: "Triangulating Position...",
    selectBase: "SELECT STARTING BASE",
    selectBaseDesc: "Your real location detected. Start by dominating your current sector.",
    located: "Sector Identified",
    startConquest: "START CONQUEST",
    territories: "Sectors",
    strength: "Strength",
    money: "Credits",
    shop: "Shop",
    inventory: "Inventory",
    use: "USE",
    move: "Move",
    transfer: "Transfer Troops",
    cancel: "Cancel",
    reset: "Reset",
    logout: "Logout",
    recruit_troops: "Reinforcements (+10)",
    fortify_base: "Fortify (+20)",
    bunker_defense: "Bunker (+50)",
    stimpack: "Stimpack (+50 En)",
    sabotage_enemy: "Sabotage (-15)",
    air_strike: "Air Strike (-50)",
    buy: "Buy",
    close: "Close",
    active: "Connected",
    chat: "Comms",
    sendMessage: "Send message...",
    newMsg: "New Msg",
    permadeathWarn: "Warning: If you lose all territories, account is deleted.",
    guestLogin: "Login as Guest",
    error_occupied: "Sector Occupied! Choose another to start.",
    error_adjacent: "Target too far! Must be adjacent.",
    select_target: "Select a target on the map",
    select_transfer: "Select transfer destination",
    item_bought: "Item added to inventory"
  },
  'es': {
    gameTitle: "GEOCONQUISTA",
    subTitle: "Dominación de Barrios",
    loginPrompt: "Ingrese Nombre en Clave",
    loginBtn: "INICIAR ENLACE",
    scanning: "Triangulando...",
    selectBase: "SELECCIONAR BASE INICIAL",
    selectBaseDesc: "Ubicación detectada. Domina tu sector actual.",
    located: "Sector Identificado",
    startConquest: "INICIAR CONQUISTA",
    territories: "Sectores",
    strength: "Fuerza",
    money: "Créditos",
    shop: "Tienda",
    inventory: "Inventario",
    use: "USAR",
    move: "Mover",
    transfer: "Transferir Tropas",
    cancel: "Cancelar",
    reset: "Reiniciar",
    logout: "Salir",
    recruit_troops: "Refuerzos (+10)",
    fortify_base: "Fortificar (+20)",
    bunker_defense: "Búnker (+50)",
    stimpack: "Stimpack (+50 En)",
    sabotage_enemy: "Sabotear (-15)",
    air_strike: "Ataque Aéreo (-50)",
    buy: "Comprar",
    close: "Cerrar",
    active: "Conectado",
    chat: "Coms",
    sendMessage: "Enviar mensaje...",
    newMsg: "Nuevo",
    permadeathWarn: "Aviso: Si pierdes todo, se borra la cuenta.",
    guestLogin: "Entrar como Invitado",
    error_occupied: "Sector Ocupado! Elige otro.",
    error_adjacent: "Objetivo lejano. Debe ser adyacente.",
    select_target: "Selecciona un objetivo",
    select_transfer: "Selecciona destino",
    item_bought: "Ítem añadido al inventario"
  },
  'de': {
    gameTitle: "GEOEROBERUNG",
    subTitle: "Nachbarschaftsherrschaft",
    loginPrompt: "Decknamen eingeben",
    loginBtn: "VERBINDUNG STARTEN",
    scanning: "Trianguliere...",
    selectBase: "STARTBASIS WÄHLEN",
    selectBaseDesc: "Standort erkannt. Erobert euren aktuellen Sektor.",
    located: "Sektor Identifiziert",
    startConquest: "EROBERUNG STARTEN",
    territories: "Sektoren",
    strength: "Stärke",
    money: "Credits",
    shop: "Laden",
    inventory: "Inventar",
    use: "BENUTZEN",
    move: "Bewegen",
    transfer: "Truppen verlegen",
    cancel: "Abbrechen",
    reset: "Zurücksetzen",
    logout: "Ausloggen",
    recruit_troops: "Verstärkung (+10)",
    fortify_base: "Befestigen (+20)",
    bunker_defense: "Bunker (+50)",
    stimpack: "Stimpack (+50 En)",
    sabotage_enemy: "Sabotage (-15)",
    air_strike: "Luftangriff (-50)",
    buy: "Kaufen",
    close: "Schließen",
    active: "Verbunden",
    chat: "Komm",
    sendMessage: "Nachricht senden...",
    newMsg: "Neu",
    permadeathWarn: "Warnung: Bei totalem Verlust wird das Konto gelöscht.",
    guestLogin: "Als Gast",
    error_occupied: "Sektor besetzt! Wähle einen anderen.",
    error_adjacent: "Zu weit! Muss benachbart sein.",
    select_target: "Ziel auf der Karte wählen",
    select_transfer: "Ziel wählen",
    item_bought: "Item zum Inventar hinzugefügt"
  },
  'zh': {
    gameTitle: "地缘征服",
    subTitle: "街区统治",
    loginPrompt: "输入代号",
    loginBtn: "启动连接",
    scanning: "定位中...",
    selectBase: "选择起始基地",
    selectBaseDesc: "已检测到位置。开始征服你当前的区域。",
    located: "区域已确认",
    startConquest: "开始征服",
    territories: "区域",
    strength: "兵力",
    money: "资金",
    shop: "商店",
    inventory: "库存",
    use: "使用",
    move: "移动",
    transfer: "转移部队",
    cancel: "取消",
    reset: "重置",
    logout: "登出",
    recruit_troops: "增援 (+10)",
    fortify_base: "加固 (+20)",
    bunker_defense: "地堡 (+50)",
    stimpack: "兴奋剂 (+50 En)",
    sabotage_enemy: "破坏 (-15)",
    air_strike: "空袭 (-50)",
    buy: "购买",
    close: "关闭",
    active: "已连接",
    chat: "通讯",
    sendMessage: "发送消息...",
    newMsg: "新消息",
    permadeathWarn: "警告：如果失去所有领土，账户将被删除。",
    guestLogin: "游客登录",
    error_occupied: "区域已被占领！请选择其他区域。",
    error_adjacent: "目标太远！必须相邻。",
    select_target: "在地图上选择目标",
    select_transfer: "选择转移目的地",
    item_bought: "物品已存入"
  }
};
