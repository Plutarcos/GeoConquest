
// Leaflet Tile Layer (Dark Matter)
export const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Grid Configuration
// Approx 0.003 degrees is roughly 300-400 meters at equator (Neighborhood block size)
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
  STROKE: "rgba(255,255,255,0.1)" // More subtle stroke to let the glow handle borders
};

export const INITIAL_STRENGTH = 10;
export const INITIAL_MONEY = 100;
export const INCOME_PER_TERRITORY = 5;
export const GROWTH_RATE_MS = 2000; 
export const MAX_STRENGTH = 5000;
export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 2; // Per tick
export const ENERGY_COST_ATTACK = 20;

// Supabase Configuration
export const SUPABASE_URL = "https://jushyrehjgudedaavzcg.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1c2h5cmVoamd1ZGVkYWF2emNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjYyODIsImV4cCI6MjA4MDkwMjI4Mn0.UIbSeC_hzydRHI5I-3rANjUj_MU1k9CDyE3opcEdxM8";

// SQL Commands Reference (Run these in Supabase SQL Editor)
export const SQL_INIT_COMMANDS = `
-- 1. Enable PostGIS (Optional but recommended for future, not strictly used here yet)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    color TEXT NOT NULL,
    money NUMERIC DEFAULT 100,
    energy NUMERIC DEFAULT 100,
    last_seen BIGINT,
    password TEXT -- New column for auth
);

-- 3. Territories Table
CREATE TABLE IF NOT EXISTS territories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT REFERENCES players(id),
    strength INTEGER DEFAULT 10,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL
);

-- 4. Enable Realtime
alter publication supabase_realtime add table territories;
alter publication supabase_realtime add table players;

-- 5. Atomic Attack Function with Permadeath
CREATE OR REPLACE FUNCTION attack_territory(
  attacker_id TEXT,
  source_id TEXT,
  target_id TEXT,
  energy_cost NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  att_strength INTEGER;
  def_strength INTEGER;
  attacker_energy NUMERIC;
  def_owner TEXT;
  def_territory_count INTEGER;
BEGIN
  -- Verify Resources
  SELECT strength, owner_id INTO att_strength, def_owner FROM territories WHERE id = source_id;
  SELECT strength, owner_id INTO def_strength, def_owner FROM territories WHERE id = target_id;
  SELECT energy INTO attacker_energy FROM players WHERE id = attacker_id;

  IF attacker_energy < energy_cost OR att_strength <= 1 THEN
     RETURN jsonb_build_object('success', false, 'message', 'Recursos insuficientes');
  END IF;

  -- Consume Energy & Army
  UPDATE players SET energy = energy - energy_cost WHERE id = attacker_id;
  UPDATE territories SET strength = 1 WHERE id = source_id; 

  -- Battle Logic (RNG + Defense Bonus)
  -- Defender gets 10% bonus
  IF (att_strength * (0.8 + random()*0.4)) > (def_strength * 1.1) THEN
     -- Victory
     UPDATE territories SET strength = (att_strength - def_strength), owner_id = attacker_id WHERE id = target_id;
     
     -- Permadeath Check: If defender has no territories left, delete them
     IF def_owner IS NOT NULL AND def_owner != attacker_id THEN
        SELECT COUNT(*) INTO def_territory_count FROM territories WHERE owner_id = def_owner;
        IF def_territory_count = 0 THEN
           DELETE FROM players WHERE id = def_owner;
        END IF;
     END IF;

     RETURN jsonb_build_object('success', true, 'message', 'Conquistado');
  ELSE
     -- Defeat
     UPDATE territories SET strength = GREATEST(1, def_strength - (att_strength / 2)) WHERE id = target_id;
     RETURN jsonb_build_object('success', false, 'message', 'Defesa resistiu');
  END IF;
END;
$$;
`;

