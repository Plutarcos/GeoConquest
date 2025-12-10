

import React, { memo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, Tooltip, useMap, Marker, Polyline } from 'react-leaflet';
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
  recenterTrigger: number;
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

  useEffect(() => {
    if (Math.abs(map.getZoom() - zoomLevel) > 0.1) {
      map.setZoom(zoomLevel);
    }
  }, [zoomLevel, map]);

  useEffect(() => {
    if (recenterTrigger !== prevTrigger.current) {
      map.flyTo([centerLat, centerLng], map.getZoom(), { duration: 1.5 });
      prevTrigger.current = recenterTrigger;
    }
  }, [recenterTrigger, centerLat, centerLng, map]);

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

// SVG Icons for different tiers
const ICONS = {
  // Simple Dot
  OUTPOST: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>`,
  // Shield
  FORT: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  // Castle/Rook
  BASE: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v10H4V10z"/><path d="M8 2v6"/><path d="M16 2v6"/><path d="M12 2v6"/></svg>`,
  // Target Reticle
  RETICLE: `<svg width="60" height="60" viewBox="0 0 100 100" class="selection-ring"><circle cx="50" cy="50" r="45" stroke="white" stroke-width="2" fill="none" stroke-dasharray="10 5" opacity="0.8"/><circle cx="50" cy="50" r="35" stroke="#00f3ff" stroke-width="1" fill="none" opacity="0.5"/><line x1="50" y1="5" x2="50" y2="20" stroke="white" stroke-width="2"/><line x1="50" y1="95" x2="50" y2="80" stroke="white" stroke-width="2"/><line x1="5" y1="50" x2="20" y2="50" stroke="white" stroke-width="2"/><line x1="95" y1="50" x2="80" y2="50" stroke="white" stroke-width="2"/></svg>`
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
           let fillOpacity = 0.2;
           let strokeColor = COLORS.STROKE;
           let weight = 1;
           let ownerName = "Neutro";
           let textColor = '#94a3b8'; // gray-400

           // State determination
           const isOwner = t.ownerId === currentPlayerId;
           const isSelected = selectedTerritoryId === t.id;
           
           if (t.ownerId) {
             fillOpacity = 0.4;
             const owner = players[t.ownerId];
             if (owner) {
                ownerName = owner.username;
                fillColor = isOwner ? COLORS.PLAYER : owner.color;
                textColor = isOwner ? '#0aff00' : owner.color;
             } else {
                 ownerName = "Desconhecido";
                 fillColor = COLORS.ENEMY;
                 textColor = COLORS.ENEMY;
             }
           }

           // Tier Logic
           let TierIcon = ICONS.OUTPOST;
           if (t.strength >= 20 && t.strength < 50) TierIcon = ICONS.FORT;
           if (t.strength >= 50) TierIcon = ICONS.BASE;

           if (isSelected) {
              strokeColor = '#ffffff';
              weight = 2;
              fillOpacity = 0.6;
           }

           return (
             <React.Fragment key={t.id}>
               {/* 1. The Base Rectangle */}
               <Rectangle
                 bounds={bounds as any}
                 pathOptions={{ 
                   color: strokeColor, 
                   weight, 
                   fillColor, 
                   fillOpacity,
                   className: 'territory-poly' 
                 }}
                 eventHandlers={{
                   click: () => onTerritoryClick(t.id),
                 }}
               />

               {/* 2. The Center Icon (Strength & Tier) */}
               <Marker
                 position={[t.lat, t.lng]}
                 eventHandlers={{ click: () => onTerritoryClick(t.id) }}
                 icon={L.divIcon({
                    className: 'floating-text-icon',
                    html: `<div class="tier-icon" style="color: ${textColor}">
                             ${TierIcon}
                             <span style="position: absolute; bottom: -12px; font-size: 9px; font-weight: bold; background: rgba(0,0,0,0.6); padding: 0 3px; border-radius: 4px; border: 1px solid ${strokeColor};">${t.strength}</span>
                           </div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                 })}
               >
                  <Tooltip 
                    direction="top" 
                    offset={[0, -10]}
                    opacity={0.9}
                    className="bg-panel-bg border border-gray-600 text-white font-mono text-xs z-[1000]"
                  >
                     <div className="text-center">
                        <div className="font-bold text-neon-blue">{t.name}</div>
                        <div className="text-[10px] text-gray-400">{ownerName}</div>
                     </div>
                  </Tooltip>
               </Marker>

               {/* 3. Selection Reticle (Overlay) */}
               {isSelected && (
                 <Marker
                    position={[t.lat, t.lng]}
                    icon={L.divIcon({
                        className: 'selection-reticle',
                        html: ICONS.RETICLE,
                        iconSize: [60, 60],
                        iconAnchor: [30, 30]
                    })}
                 />
               )}
             </React.Fragment>
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