import React, { memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Graticule,
  Sphere
} from "react-simple-maps";
import { WORLD_TOPO_JSON_URL, COLORS } from '../constants';
import { Territory, Player } from '../types';

interface MapProps {
  territories: Record<string, Territory>;
  players: Record<string, Player>;
  currentPlayerId: string | null;
  selectedTerritoryId: string | null;
  onTerritoryClick: (geo: any) => void;
  setTooltipContent: (content: string) => void;
}

const MapComponent: React.FC<MapProps> = ({ 
  territories, 
  players, 
  currentPlayerId, 
  selectedTerritoryId,
  onTerritoryClick,
  setTooltipContent
}) => {
  
  const getFillColor = (geoId: string) => {
    // TopoJSON IDs might be numbers, convert to string for lookup
    const idStr = String(geoId);
    const territory = territories[idStr];
    
    if (selectedTerritoryId === idStr) return COLORS.SELECTED;
    
    if (!territory || !territory.ownerId) return COLORS.NEUTRAL;
    
    if (territory.ownerId === currentPlayerId) return COLORS.PLAYER;
    
    const owner = players[territory.ownerId];
    return owner ? owner.color : COLORS.ENEMY;
  };

  return (
    <div className="w-full h-full bg-dark-bg cursor-move" data-tooltip-id="my-tooltip">
      <ComposableMap 
        projectionConfig={{ scale: 180 }} 
        width={1000} 
        height={600}
        style={{ width: "100%", height: "100%", backgroundColor: COLORS.WATER }}
      >
        <ZoomableGroup minZoom={1} maxZoom={12} translateExtent={[[0, 0], [1000, 600]]}>
          <Sphere stroke={COLORS.STROKE} strokeWidth={2} id="sphere" fill="transparent"/>
          <Graticule stroke={COLORS.STROKE} strokeWidth={0.5} />
          
          <Geographies geography={WORLD_TOPO_JSON_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const idStr = String(geo.id);
                const t = territories[idStr];
                const strength = t ? t.strength : 0;
                const ownerName = t?.ownerId ? (players[t.ownerId]?.username || 'Unknown') : 'Neutral';

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onTerritoryClick(geo)}
                    onMouseEnter={() => {
                       setTooltipContent(`${geo.properties.name} | ${ownerName} | Str: ${strength}`);
                    }}
                    onMouseLeave={() => {
                      setTooltipContent("");
                    }}
                    style={{
                      default: {
                        fill: getFillColor(geo.id),
                        stroke: COLORS.STROKE,
                        strokeWidth: 0.5,
                        outline: "none",
                        transition: "all 300ms ease"
                      },
                      hover: {
                        fill: selectedTerritoryId === String(geo.id) ? COLORS.SELECTED : COLORS.HOVER,
                        stroke: "#fff",
                        strokeWidth: 1.5,
                        outline: "none",
                        cursor: "pointer"
                      },
                      pressed: {
                        fill: "#fff",
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};

export default memo(MapComponent);