import React, { useState } from 'react';
import { ScissorsIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface EditorToolbarProps {
    onSliceClip: () => void;
    isSlicePossible: boolean;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ onSliceClip, isSlicePossible }) => {
    return (
        <div className="bg-slate-900/70 backdrop-blur-md rounded-lg p-1.5 border border-slate-700 flex items-center gap-2">
            <button
                onClick={onSliceClip}
                disabled={!isSlicePossible}
                className="p-2 rounded-md transition-colors disabled:text-slate-600 disabled:bg-slate-800 text-cyan-400 enabled:hover:bg-slate-700"
                title={isSlicePossible ? "Slice selected clip at playhead" : "Select a clip and move playhead inside it to slice"}
                aria-label="Slice clip"
            >
                <ScissorsIcon />
            </button>
            {/* Future editing tools can be added here */}
        </div>
    );
};


interface ControlsPanelProps {
    children: React.ReactNode;
    onSliceClip: () => void;
    isSlicePossible: boolean;
}

const ControlsPanel: React.FC<ControlsPanelProps> = ({ children, onSliceClip, isSlicePossible }) => {
    const [isContentVisible, setIsContentVisible] = useState(true);

    return (
        <div className="absolute top-0 left-0 p-2 sm:p-6 pointer-events-auto z-20 flex flex-col gap-2">
            <div className="bg-slate-900/70 backdrop-blur-md rounded-lg p-2 sm:p-3 border border-slate-700 transition-all duration-300">
                <div className="flex items-center justify-between">
                    <h1 className="text-sm sm:text-base font-bold text-cyan-400 text-glow">Project_V</h1>
                    <button onClick={() => setIsContentVisible(!isContentVisible)} className="text-slate-400 hover:text-cyan-300" aria-label={isContentVisible ? 'Collapse panel' : 'Expand panel'}>
                        {isContentVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                </div>
                <div className={`transition-all duration-300 ease-in-out ${isContentVisible ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                    <p className="text-xs text-slate-400 mt-1 max-w-[200px] sm:max-w-xs">
                        Calibrate audio vectors in a simulated deep space environment.
                    </p>
                </div>
            </div>
            <div className={`transition-all duration-300 ease-in-out flex flex-col gap-2 ${isContentVisible ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                <EditorToolbar onSliceClip={onSliceClip} isSlicePossible={isSlicePossible} />
                {children}
            </div>
        </div>
    );
};

export default ControlsPanel;