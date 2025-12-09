export const WORLD_TOPO_JSON_URL = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

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

export const DB_CONFIG = {
  connectionString: "sqlitecloud://cahitlmmvk.g1.sqlite.cloud:8860/auth.sqlitecloud?apikey=t4RhYseJkrslILKbJELwkbeOiLEDIPJRByyRLRavpaU"
};

export const SHOP_ITEMS = [
  { id: 'recruit', cost: 50, nameKey: 'recruit_troops', effect: 'strength_10', icon: 'UserPlus' },
  { id: 'fortify', cost: 100, nameKey: 'fortify_base', effect: 'defense_bonus', icon: 'Shield' },
  { id: 'sabotage', cost: 200, nameKey: 'sabotage_enemy', effect: 'enemy_weakness', icon: 'Skull' },
];

export const TRANSLATIONS = {
  'pt-BR': {
    gameTitle: "GEOCONQUISTA",
    subTitle: "Dominação Mundial em Tempo Real",
    loginPrompt: "Insira seu Codinome",
    loginBtn: "INICIAR UPLINK",
    scanning: "Escaneando Satélite...",
    selectBase: "SELECIONE BASE INICIAL",
    selectBaseDesc: "Selecione um território no mapa para iniciar sua conquista.",
    located: "Localizado",
    startConquest: "INICIAR CONQUISTA",
    territories: "Territórios",
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
    commands: "Comandos",
    cmd_select: "1. Selecione seu território",
    cmd_attack: "2. Clique no vizinho para atacar",
    cmd_req: "Requer Força > Alvo",
    yours: "Seu",
    neutral: "Neutro",
    enemy: "Inimigo",
    live: "Conexão Multiplayer",
    active: "Ativa (Simulado)"
  },
  'en': {
    gameTitle: "GEOCONQUEST",
    subTitle: "Real-time World Domination",
    loginPrompt: "Enter Codename",
    loginBtn: "INITIALIZE UPLINK",
    scanning: "Scanning Satellite...",
    selectBase: "SELECT STARTING BASE",
    selectBaseDesc: "Select a territory on the map to begin your conquest.",
    located: "Located",
    startConquest: "START CONQUEST",
    territories: "Territories",
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
    commands: "Commands",
    cmd_select: "1. Select your territory",
    cmd_attack: "2. Click neighbor to attack",
    cmd_req: "Requires Strength > Target",
    yours: "Yours",
    neutral: "Neutral",
    enemy: "Enemy",
    live: "Multiplayer Connection",
    active: "Active (Simulated)"
  },
  'es': {
    gameTitle: "GEOCONQUISTA",
    subTitle: "Dominación Mundial en Tiempo Real",
    loginPrompt: "Ingrese Nombre en Clave",
    loginBtn: "INICIAR ENLACE",
    scanning: "Escaneando Satélite...",
    selectBase: "SELECCIONAR BASE INICIAL",
    selectBaseDesc: "Selecciona un territorio en el mapa para comenzar.",
    located: "Localizado",
    startConquest: "INICIAR CONQUISTA",
    territories: "Territorios",
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
    commands: "Comandos",
    cmd_select: "1. Selecciona tu territorio",
    cmd_attack: "2. Clic vecino para atacar",
    cmd_req: "Requiere Fuerza > Objetivo",
    yours: "Tuyo",
    neutral: "Neutral",
    enemy: "Enemigo",
    live: "Conexión Multijugador",
    active: "Activa (Simulada)"
  },
  'de': {
    gameTitle: "GEOEROBERUNG",
    subTitle: "Echtzeit-Weltherrschaft",
    loginPrompt: "Decknamen eingeben",
    loginBtn: "VERBINDUNG STARTEN",
    scanning: "Satellitenscan...",
    selectBase: "STARTBASIS WÄHLEN",
    selectBaseDesc: "Wähle ein Gebiet auf der Karte, um zu beginnen.",
    located: "Lokalisiert",
    startConquest: "EROBERUNG STARTEN",
    territories: "Gebiete",
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
    commands: "Befehle",
    cmd_select: "1. Dein Gebiet wählen",
    cmd_attack: "2. Nachbar anklicken zum Angreifen",
    cmd_req: "Benötigt Stärke > Ziel",
    yours: "Deins",
    neutral: "Neutral",
    enemy: "Feind",
    live: "Multiplayer-Verbindung",
    active: "Aktiv (Simuliert)"
  },
  'zh': {
    gameTitle: "地缘征服",
    subTitle: "实时统治世界",
    loginPrompt: "输入代号",
    loginBtn: "启动连接",
    scanning: "扫描卫星...",
    selectBase: "选择起始基地",
    selectBaseDesc: "在地图上选择一个领土开始征服。",
    located: "已定位",
    startConquest: "开始征服",
    territories: "领土",
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
    commands: "指令",
    cmd_select: "1. 选择你的领土",
    cmd_attack: "2. 点击邻国攻击",
    cmd_req: "需要 兵力 > 目标",
    yours: "你的",
    neutral: "中立",
    enemy: "敌人",
    live: "多人连接",
    active: "活跃 (模拟)"
  }
};