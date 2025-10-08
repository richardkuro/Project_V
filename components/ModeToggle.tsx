import React from 'react';

interface ModeToggleProps {
    is3DMode: boolean;
    onModeToggle: (is3D: boolean) => void;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ is3DMode, onModeToggle }) => {
    return (
        <div className="flex items-center justify-center space-x-3 text-slate-300 bg-slate-900/70 backdrop-blur-md rounded-lg px-3 py-2 border border-slate-700">
            <span className="text-sm font-medium">2D</span>
            <label htmlFor="mode-switch" className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    id="mode-switch" 
                    className="sr-only peer" 
                    checked={is3DMode} 
                    onChange={(e) => onModeToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
            <span className="text-sm font-medium">3D</span>
        </div>
    );
};

export default ModeToggle;