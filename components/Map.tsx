import React, { memo } from 'react';
import { MapContainer, TileLayer, Rectangle, Tooltip, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { MAP_TILE_URL, MAP_ATTRIBUTION, COLORS, GRID_SIZE } from '../constants';
import { Territory, Player } from '../types';

interface MapProps {
  centerLat: number;
  centerLng: number;
  territories: Record<string, Territory>;
  players: Record<string, Player>;
  currentPlayerId: string | null;
  selectedTerritoryId: string | null;
  onTerritoryClick: (tId: string) => void;
}

// Helper to update view when center changes
const MapRecenter = ({ lat, lng }: { lat: number, lng: number }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo([lat, lng], 16); // Zoom level 16 is good for street blocks
  }, [lat, lng, map]);
  return null;
};

const MapComponent: React.FC<MapProps> = ({ 
  centerLat,
  centerLng,
  territories, 
  players, 
  currentPlayerId, 
  selectedTerritoryId,
  onTerritoryClick
}) => {
  
  return (
    <div className="w-full h-full bg-dark-bg">
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={16} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution={MAP_ATTRIBUTION}
          url={MAP_TILE_URL}
        />
        
        <MapRecenter lat={centerLat} lng={centerLng} />

        {Object.values(territories).map((t) => {
           // Calculate rectangle bounds based on center lat/lng and Grid Size
           // We subtract/add half the grid size to center the rectangle
           const offset = GRID_SIZE / 2;
           const bounds: [number, number][] = [
             [t.lat - offset, t.lng - offset],
             [t.lat + offset, t.lng + offset]
           ];

           let fillColor = COLORS.NEUTRAL;
           let fillOpacity = 0.4;
           let strokeColor = COLORS.STROKE;

           if (t.ownerId) {
             fillOpacity = 0.6;
             if (t.ownerId === currentPlayerId) {
               fillColor = COLORS.PLAYER;
             } else {
               const owner = players[t.ownerId];
               fillColor = owner ? owner.color : COLORS.ENEMY;
             }
           }

           if (selectedTerritoryId === t.id) {
              strokeColor = COLORS.SELECTED;
              fillOpacity = 0.8;
           }

           return (
             <Rectangle
               key={t.id}
               bounds={bounds as any}
               pathOptions={{ color: strokeColor, weight: selectedTerritoryId === t.id ? 3 : 1, fillColor, fillOpacity }}
               eventHandlers={{
                 click: () => onTerritoryClick(t.id),
               }}
             >
               <Tooltip direction="center" permanent className="bg-transparent border-none text-white font-bold shadow-none text-center">
                 <div className="text-xs drop-shadow-md">
                   {t.strength}
                 </div>
               </Tooltip>
             </Rectangle>
           );
        })}
      </MapContainer>
    </div>
  );
};

export default memo(MapComponent);