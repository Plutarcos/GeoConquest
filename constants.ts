

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
  STROKE: "rgba(255,255,255,0.2)" 
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

// SQL Commands are Reference only - handled in dbService or Supabase directly

export const TRANSLATIONS = {
  'pt-BR': {
    territories: 'Setores',
    strength: 'Poder Militar',
    active: 'Link Ativo',
    offline: 'Sinal Perdido',
    transfer: 'Mover Tropas',
    chat: 'Rede Global',
    shop: 'Mercado Negro',
    inventory: 'Arsenal',
    logout: 'Abortar Missão',
    gameTitle: 'GEO:CONQUEST',
    subTitle: 'Guerra Cibernética Territorial',
    loginPrompt: 'Credenciais de Agente',
    permadeathWarn: 'MORTE PERMANENTE: Se perder todas as bases, seus dados serão apagados do servidor.',
    loginBtn: 'Inicializar Uplink',
    guestLogin: 'Acesso Fantasma',
    selectBase: 'Implantar Base',
    selectBaseDesc: 'Escolha um setor neutro para iniciar sua operação de dominação.',
    scanning: 'Triangulando Posição GPS...',
    startConquest: 'INICIAR DOMINAÇÃO',
    located: 'Alvo Localizado',
    error_occupied: 'ERRO: Setor Hostil! Escolha um local vazio.',
    error_adjacent: 'ERRO: Alcance Insuficiente. Ataque apenas setores vizinhos.',
    select_target: 'Selecione o Alvo no Radar',
    select_transfer: 'Selecione Destino do Reforço',
    money: 'BitCredits',
    buy: 'ADQUIRIR',
    use: 'ATIVAR',
    sendMessage: 'Transmitir mensagem criptografada...',
    item_recruit: 'Mercenários (+10 Força)',
    desc_recruit: 'Contrata um esquadrão rápido para reforçar um território aliado instantaneamente.',
    item_fortify: 'Muralha Digital (+20 Força)',
    desc_fortify: 'Instala firewalls físicos e torres de defesa. Aumenta significativamente a defesa de um setor.',
    item_bunker: 'Bunker Nuclear (+50 Força)',
    desc_bunker: 'A defesa suprema. Transforma um setor em uma fortaleza impenetrável.',
    item_sabotage: 'Vírus Lógico (-15 Inimigo)',
    desc_sabotage: 'Infecta a infraestrutura de um vizinho inimigo, reduzindo suas defesas sem gastar sua energia.',
    item_airstrike: 'Ataque Orbital (-50 Inimigo)',
    desc_airstrike: 'Dispara um laser de satélite que devasta as defesas inimigas. Use para quebrar fortificações pesadas.',
    item_stimpack: 'Overclock Neural (+50 Energia)',
    desc_stimpack: 'Injeta adrenalina no sistema. Recupera energia instantaneamente para continuar atacando.',
    cancel: 'Abortar',
    targets_own: 'ALVO: SEUS SETORES',
    targets_enemy: 'ALVO: INIMIGOS',
    targets_player: 'ALVO: VOCÊ',
    category_offense: 'Ofensivo',
    category_defense: 'Defensivo',
    category_utility: 'Suporte',
    tab_all: 'Todos',
    insufficient_funds: 'Créditos Insuficientes'
  },
  'en': {
    territories: 'Sectors',
    strength: 'Military Power',
    active: 'Uplink Active',
    offline: 'Signal Lost',
    transfer: 'Move Troops',
    chat: 'Global Net',
    shop: 'Black Market',
    inventory: 'Arsenal',
    logout: 'Abort Mission',
    gameTitle: 'GEO:CONQUEST',
    subTitle: 'Location Based Cyber Warfare',
    loginPrompt: 'Agent Credentials',
    permadeathWarn: 'PERMADEATH: If all bases are lost, your data is wiped from the server.',
    loginBtn: 'Initialize Uplink',
    guestLogin: 'Ghost Access',
    selectBase: 'Deploy Base',
    selectBaseDesc: 'Choose a neutral sector to begin your domination operation.',
    scanning: 'Triangulating GPS Position...',
    startConquest: 'INITIATE DOMINATION',
    located: 'Target Locked',
    error_occupied: 'ERROR: Hostile Sector! Choose an empty location.',
    error_adjacent: 'ERROR: Out of Range. Attack adjacent sectors only.',
    select_target: 'Select Target on Radar',
    select_transfer: 'Select Reinforcement Target',
    money: 'BitCredits',
    buy: 'ACQUIRE',
    use: 'ACTIVATE',
    sendMessage: 'Broadcast encrypted message...',
    item_recruit: 'Mercenaries (+10 STR)',
    desc_recruit: 'Hires a quick squad to reinforce an allied territory instantly.',
    item_fortify: 'Digital Wall (+20 STR)',
    desc_fortify: 'Installs physical firewalls and turrets. Significantly boosts sector defense.',
    item_bunker: 'Nuclear Bunker (+50 STR)',
    desc_bunker: 'The ultimate defense. Turns a sector into an impenetrable fortress.',
    item_sabotage: 'Logic Virus (-15 Enemy)',
    desc_sabotage: 'Infects an enemy neighbor infrastructure, reducing defenses without spending energy.',
    item_airstrike: 'Orbital Strike (-50 Enemy)',
    desc_airstrike: 'Fires a satellite laser that devastates enemy defenses. Use to break heavy fortifications.',
    item_stimpack: 'Neural Overclock (+50 Energy)',
    desc_stimpack: 'Injects system adrenaline. Instantly recovers energy to keep attacking.',
    cancel: 'Abort',
    targets_own: 'TARGET: YOUR SECTORS',
    targets_enemy: 'TARGET: ENEMIES',
    targets_player: 'TARGET: SELF',
    category_offense: 'Offense',
    category_defense: 'Defense',
    category_utility: 'Utility',
    tab_all: 'All',
    insufficient_funds: 'Insufficient Credits'
  },
  'es': {
    territories: 'Sectores',
    strength: 'Poder Militar',
    active: 'Enlace Activo',
    offline: 'Señal Perdida',
    transfer: 'Mover Tropas',
    chat: 'Red Global',
    shop: 'Mercado Negro',
    inventory: 'Arsenal',
    logout: 'Abortar Misión',
    gameTitle: 'GEO:CONQUEST',
    subTitle: 'Guerra Cibernética Territorial',
    loginPrompt: 'Credenciales de Agente',
    permadeathWarn: 'MUERTE PERMANENTE: Si pierdes todas las bases, tus datos se borran.',
    loginBtn: 'Iniciar Enlace',
    guestLogin: 'Acceso Fantasma',
    selectBase: 'Desplegar Base',
    selectBaseDesc: 'Elige un sector neutral para iniciar la operación.',
    scanning: 'Triangulando GPS...',
    startConquest: 'INICIAR DOMINACIÓN',
    located: 'Objetivo Localizado',
    error_occupied: '¡ERROR: Sector Hostil! Elige uno vacío.',
    error_adjacent: 'ERROR: Fuera de alcance. Ataca solo sectores adyacentes.',
    select_target: 'Selecciona Objetivo en Radar',
    select_transfer: 'Selecciona Destino',
    money: 'BitCredits',
    buy: 'ADQUIRIR',
    use: 'ACTIVAR',
    sendMessage: 'Transmitir mensaje encriptado...',
    item_recruit: 'Mercenarios (+10 FUERZA)',
    desc_recruit: 'Contrata un escuadrón rápido para reforzar un territorio aliado.',
    item_fortify: 'Muro Digital (+20 FUERZA)',
    desc_fortify: 'Instala firewalls y torretas. Aumenta significativamente la defensa.',
    item_bunker: 'Bunker Nuclear (+50 FUERZA)',
    desc_bunker: 'La defensa definitiva. Convierte un sector en una fortaleza.',
    item_sabotage: 'Virus Lógico (-15 Enemigo)',
    desc_sabotage: 'Infecta la infraestructura enemiga, reduciendo defensas sin gastar energía.',
    item_airstrike: 'Ataque Orbital (-50 Enemigo)',
    desc_airstrike: 'Dispara un láser satelital que devasta defensas enemigas.',
    item_stimpack: 'Overclock Neural (+50 Energía)',
    desc_stimpack: 'Recupera energía instantáneamente para seguir atacando.',
    cancel: 'Abortar',
    targets_own: 'OBJETIVO: TUS SECTORES',
    targets_enemy: 'OBJETIVO: ENEMIGOS',
    targets_player: 'OBJETIVO: TÚ MISMO',
    category_offense: 'Ofensiva',
    category_defense: 'Defensiva',
    category_utility: 'Utilidad',
    tab_all: 'Todos',
    insufficient_funds: 'Créditos Insuficientes'
  }
};

