export interface Player {
  id: string;
  username: string;
  color: string;
}

export interface Territory {
  id: string; // ISO 3 code
  name: string;
  ownerId: string | null;
  strength: number;
  // Dynamic properties for rendering
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
  countryCode?: string; // ISO 2 or 3
}

export enum GameStatus {
  LOGIN = 'LOGIN',
  LOCATING = 'LOCATING',
  PLAYING = 'PLAYING',
}