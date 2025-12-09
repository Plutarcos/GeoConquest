export interface Player {
  id: string;
  username: string;
  color: string;
  money: number;
}

export interface Territory {
  id: string; // ISO 3 code or numeric ID from topojson
  name: string;
  ownerId: string | null;
  strength: number;
  path?: string; 
}

export interface GameState {
  territories: Record<string, Territory>;
  players: Record<string, Player>;
  currentPlayerId: string | null;
  selectedTerritoryId: string | null;
  lastUpdate: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  countryCode?: string; // ISO 3
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