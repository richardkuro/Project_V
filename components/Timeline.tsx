import React, { useRef, useCallback, useEffect, Fragment } from 'react';
import { Track, AudioClip, SoundSource } from '../types';
import { formatTime } from '../utils/time';
import { PlayIcon, PauseIcon, ExportIcon, ZoomInIcon, ZoomOutIcon } from './Icons';
import AudioClipView from './AudioClipView';

interface TimelineProps {
    tracks: Track[];
    soundSources: SoundSource[];
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    zoomLevel: number;
    onZoomChange: (level: number) => void;
    onUpdateClip: (clip: AudioClip) => void;
    onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
    height: number;
    onHeightChange: (height: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    onExport: () => void;
    isAudioLoaded: boolean;
    selectedClipId: string | null;
    onSelectClip: (id: string | null) => void;
    onSliceClip: () => void;
}

const Timeline: React.FC<TimelineProps> = ({
    tracks,
    soundSources,
    currentTime,
    duration,
    onSeek,
    zoomLevel,
    onZoomChange,
    onUpdateClip,
    onUpdateTrack,
    height,
    onHeightChange,
    isPlaying,
    onPlayPause,
    onExport,
    isAudioLoaded,
    selectedClipId,
    onSelectClip,
}) => {
    const timelineRulerRef = useRef<HTMLDivElement>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRulerRef.current) return;
        const rect = timelineRulerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = clickX / zoomLevel;
        onSeek(newTime);
    }, [onSeek, zoomLevel]);

    const renderTimeMarkers = () => {
        if (!duration) return null;
        const markers = [];
        const timelineWidth = duration * zoomLevel;
        const interval = zoomLevel > 100 ? 1 : zoomLevel > 50 ? 2 : zoomLevel > 20 ? 5 : 10;
        const numMarkers = Math.floor(duration / interval);
        for (let i = 0; i <= numMarkers; i++) {
            const time = i * interval;
            const position = time * zoomLevel;
            if (position > timelineWidth + 50) break;
            markers.push(
                <div key={time} className="absolute top-0 text-slate-500 text-[10px]" style={{ left: `${position}px` }}>
                    <div className="h-2 w-px bg-slate-600"></div>
                    {formatTime(time).slice(0, 5)}
                </div>
            );
        }
        return markers;
    };
    
    useEffect(() => {
        if (isPlaying && timelineContainerRef.current) {
            const container = timelineContainerRef.current;
            const playheadPosition = currentTime * zoomLevel;
            const containerWidth = container.offsetWidth;
            
            container.scrollTo({
                left: playheadPosition - containerWidth / 2,
                behavior: 'auto',
            });
        }
    }, [currentTime, isPlaying, zoomLevel]);

    const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = height;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const dy = startY - moveEvent.clientY;
            const newHeight = Math.max(120, Math.min(startHeight + dy, window.innerHeight - 100));
            onHeightChange(newHeight);
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            document.body.style.cursor = 'default';
        };
        
        document.body.style.cursor = 'row-resize';
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    const handleTrackResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, trackId: string, originalHeight: number) => {
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            const dy = moveEvent.clientY - startY;
            const newHeight = Math.max(40, originalHeight + dy);
            onUpdateTrack(trackId, { height: newHeight });
        };
        
        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
             document.body.style.cursor = 'default';
        };

        document.body.style.cursor = 'row-resize';
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };


    return (
        <div className="relative flex-shrink-0 z-30" style={{ height: `${height}px` }}>
            <div
                onPointerDown={handleResizePointerDown}
                className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize bg-slate-800 hover:bg-cyan-500/50 transition-colors z-40"
            />
            <div className="h-full pt-1.5 bg-slate-950/80 backdrop-blur-lg border-t border-slate-700 flex flex-col">
                {/* Controls Header */}
                <div className="flex-shrink-0 h-12 bg-slate-900/50 flex items-center justify-between px-4 border-b border-slate-800">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onPlayPause}
                            disabled={!isAudioLoaded}
                            className="p-2 text-cyan-400 rounded-full disabled:text-slate-600 enabled:hover:bg-slate-700 transition-colors"
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        </button>
                        <div className="font-mono text-lg text-glow text-cyan-400 w-[80px]">
                            {formatTime(currentTime)}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <button onClick={() => onZoomChange(Math.max(10, zoomLevel - 10))} className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition-colors"><ZoomOutIcon /></button>
                            <input
                                type="range"
                                min="10"
                                max="200"
                                value={zoomLevel}
                                onChange={(e) => onZoomChange(Number(e.target.value))}
                                className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                            />
                            <button onClick={() => onZoomChange(Math.min(200, zoomLevel + 10))} className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition-colors"><ZoomInIcon /></button>
                        </div>
                        <button
                            onClick={onExport}
                            disabled={!isAudioLoaded}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm font-semibold text-slate-300 disabled:opacity-50 hover:bg-slate-700 hover:border-slate-600 transition-colors"
                        >
                            <ExportIcon />
                            Export
                        </button>
                    </div>
                </div>

                {/* Timeline Tracks */}
                <div 
                    ref={timelineContainerRef}
                    className="flex-grow overflow-auto relative"
                    onClick={() => onSelectClip(null)}
                >
                    <div className="relative h-full" style={{ width: `${Math.max(duration * zoomLevel, 1000)}px`}}>
                        <div ref={timelineRulerRef} className="h-6 sticky top-0 bg-slate-900 z-20" onMouseDown={handleSeek}>
                            {renderTimeMarkers()}
                        </div>

                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-30 pointer-events-none"
                            style={{ left: `${currentTime * zoomLevel}px`, boxShadow: '0 0 8px #22d3ee' }}
                        />

                        <div className="relative pt-1">
                             {tracks.map((track, index) => (
                                <Fragment key={track.id}>
                                    <div style={{ height: `${track.height}px` }} className="relative">
                                        {track.clips.map(clip => {
                                            const sourceBuffer = soundSources.find(s => s.id === clip.sourceId)?.buffer;
                                            if (!sourceBuffer) return null;
                                            return (
                                                <AudioClipView
                                                    key={clip.id}
                                                    clip={clip}
                                                    sourceBuffer={sourceBuffer}
                                                    trackColor={track.color}
                                                    zoomLevel={zoomLevel}
                                                    onUpdate={onUpdateClip}
                                                    isSelected={selectedClipId === clip.id}
                                                    onSelect={() => onSelectClip(clip.id)}
                                                />
                                            );
                                        })}
                                    </div>
                                    {index < tracks.length - 1 && (
                                        <div
                                            className="w-full h-1.5 cursor-row-resize bg-slate-800 hover:bg-cyan-500/50 transition-colors"
                                            onPointerDown={(e) => handleTrackResizePointerDown(e, track.id, track.height)}
                                        />
                                    )}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Timeline;