export const SHOP_ITEMS = [
  { id: 'recruit', cost: 50, nameKey: 'recruit_troops', effect: 'strength_10', icon: 'UserPlus' },
  { id: 'fortify', cost: 100, nameKey: 'fortify_base', effect: 'defense_bonus', icon: 'Shield' },
  { id: 'shield', cost: 300, nameKey: 'energy_shield', effect: 'defense_50', icon: 'ShieldCheck' },
  { id: 'sabotage', cost: 200, nameKey: 'sabotage_enemy', effect: 'enemy_weakness', icon: 'Skull' },
  { id: 'airstrike', cost: 500, nameKey: 'air_strike', effect: 'damage_50', icon: 'Zap' },
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
    reset: "Resetar",
    logout: "Sair",
    recruit_troops: "Recrutar Tropas (+10)",
    fortify_base: "Fortificar Base (+20)",
    energy_shield: "Escudo de Energia (+50)",
    sabotage_enemy: "Sabotar Inimigo (-15)",
    air_strike: "Ataque Aéreo (-50)",
    buy: "Comprar",
    close: "Fechar",
    commands: "Tático",
    cmd_select: "1. Selecione setor",
    cmd_attack: "2. Ataque vizinho",
    cmd_req: "Requer Força > Alvo",
    yours: "Seu",
    neutral: "Neutro",
    enemy: "Inimigo",
    live: "Rede Local",
    active: "Conectado",
    chat: "Comunicação",
    sendMessage: "Enviar mensagem...",
    newMsg: "Nova Msg",
    online: "Online",
    offline: "Offline",
    permadeathWarn: "Atenção: Se perder todos os territórios, sua conta será deletada.",
    passwordOpt: "Senha (Opcional)",
    guestLogin: "Entrar como Convidado",
    error_occupied: "Setor Ocupado! Escolha outro para iniciar.",
    error_adjacent: "Alvo muito distante! Deve ser adjacente."
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
    reset: "Reset",
    logout: "Logout",
    recruit_troops: "Recruit Troops (+10)",
    fortify_base: "Fortify Base (+20)",
    energy_shield: "Energy Shield (+50)",
    sabotage_enemy: "Sabotage Enemy (-15)",
    air_strike: "Air Strike (-50)",
    buy: "Buy",
    close: "Close",
    commands: "Tactical",
    cmd_select: "1. Select sector",
    cmd_attack: "2. Attack neighbor",
    cmd_req: "Requires Strength > Target",
    yours: "Yours",
    neutral: "Neutral",
    enemy: "Enemy",
    live: "Local Net",
    active: "Connected",
    chat: "Comms",
    sendMessage: "Send message...",
    newMsg: "New Msg",
    online: "Online",
    offline: "Offline",
    permadeathWarn: "Warning: If you lose all territories, account is deleted.",
    passwordOpt: "Password (Optional)",
    guestLogin: "Login as Guest",
    error_occupied: "Sector Occupied! Choose another to start.",
    error_adjacent: "Target too far! Must be adjacent."
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
    reset: "Reiniciar",
    logout: "Salir",
    recruit_troops: "Reclutar Tropas (+10)",
    fortify_base: "Fortificar Base (+20)",
    energy_shield: "Escudo de Energía (+50)",
    sabotage_enemy: "Sabotear Enemigo (-15)",
    air_strike: "Ataque Aéreo (-50)",
    buy: "Comprar",
    close: "Cerrar",
    commands: "Táctica",
    cmd_select: "1. Selecciona sector",
    cmd_attack: "2. Ataca vecino",
    cmd_req: "Requiere Fuerza > Objetivo",
    yours: "Tuyo",
    neutral: "Neutral",
    enemy: "Enemigo",
    live: "Red Local",
    active: "Conectado",
    chat: "Coms",
    sendMessage: "Enviar mensaje...",
    newMsg: "Nuevo",
    online: "En Línea",
    offline: "Sin Conexión",
    permadeathWarn: "Aviso: Si pierdes todo, se borra la cuenta.",
    passwordOpt: "Contraseña (Opcional)",
    guestLogin: "Entrar como Invitado",
    error_occupied: "Sector Ocupado! Elige otro.",
    error_adjacent: "Objetivo lejano. Debe ser adyacente."
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
    reset: "Zurücksetzen",
    logout: "Ausloggen",
    recruit_troops: "Truppen rekrutieren (+10)",
    fortify_base: "Basis befestigen (+20)",
    energy_shield: "Energieschild (+50)",
    sabotage_enemy: "Feind sabotieren (-15)",
    air_strike: "Luftangriff (-50)",
    buy: "Kaufen",
    close: "Schließen",
    commands: "Taktik",
    cmd_select: "1. Sektor wählen",
    cmd_attack: "2. Nachbar angreifen",
    cmd_req: "Benötigt Stärke > Ziel",
    yours: "Deins",
    neutral: "Neutral",
    enemy: "Feind",
    live: "Lokalnetz",
    active: "Verbunden",
    chat: "Komm",
    sendMessage: "Nachricht senden...",
    newMsg: "Neu",
    online: "Online",
    offline: "Offline",
    permadeathWarn: "Warnung: Bei totalem Verlust wird das Konto gelöscht.",
    passwordOpt: "Passwort (Optional)",
    guestLogin: "Als Gast",
    error_occupied: "Sektor besetzt! Wähle einen anderen.",
    error_adjacent: "Zu weit! Muss benachbart sein."
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
    reset: "重置",
    logout: "登出",
    recruit_troops: "招募军队 (+10)",
    fortify_base: "加固基地 (+20)",
    energy_shield: "能量护盾 (+50)",
    sabotage_enemy: "破坏敌人 (-15)",
    air_strike: "空袭 (-50)",
    buy: "购买",
    close: "关闭",
    commands: "战术",
    cmd_select: "1. 选择区域",
    cmd_attack: "2. 攻击邻近",
    cmd_req: "需要 兵力 > 目标",
    yours: "你的",
    neutral: "中立",
    enemy: "敌人",
    live: "本地网络",
    active: "已连接",
    chat: "通讯",
    sendMessage: "发送消息...",
    newMsg: "新消息",
    online: "在线",
    offline: "离线",
    permadeathWarn: "警告：如果失去所有领土，账户将被删除。",
    passwordOpt: "密码 (可选)",
    guestLogin: "游客登录",
    error_occupied: "区域已被占领！请选择其他区域。",
    error_adjacent: "目标太远！必须相邻。"
  }
};
