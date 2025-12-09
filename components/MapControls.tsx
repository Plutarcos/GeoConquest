import React from 'react';
import { Plus, Minus, Crosshair } from 'lucide-react';

interface MapControlsProps {
  zoom: number;
  onZoomChange: (val: number) => void;
  onRecenter: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({ zoom, onZoomChange, onRecenter }) => {
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 pointer-events-auto z-[400]">
      
      {/* Recenter Button */}
      <button 
        onClick={onRecenter}
        className="bg-panel-bg backdrop-blur-md border border-neon-blue/50 p-3 rounded-full text-neon-blue hover:bg-neon-blue hover:text-black transition shadow-lg shadow-neon-blue/20"
        title="Recenter Map"
      >
        <Crosshair size={24} />
      </button>

      {/* Zoom Control Group */}
      <div className="bg-panel-bg backdrop-blur-md border border-gray-700 rounded-full py-4 px-2 flex flex-col items-center gap-2 shadow-xl">
        <button 
          onClick={() => onZoomChange(Math.min(zoom + 1, 18))}
          className="text-gray-300 hover:text-white transition p-1"
        >
          <Plus size={20} />
        </button>
        
        {/* Vertical Slider Wrapper */}
        <div className="h-32 w-6 flex items-center justify-center py-2">
            <input 
              type="range" 
              min="13" 
              max="18" 
              step="0.5"
              value={zoom} 
              onChange={(e) => onZoomChange(parseFloat(e.target.value))}
              className="w-32 h-2 rounded-lg appearance-none cursor-pointer bg-gray-700 -rotate-90 origin-center"
              style={{ margin: 0 }}
            />
        </div>

        <button 
          onClick={() => onZoomChange(Math.max(zoom - 1, 13))}
          className="text-gray-300 hover:text-white transition p-1"
        >
          <Minus size={20} />
        </button>
      </div>
    </div>
  );
};

export default MapControls;