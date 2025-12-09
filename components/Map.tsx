import React, { memo, useMemo } from 'react';
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
import { Tooltip } from 'react-tooltip';

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
    const territory = territories[geoId];
    
    if (selectedTerritoryId === geoId) return COLORS.SELECTED;
    
    if (!territory || !territory.ownerId) return COLORS.NEUTRAL;
    
    if (territory.ownerId === currentPlayerId) return COLORS.PLAYER;
    
    // Enemy colors
    const owner = players[territory.ownerId];
    return owner ? owner.color : COLORS.ENEMY;
  };

  const getStrokeColor = (geoId: string) => {
    if (selectedTerritoryId === geoId) return "#fff";
    return "#111";
  }

  return (
    <div className="w-full h-full bg-dark-bg cursor-move" data-tooltip-id="my-tooltip">
      <ComposableMap 
        projectionConfig={{ scale: 200 }} 
        width={1000} 
        height={600}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup minZoom={1} maxZoom={10} translateExtent={[[0, 0], [1000, 600]]}>
          <Sphere stroke="#222" strokeWidth={2} id="sphere" fill="transparent"/>
          <Graticule stroke="#222" strokeWidth={0.5} />
          <Geographies geography={WORLD_TOPO_JSON_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const t = territories[geo.id];
                const strength = t ? t.strength : 0;
                const ownerName = t?.ownerId ? (players[t.ownerId]?.username || 'Unknown') : 'Neutral';

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onTerritoryClick(geo)}
                    onMouseEnter={() => {
                       setTooltipContent(`${geo.properties.name} | ${ownerName} | Strength: ${strength}`);
                    }}
                    onMouseLeave={() => {
                      setTooltipContent("");
                    }}
                    style={{
                      default: {
                        fill: getFillColor(geo.id),
                        stroke: getStrokeColor(geo.id),
                        strokeWidth: 0.75,
                        outline: "none",
                        transition: "all 250ms"
                      },
                      hover: {
                        fill: selectedTerritoryId === geo.id ? COLORS.SELECTED : COLORS.HOVER,
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