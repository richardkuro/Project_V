import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import { SoundSource } from '../types';
import { drawWaveform } from '../utils/audio';
import { ZoomInIcon, ZoomOutIcon, ChevronUpIcon, ChevronDownIcon, PlayIcon, PauseIcon, AddIcon, ExportIcon } from './Icons';
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
    onAddTracks: () => void;
    onExport: () => void;
    isAudioLoaded: boolean;
}

const TRACK_INFO_PANEL_WIDTH_PX = 128; 
const TRACK_ROW_GAP_PX = 8; 
const WAVEFORM_START_OFFSET_PX = TRACK_INFO_PANEL_WIDTH_PX + TRACK_ROW_GAP_PX;

const Timeline: React.FC<TimelineProps> = ({
    soundSources, currentTime, duration, onSeek, zoomLevel, onZoomChange, onVolumeChange,
    isPlaying, onPlayPause, onAddTracks, onExport, isAudioLoaded
}) => {
    const timelineWrapperRef = useRef<HTMLDivElement>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const [isSeeking, setIsSeeking] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const timelineWidth = duration * zoomLevel;

    const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement> | PointerEvent) => {
        if (!timelineContainerRef.current || duration <= 0) return;
        
        const containerBounds = timelineContainerRef.current.getBoundingClientRect();
        const scrollLeft = timelineContainerRef.current.scrollLeft;
        const posInContainer = event.clientX - containerBounds.left;
        const clickX = posInContainer + scrollLeft;

        const waveformAreaWidth = timelineWidth;
        if (waveformAreaWidth <= 0) return;

        const clickInWaveformArea = clickX - WAVEFORM_START_OFFSET_PX;

        const clampedClickX = Math.max(0, Math.min(clickInWaveformArea, waveformAreaWidth));
        
        const newTime = (clampedClickX / waveformAreaWidth) * duration;
        onSeek(newTime);

    }, [duration, onSeek, timelineWidth]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        const targetElement = e.target as HTMLElement;
        if (!targetElement.closest('.waveform-container')) return;

        setIsSeeking(true);
        handleSeek(e);
    };

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => { if (isSeeking) handleSeek(e); };
        const handlePointerUp = () => { setIsSeeking(false); };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isSeeking, handleSeek]);

    let playheadPositionPercent = 0;
    if (duration > 0 && timelineWidth > 0) {
        const waveformAreaWidth = timelineWidth;
        const playheadOffsetInWaveform = (currentTime / duration) * waveformAreaWidth;
        const playheadAbsolutePosition = WAVEFORM_START_OFFSET_PX + playheadOffsetInWaveform;
        playheadPositionPercent = (playheadAbsolutePosition / (timelineWidth + WAVEFORM_START_OFFSET_PX)) * 100;
    }

    return (
        <div className="flex-shrink-0 flex flex-col">
            <div 
                ref={timelineContainerRef} 
                className={`w-full bg-slate-900/80 backdrop-blur-md border-t border-slate-700 overflow-x-auto overflow-y-auto transition-all duration-300 ease-in-out ${isMinimized ? 'max-h-0 !p-0 !border-t-0 opacity-0' : 'max-h-[40vh] p-2 opacity-100'}`}
            >
                <div 
                    ref={timelineWrapperRef} 
                    className="relative cursor-pointer space-y-1" 
                    style={{ width: `${timelineWidth + WAVEFORM_START_OFFSET_PX}px` }}
                    onPointerDown={handlePointerDown}
                >
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

                    {duration > 0 && (
                        <div 
                            className="absolute left-0 top-0 w-0.5 h-full bg-cyan-400 pointer-events-none z-10"
                            style={{ 
                                left: `${playheadPositionPercent}%`, 
                                boxShadow: '0 0 8px #22d3ee' 
                            }}
                        ></div>
                    )}
                </div>
            </div>
            <div className="bg-slate-950 p-2 flex items-center justify-between relative border-t border-slate-700 h-14">
                <div className="flex items-center gap-4">
                    <button onClick={onPlayPause} disabled={!isAudioLoaded} className="flex items-center justify-center p-2 w-10 h-10 rounded-full transition-all duration-200 disabled:text-slate-600 disabled:bg-slate-800 text-white bg-emerald-600 hover:bg-emerald-700 disabled:shadow-none shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <div className="font-mono text-lg text-cyan-400">{formatTime(currentTime)}</div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <button onClick={onAddTracks} className="flex items-center justify-center px-4 py-2 font-semibold rounded-lg transition-all duration-200 shadow-lg bg-cyan-600 hover:bg-cyan-700 text-white border border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] hover:shadow-[0_0_15px_rgba(34,211,238,0.7)]">
                        <AddIcon />
                        <span className="ml-2">Add Track</span>
                    </button>
                </div>
                
                <div className="flex items-center gap-3">
                    <ZoomOutIcon />
                    <input 
                        type="range" id="zoom-slider" min="10" max="500" value={zoomLevel} 
                        onChange={(e) => onZoomChange(parseInt(e.target.value, 10))}
                        className="w-32 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <ZoomInIcon />
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