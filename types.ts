export interface Player {
  id: string;
  username: string;
  color: string;
  money: number;
  lastSeen?: number; // Timestamp for online status
}

export interface Territory {
  id: string; // Coordinate string "lat_lng"
  name: string; // Generated name like "Sector A-1"
  ownerId: string | null;
  strength: number;
  lat: number;
  lng: number;
}

export interface GameState {
  territories: Record<string, Territory>;
  players: Record<string, Player>;
  currentPlayerId: string | null;
  selectedTerritoryId: string | null;
  lastUpdate: number;
  centerLat: number;
  centerLng: number;
  connected: boolean; // Connection status to Cloud DB
}

export interface GeoLocation {
  lat: number;
  lng: number;
  countryCode?: string | null;
}

export enum GameStatus {
  LOGIN = 'LOGIN',
  SETUP = 'SETUP',
  LOCATING = 'LOCATING',
  PLAYING = 'PLAYING',
}

export type Language = 'pt-BR' | 'en' | 'es' | 'de' | 'zh';

export interface ShopItem {
  id: string;
  nameKey: string;
  cost: number;
  effect: string;
  icon: string;
}

export interface VisualEffect {
  id: number;
  lat: number;
  lng: number;
  text: string;
  color: string; // 'red', 'green', 'white'
  type: 'damage' | 'heal' | 'info';
}