export const SHOP_ITEMS = [
  {
    id: 'recruit',
    nameKey: 'item_recruit',
    descKey: 'desc_recruit',
    cost: 50,
    effect: '+10 STR',
    icon: 'UserPlus',
    type: 'territory',
    category: 'defense'
  },
  {
    id: 'fortify',
    nameKey: 'item_fortify',
    descKey: 'desc_fortify',
    cost: 100,
    effect: '+20 STR',
    icon: 'Shield',
    type: 'territory',
    category: 'defense'
  },
  {
    id: 'stimpack',
    nameKey: 'item_stimpack',
    descKey: 'desc_stimpack',
    cost: 75,
    effect: '+50 ENERGY',
    icon: 'Zap',
    type: 'player',
    category: 'utility'
  },
  {
    id: 'sabotage',
    nameKey: 'item_sabotage',
    descKey: 'desc_sabotage',
    cost: 150,
    effect: '-15 ENEMY',
    icon: 'Skull',
    type: 'enemy',
    category: 'offense'
  },
  {
    id: 'bunker',
    nameKey: 'item_bunker',
    descKey: 'desc_bunker',
    cost: 300,
    effect: '+50 STR',
    icon: 'ShieldCheck',
    type: 'territory',
    category: 'defense'
  },
  {
    id: 'airstrike',
    nameKey: 'item_airstrike',
    descKey: 'desc_airstrike',
    cost: 500,
    effect: '-50 ENEMY',
    icon: 'Crosshair',
    type: 'enemy',
    category: 'offense'
  }
];
