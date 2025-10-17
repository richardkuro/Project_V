import React from 'react';
import { Track } from '../types';
import { CloseIcon } from './Icons';

interface TracksListProps {
    tracks: Track[];
    onDeleteTrack: (id: string) => void;
}

const TracksList: React.FC<TracksListProps> = ({ tracks, onDeleteTrack }) => {
    if (tracks.length === 0) {
        return null;
    }

    return (
        <div className="bg-slate-900/70 backdrop-blur-md rounded-lg p-2 border border-slate-700 flex flex-col gap-1 max-w-[240px] sm:max-w-xs max-h-[40vh] overflow-y-auto">
            {tracks.map(track => (
                <div key={track.id} className="bg-slate-800/80 p-1.5 rounded-md flex items-center gap-2">
                    <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ 
                            backgroundColor: track.color,
                            boxShadow: `0 0 6px ${track.color}`
                        }}
                    ></div>
                    <span className="text-xs font-medium text-slate-300 truncate flex-grow">
                        {track.name}
                    </span>
                    <button 
                        onClick={() => onDeleteTrack(track.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0 p-0.5 rounded"
                        aria-label={`Delete ${track.name}`}
                    >
                        <CloseIcon />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default TracksList;