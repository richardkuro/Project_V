import React, { useRef, useEffect, useCallback, useState, memo, useLayoutEffect } from 'react';
import { SoundSource } from '../types';
import { drawWaveform } from '../utils/audio';
import { ZoomInIcon, ZoomOutIcon, ChevronUpIcon, ChevronDownIcon, PlayIcon, PauseIcon, ExportIcon } from './Icons';
import { formatTime } from '../utils/time';

interface WaveformCanvasProps {
    buffer: AudioBuffer;
    color: string;
}

const WaveformCanvas: React.FC<WaveformCanvasProps> = memo(({ buffer, color }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas && buffer) {
            drawWaveform(buffer, canvas, color);
        }
    }, [buffer, color]);

    return <canvas ref={canvasRef} className="waveform-canvas flex-grow w-full h-[48px] bg-slate-950/50 rounded-md"></canvas>;
});

const calculateTicks = (duration: number, zoomLevel: number, minSpacingPx: number) => {
    if (duration <= 0 || zoomLevel <= 0) return [];

    const pixelsPerSecond = zoomLevel;
    const minTimeInterval = minSpacingPx / pixelsPerSecond;

    const niceIntervals = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    
    const tickInterval = niceIntervals.find(interval => interval >= minTimeInterval) || niceIntervals[niceIntervals.length - 1];

    const ticks = [];
    const tickCount = Math.floor(duration / tickInterval);

    for (let i = 0; i <= tickCount; i++) {
        const time = i * tickInterval;
        ticks.push({
            time: time,
            position: time * zoomLevel,
        });
    }
    
    return ticks;
};

