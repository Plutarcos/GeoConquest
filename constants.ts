

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
  STROKE: "#0f172a"
};

export const INITIAL_STRENGTH = 10;
export const INITIAL_MONEY = 100;
export const INCOME_PER_TERRITORY = 5;
export const GROWTH_RATE_MS = 2000; 
export const MAX_STRENGTH = 5000;

// SQLite Cloud HTTP Configuration
export const DB_CONFIG = {
  host: "cahitlmmvk.g1.sqlite.cloud",
  // Port removed to default to HTTPS (443)
  username: "admin",
  password: "Labubu123@",
  apiKey: "t4RhYseJkrslILKbJELwkbeOiLEDIPJRByyRLRavpaU",
  database: "geoconquest.sqlite" // Nome do arquivo DB na nuvem
};

export const SQL_INIT_DB = `CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database};`;

export const SQL_INIT_TABLES = [
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, 
    username TEXT, 
    color TEXT, 
    money REAL, 
    last_seen INTEGER
  );`,
  `CREATE TABLE IF NOT EXISTS territories (
    id TEXT PRIMARY KEY, 
    owner_id TEXT, 
    strength INTEGER, 
    lat REAL, 
    lng REAL,
    name TEXT
  );`
];

export const SHOP_ITEMS = [
  { id: 'recruit', cost: 50, nameKey: 'recruit_troops', effect: 'strength_10', icon: 'UserPlus' },
  { id: 'fortify', cost: 100, nameKey: 'fortify_base', effect: 'defense_bonus', icon: 'Shield' },
  { id: 'sabotage', cost: 200, nameKey: 'sabotage_enemy', effect: 'enemy_weakness', icon: 'Skull' },
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
    fortify_base: "Fortificar Base",
    sabotage_enemy: "Sabotar Inimigo",
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
    offline: "Offline"
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
    fortify_base: "Fortify Base",
    sabotage_enemy: "Sabotage Enemy",
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
    offline: "Offline"
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
    fortify_base: "Fortificar Base",
    sabotage_enemy: "Sabotear Enemigo",
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
    offline: "Sin Conexión"
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
    fortify_base: "Basis befestigen",
    sabotage_enemy: "Feind sabotieren",
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
    offline: "Offline"
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
    fortify_base: "加固基地",
    sabotage_enemy: "破坏敌人",
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
    offline: "离线"
  }
};