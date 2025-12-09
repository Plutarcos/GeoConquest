import React, { memo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, Tooltip, useMap, Marker } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { MAP_TILE_URL, MAP_ATTRIBUTION, COLORS, GRID_SIZE } from '../constants';
import { Territory, Player, VisualEffect } from '../types';

interface MapProps {
  centerLat: number;
  centerLng: number;
  zoomLevel: number;
  territories: Record<string, Territory>;
  players: Record<string, Player>;
  currentPlayerId: string | null;
  selectedTerritoryId: string | null;
  visualEffects: VisualEffect[];
  onTerritoryClick: (tId: string) => void;
  onZoomChange: (zoom: number) => void;
  recenterTrigger: number; // Increment to trigger recenter
}

// Controller to handle external props affecting the map instance
const MapController = ({ 
  centerLat, 
  centerLng, 
  zoomLevel, 
  onZoomChange,
  recenterTrigger
}: { 
  centerLat: number, 
  centerLng: number, 
  zoomLevel: number,
  onZoomChange: (z: number) => void,
  recenterTrigger: number
}) => {
  const map = useMap();
  const prevTrigger = useRef(recenterTrigger);

  // Handle Zoom prop changes
  useEffect(() => {
    if (Math.abs(map.getZoom() - zoomLevel) > 0.1) {
      map.setZoom(zoomLevel);
    }
  }, [zoomLevel, map]);

  // Handle Center/Trigger changes
  useEffect(() => {
    if (recenterTrigger !== prevTrigger.current) {
      map.flyTo([centerLat, centerLng], map.getZoom(), { duration: 1.5 });
      prevTrigger.current = recenterTrigger;
    }
  }, [recenterTrigger, centerLat, centerLng, map]);

  // Listen to map zoom events to update parent state
  useEffect(() => {
    const onZoom = () => {
      onZoomChange(map.getZoom());
    };
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map, onZoomChange]);

  return null;
};

const MapComponent: React.FC<MapProps> = ({ 
  centerLat,
  centerLng,
  zoomLevel,
  territories, 
  players, 
  currentPlayerId, 
  selectedTerritoryId,
  visualEffects,
  onTerritoryClick,
  onZoomChange,
  recenterTrigger
}) => {
  
  return (
    <div className="w-full h-full bg-dark-bg">
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={zoomLevel} 
        scrollWheelZoom={true} 
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution={MAP_ATTRIBUTION}
          url={MAP_TILE_URL}
        />
        
        <MapController 
          centerLat={centerLat} 
          centerLng={centerLng} 
          zoomLevel={zoomLevel}
          onZoomChange={onZoomChange}
          recenterTrigger={recenterTrigger}
        />

        {/* Territory Grid */}
        {Object.values(territories).map((t) => {
           const offset = GRID_SIZE / 2;
           const bounds: [number, number][] = [
             [t.lat - offset, t.lng - offset],
             [t.lat + offset, t.lng + offset]
           ];

           let fillColor = COLORS.NEUTRAL;
           let fillOpacity = 0.3;
           let strokeColor = COLORS.STROKE;
           let weight = 1;

           if (t.ownerId) {
             fillOpacity = 0.5;
             if (t.ownerId === currentPlayerId) {
               fillColor = COLORS.PLAYER;
             } else {
               const owner = players[t.ownerId];
               fillColor = owner ? owner.color : COLORS.ENEMY;
             }
           }

           const isSelected = selectedTerritoryId === t.id;
           if (isSelected) {
              strokeColor = '#ffffff';
              weight = 3;
              fillOpacity = 0.7;
           }

           return (
             <Rectangle
               key={t.id}
               bounds={bounds as any}
               pathOptions={{ 
                 color: strokeColor, 
                 weight, 
                 fillColor, 
                 fillOpacity,
                 className: isSelected ? 'animate-pulse-slow' : '' 
               }}
               eventHandlers={{
                 click: () => onTerritoryClick(t.id),
               }}
             >
               <Tooltip 
                  direction="center" 
                  permanent 
                  className={`bg-transparent border-none text-white font-bold shadow-none text-center ${isSelected ? 'text-lg' : 'text-xs'}`}
               >
                 <div className="drop-shadow-md" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                   {t.strength}
                 </div>
               </Tooltip>
             </Rectangle>
           );
        })}

        {/* Floating Combat Text Effects */}
        {visualEffects.map((effect) => (
          <Marker
            key={effect.id}
            position={[effect.lat, effect.lng]}
            icon={L.divIcon({
              className: 'floating-text-icon',
              html: `<div class="animate-float-up font-bold text-xl" style="color: ${
                effect.color === 'green' ? '#0aff00' : effect.color === 'red' ? '#ff003c' : '#ffffff'
              }; text-shadow: 0 0 5px black;">${effect.text}</div>`,
              iconSize: [100, 40],
              iconAnchor: [50, 20]
            })}
          />
        ))}

      </MapContainer>
    </div>
  );
};

export default memo(MapComponent);