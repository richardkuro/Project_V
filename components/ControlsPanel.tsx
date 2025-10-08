import React from 'react';

interface ControlsPanelProps {
    children: React.ReactNode;
}

const ControlsPanel: React.FC<ControlsPanelProps> = ({ children }) => {
    return (
        <div className="absolute top-0 left-0 p-2 sm:p-6 pointer-events-auto z-20 flex flex-col gap-2">
            <div className="group bg-slate-900/70 backdrop-blur-md rounded-lg p-2 sm:p-3 border border-slate-700 transition-all duration-300">
                <h1 className="text-sm sm:text-base font-bold text-cyan-400 text-glow">Project_V</h1>
                <div className="transition-all duration-300 ease-in-out max-h-0 opacity-0 group-hover:opacity-100 group-hover:max-h-40 overflow-hidden">
                    <p className="text-xs text-slate-400 mt-1 max-w-[200px] sm:max-w-xs">
                        Calibrate audio vectors in a simulated deep space environment.
                    </p>
                </div>
            </div>
            {children}
        </div>
    );
};

export default ControlsPanel;