import React, { useRef, useEffect, useState, memo, useMemo } from 'react';
import { AudioClip } from '../types';
import { drawWaveform } from '../utils/audio';

interface AudioClipViewProps {
    clip: AudioClip;
    sourceBuffer: AudioBuffer;
    trackColor: string;
    zoomLevel: number;
    onUpdate: (clip: AudioClip) => void;
    isSelected: boolean;
    onSelect: () => void;
}

const WaveformCanvas: React.FC<{ 
    channelData: Float32Array,
    sampleRate: number,
    color: string, 
    offset: number, 
    duration: number 
}> = memo(({ channelData, sampleRate, color, offset, duration }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas && channelData) {
            drawWaveform(channelData, sampleRate, canvas, color, offset, duration);
        }
    }, [channelData, sampleRate, color, offset, duration]);
    return <canvas ref={canvasRef} className="w-full h-full" />;
});


const AudioClipView: React.FC<AudioClipViewProps> = ({ clip, sourceBuffer, trackColor, zoomLevel, onUpdate, isSelected, onSelect }) => {
    const [interaction, setInteraction] = useState<{ type: 'move' | 'trimStart' | 'trimEnd' | 'gain' } | null>(null);
    const interactionStateRef = useRef<{ type: 'move' | 'trimStart' | 'trimEnd' | 'gain', startX: number, startY: number, originalClip: AudioClip, pointerId: number } | null>(null);
    const clipRef = useRef<HTMLDivElement>(null);

    // Use refs to hold the latest props/callbacks for use in event listeners, avoiding stale closures.
    const onUpdateRef = useRef(onUpdate);
    useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

    const zoomLevelRef = useRef(zoomLevel);
    useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);
    
    const sourceBufferDurationRef = useRef(sourceBuffer.duration);
    useEffect(() => { sourceBufferDurationRef.current = sourceBuffer.duration; }, [sourceBuffer]);
    
    const channelData = useMemo(() => sourceBuffer.getChannelData(0), [sourceBuffer]);
    const sampleRate = sourceBuffer.sampleRate;

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, type: 'move' | 'trimStart' | 'trimEnd' | 'gain') => {
        e.stopPropagation();
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        onSelect();
        
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        document.body.style.cursor = type === 'move' ? 'grabbing' : type === 'gain' ? 'ns-resize' : 'ew-resize';
        
        interactionStateRef.current = { type, startX: e.clientX, startY: e.clientY, originalClip: clip, pointerId: e.pointerId };
        setInteraction({ type }); // This state change triggers the useEffect to add listeners
    };

    useEffect(() => {
        if (!interaction) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (!interactionStateRef.current) return;
            
            const { type, originalClip, startX, startY } = interactionStateRef.current;
            let newClip = { ...originalClip };

            if (type === 'move' || type === 'trimStart' || type === 'trimEnd') {
                const dx = e.clientX - startX;
                const dTime = dx / zoomLevelRef.current;

                if (type === 'move') {
                    newClip.startTime = Math.max(0, originalClip.startTime + dTime);
                } else if (type === 'trimStart') {
                    const maxTrim = originalClip.duration - 0.1; 
                    const actualDTime = Math.max(-originalClip.offset, Math.min(dTime, maxTrim));
                    newClip.startTime = originalClip.startTime + actualDTime;
                    newClip.offset = originalClip.offset + actualDTime;
                    newClip.duration = originalClip.duration - actualDTime;
                } else if (type === 'trimEnd') {
                    const maxTrim = originalClip.duration - 0.1;
                    const actualDTime = Math.max(-maxTrim, Math.min(dTime, sourceBufferDurationRef.current - originalClip.offset - originalClip.duration));
                    newClip.duration = originalClip.duration + actualDTime;
                }
            } else if (type === 'gain') {
                const dy = e.clientY - startY;
                const clipHeight = clipRef.current?.offsetHeight || 52;
                const gainChange = -dy * (1.5 / clipHeight); 
                const newGain = originalClip.gain + gainChange;
                newClip.gain = Math.max(0, Math.min(1.5, newGain));
            }
            onUpdateRef.current(newClip);
        };
        
        const handlePointerUp = (e: PointerEvent) => {
            if (interactionStateRef.current?.pointerId === e.pointerId) {
                try {
                    const target = e.target as HTMLElement;
                    if (target.hasPointerCapture(e.pointerId)) {
                        target.releasePointerCapture(e.pointerId);
                    }
                } catch (err) {
                    // Ignore errors if capture is already lost
                }
                document.body.style.cursor = 'default';
                interactionStateRef.current = null;
                setInteraction(null);
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

    }, [interaction]); // This effect now only runs when an interaction starts or stops.

    const width = clip.duration * zoomLevel;
    const left = clip.startTime * zoomLevel;
    const gainPercentage = (1.5 - clip.gain) / 1.5 * 100;

    return (
        <div
            ref={clipRef}
            className={`audio-clip absolute h-[52px] top-1/2 -translate-y-1/2 rounded-md bg-slate-800/80 group transition-shadow duration-200 ${isSelected ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30' : 'ring-1 ring-slate-700'}`}
            style={{ left: `${left}px`, width: `${width}px`, cursor: interaction ? 'inherit' : 'grab' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
                if (interaction) return; // Prevent starting a new interaction while one is in progress
                const target = e.target as HTMLElement;
                if (target.closest('[data-handle]')) return;
                
                if (e.shiftKey) {
                    handlePointerDown(e, 'gain');
                } else {
                    handlePointerDown(e, 'move');
                }
            }}
        >
            <div data-handle="trimStart" onPointerDown={(e) => handlePointerDown(e, 'trimStart')} className="absolute left-0 top-0 w-2 h-full cursor-ew-resize z-20 rounded-l-md opacity-50 hover:opacity-100 hover:bg-cyan-500/50 transition-opacity"></div>
            
            <div className="relative w-full h-full overflow-hidden">
                <WaveformCanvas 
                    channelData={channelData} 
                    sampleRate={sampleRate} 
                    color={trackColor} 
                    offset={clip.offset} 
                    duration={clip.duration} 
                />

                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                    <div 
                        className="absolute w-full h-px bg-cyan-400/70 transition-all duration-100 group-hover:bg-cyan-300"
                        style={{ top: `${gainPercentage}%`, boxShadow: '0 0 4px #22d3ee' }}
                    >
                        <div 
                            className="absolute left-4 -translate-y-1/2 w-2 h-2 bg-slate-900 border border-cyan-400 rounded-full transition-all duration-100 group-hover:border-cyan-300 group-hover:scale-110"
                        />
                    </div>
                </div>

                 <div className="absolute top-1 left-2 text-[10px] text-white font-semibold select-none text-shadow bg-black/30 px-1 rounded z-10">
                     {clip.name.length > 20 ? clip.name.substring(0, 17) + '...' : clip.name}
                </div>
            </div>

            <div data-handle="trimEnd" onPointerDown={(e) => handlePointerDown(e, 'trimEnd')} className="absolute right-0 top-0 w-2 h-full cursor-ew-resize z-20 rounded-r-md opacity-50 hover:opacity-100 hover:bg-cyan-500/50 transition-opacity"></div>
        </div>
    );
};
export default AudioClipView;
