export const WORLD_TOPO_JSON_URL = "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

export const COLORS = {
  NEUTRAL: "#334155", // slate-700
  PLAYER: "#0aff00",  // neon-green
  ENEMY: "#ff003c",   // neon-red
  ENEMY_2: "#00f3ff", // neon-blue
  ENEMY_3: "#eab308", // yellow-500
  SELECTED: "#ffffff",
  HOVER: "rgba(255, 255, 255, 0.2)",
};

export const INITIAL_STRENGTH = 10;
export const GROWTH_RATE_MS = 2000; // Territories gain strength every 2s
export const MAX_STRENGTH = 1000;

export const DB_CONFIG = {
  connectionString: "sqlitecloud://cahitlmmvk.g1.sqlite.cloud:8860/auth.sqlitecloud?apikey=t4RhYseJkrslILKbJELwkbeOiLEDIPJRByyRLRavpaU"
};