interface TimelineProps {
    soundSources: SoundSource[];
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    zoomLevel: number;
    onZoomChange: (level: number) => void;
    onVolumeChange: (id: string, volume: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    onExport: () => void;
    isAudioLoaded: boolean;
}

const TRACK_INFO_PANEL_WIDTH_PX = 128; 
const TRACK_ROW_GAP_PX = 8; 
const WAVEFORM_START_OFFSET_PX = TRACK_INFO_PANEL_WIDTH_PX + TRACK_ROW_GAP_PX;

const Timeline: React.FC<TimelineProps> = ({
    soundSources, currentTime, duration, onSeek, zoomLevel, onZoomChange, onVolumeChange,
    isPlaying, onPlayPause, onExport, isAudioLoaded
}) => {
    const timelineWrapperRef = useRef<HTMLDivElement>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const [isSeeking, setIsSeeking] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const timelineWidth = duration * zoomLevel;
    const ticks = calculateTicks(duration, zoomLevel, 80);

    const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement> | PointerEvent) => {
        if (!timelineContainerRef.current || duration <= 0) return;
        
        const containerBounds = timelineContainerRef.current.getBoundingClientRect();
        const scrollLeft = timelineContainerRef.current.scrollLeft;
        const clickXInView = event.clientX - containerBounds.left;
        const clickXAbsolute = clickXInView + scrollLeft;

        const waveformAreaStart = WAVEFORM_START_OFFSET_PX;
        if (clickXAbsolute < waveformAreaStart) return;

        const clickInWaveform = clickXAbsolute - waveformAreaStart;
        const newTime = (clickInWaveform / timelineWidth) * duration;
        onSeek(Math.max(0, Math.min(newTime, duration)));

    }, [duration, onSeek, timelineWidth]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const targetElement = e.target as HTMLElement;
        if (!targetElement.closest('.waveform-container') && !targetElement.closest('.timeline-ruler')) return;
        setIsSeeking(true);
        handleSeek(e);
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isSeeking) handleSeek(e);
    };
    
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsSeeking(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    useLayoutEffect(() => {
        if (!isPlaying || !timelineContainerRef.current || !playheadRef.current || duration <= 0) return;

        const container = timelineContainerRef.current;
        const viewWidth = container.clientWidth;
        const halfViewWidth = viewWidth / 2;
        
        const currentTimePosition = WAVEFORM_START_OFFSET_PX + (currentTime * zoomLevel);
        const targetScrollLeft = currentTimePosition - halfViewWidth;

        container.scrollLeft = Math.max(0, targetScrollLeft);
        playheadRef.current.style.left = `${Math.min(currentTimePosition, halfViewWidth)}px`;

    }, [currentTime, isPlaying, duration, zoomLevel]);
    
    useLayoutEffect(() => {
        if (isPlaying || !timelineContainerRef.current || !playheadRef.current || duration <= 0) return;

        const container = timelineContainerRef.current;
        const viewWidth = container.clientWidth;
        
        const currentTimePosition = WAVEFORM_START_OFFSET_PX + (currentTime * zoomLevel);

        if(currentTimePosition < container.scrollLeft || currentTimePosition > container.scrollLeft + viewWidth) {
             container.scrollLeft = currentTimePosition - viewWidth / 2;
        }
        playheadRef.current.style.left = `${currentTimePosition - container.scrollLeft}px`;
    }, [currentTime, isPlaying, duration, zoomLevel]);


    return (
        <div className="flex-shrink-0 flex flex-col">
            <div className="relative">
                <div 
                    ref={timelineContainerRef} 
                    className={`w-full bg-slate-900/80 backdrop-blur-md border-t border-slate-700 overflow-x-auto overflow-y-auto transition-all duration-300 ease-in-out ${isMinimized ? 'max-h-0 !p-0 !border-t-0 opacity-0' : 'max-h-[40vh] p-2 opacity-100'}`}
                >
                    <div 
                        ref={timelineWrapperRef} 
                        className="relative cursor-pointer" 
                        style={{ width: `${timelineWidth + WAVEFORM_START_OFFSET_PX}px` }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        {duration > 0 && (
                            <div className="timeline-ruler relative h-6 mb-2" style={{ 
                                marginLeft: `${WAVEFORM_START_OFFSET_PX}px`, 
                                width: `${timelineWidth}px`
                            }}>
                                {ticks.map(({ time, position }) => (
                                    <div key={time} className="absolute top-0 h-full" style={{ left: `${position}px` }}>
                                        <div className="w-px h-2 bg-slate-500"></div>
                                        <span className="absolute -translate-x-1/2 text-[10px] text-slate-400 mt-1 select-none">
                                            {formatTime(time)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="space-y-2">
                            {soundSources.map(source => (
                                <div key={source.id} className="flex items-center gap-2">
                                    <div className="w-32 p-2 bg-slate-800 rounded-md flex-shrink-0 pointer-events-auto">
                                        <div className="text-xs font-semibold truncate text-slate-200">{source.name}</div>
                                        <input 
                                            type="range" min="0" max="1.5" step="0.01" defaultValue="1"
                                            className="w-full h-2 mt-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                            onChange={(e) => onVolumeChange(source.id, parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="waveform-container relative w-full h-[48px]" style={{width: `${timelineWidth}px`}}>
                                        <WaveformCanvas buffer={source.buffer} color={source.color} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {duration > 0 && !isMinimized && (
                    <div 
                        ref={playheadRef}
                        className="absolute top-0 w-0.5 h-full bg-cyan-400 pointer-events-none z-10"
                        style={{ 
                            boxShadow: '0 0 8px #22d3ee',
                            transform: 'translateX(-50%)' 
                        }}
                    ></div>
                )}
            </div>

            <div className="bg-slate-950 p-2 flex items-center justify-between relative border-t border-slate-700 h-14">
                {/* Left section: Playback controls and time */}
                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={onPlayPause} disabled={!isAudioLoaded} className="flex items-center justify-center p-2 w-10 h-10 rounded-full transition-all duration-200 disabled:text-slate-600 disabled:bg-slate-800 text-white bg-emerald-600 hover:bg-emerald-700 disabled:shadow-none shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <div className="font-mono text-base sm:text-lg text-cyan-400">{formatTime(currentTime)}</div>
                </div>
                
                {/* Center section: Zoom controls */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-3 text-slate-400">
                    <ZoomOutIcon />
                    <input 
                        type="range" id="zoom-slider" min="5" max="100" value={zoomLevel} 
                        onChange={(e) => onZoomChange(parseInt(e.target.value, 10))}
                        className="w-24 sm:w-40 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <ZoomInIcon />
                </div>

                {/* Right section: Timeline actions */}
                <div className="flex items-center gap-1 sm:gap-3">
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 text-slate-400 hover:text-white transition-colors" aria-label={isMinimized ? "Expand timeline" : "Collapse timeline"}>
                        {isMinimized ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                    <button onClick={onExport} disabled={!isAudioLoaded} className="flex items-center justify-center p-2 w-10 h-10 rounded-full transition-all duration-200 disabled:text-slate-600 disabled:bg-slate-800 text-white bg-violet-600 hover:bg-violet-700 disabled:shadow-none shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                        <ExportIcon />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Timeline;