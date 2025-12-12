

import React, { memo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, Tooltip, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
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
      // Force high zoom on recenter for "tactical" feel
      const targetZoom = Math.max(map.getZoom(), 17);
      map.flyTo([centerLat, centerLng], targetZoom, { duration: 2.0, easeLinearity: 0.5 });
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
  FORT: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px currentColor);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  // Castle/Rook
  BASE: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 6px currentColor);"><path d="M4 10c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v10H4V10z"/><path d="M8 2v6"/><path d="M16 2v6"/><path d="M12 2v6"/></svg>`,
  // Target Reticle
  RETICLE: `<svg width="80" height="80" viewBox="0 0 100 100" class="selection-ring"><circle cx="50" cy="50" r="45" stroke="white" stroke-width="2" fill="none" stroke-dasharray="2 10" opacity="0.8"/><circle cx="50" cy="50" r="35" stroke="#00f3ff" stroke-width="2" fill="none" opacity="0.9"/><path d="M50 0 L50 15 M50 100 L50 85 M0 50 L15 50 M100 50 L85 50" stroke="#00f3ff" stroke-width="3" /></svg>`
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
           const offset = GRID_SIZE / 2 * 0.95; // Small gap between squares
           const bounds: [number, number][] = [
             [t.lat - offset, t.lng - offset],
             [t.lat + offset, t.lng + offset]
           ];

           let fillColor = COLORS.NEUTRAL;
           let fillOpacity = 0.15;
           let strokeColor = COLORS.STROKE;
           let weight = 1;
           let ownerName = "Neutro";
           let textColor = '#64748b'; // slate-500
           let className = 'territory-poly';

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
                
                // Add pulse effect for owned territories
                if (isOwner) className += ' territory-owned';
             } else {
                 ownerName = "Unknown Signal";
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
              weight = 3;
              fillOpacity = 0.6;
              className += ' z-[500]';
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
                   className: className
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
                    html: `<div class="tier-icon transition-transform duration-300 hover:scale-125" style="color: ${textColor}">
                             ${TierIcon}
                             <span style="position: absolute; bottom: -14px; font-size: 10px; font-weight: 900; background: rgba(0,0,0,0.8); padding: 1px 4px; border-radius: 4px; border: 1px solid ${strokeColor}; font-family: monospace;">${t.strength}</span>
                           </div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                 })}
               >
                  <Tooltip 
                    direction="top" 
                    offset={[0, -20]}
                    opacity={1}
                    className="bg-transparent border-none shadow-none"
                  >
                     <div className="bg-panel-bg border border-neon-blue/50 text-white p-2 rounded-lg backdrop-blur-md shadow-xl text-center min-w-[120px]">
                        <div className="font-bold text-neon-blue uppercase tracking-widest text-xs border-b border-gray-700 pb-1 mb-1">{t.name}</div>
                        <div className="text-[10px] text-gray-300 font-mono">{ownerName}</div>
                        <div className="text-[10px] text-gray-400 mt-1">STR: {t.strength} | GPS: {t.lat.toFixed(3)}, {t.lng.toFixed(3)}</div>
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
                        iconSize: [80, 80],
                        iconAnchor: [40, 40]
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
              html: `<div class="animate-float-up font-black text-2xl" style="
                  color: ${effect.color === 'green' ? '#0aff00' : effect.color === 'red' ? '#ff003c' : '#ffffff'}; 
                  text-shadow: 0 0 10px ${effect.color === 'green' ? 'rgba(10,255,0,0.8)' : effect.color === 'red' ? 'rgba(255,0,60,0.8)' : 'rgba(255,255,255,0.8)'};
                  white-space: nowrap;
                ">${effect.text}</div>`,
              iconSize: [120, 50],
              iconAnchor: [60, 25]
            })}
          />
        ))}

      </MapContainer>
    </div>
  );
};

export default memo(MapComponent);
