import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SoundSource } from './types';
import Scene from './components/Scene';
import ControlsPanel from './components/ControlsPanel';
import TracksList from './components/TracksList';
import Timeline from './components/Timeline';
import LoadingIndicator from './components/LoadingIndicator';
import { bufferToWav } from './utils/audio';
import ModeToggle from './components/ModeToggle';

const COLORS = [0xff6347, 0x4682b4, 0x32cd32, 0xffd700, 0x6a5acd, 0xda70d6];

const App: React.FC = () => {
    const [soundSources, setSoundSources] = useState<SoundSource[]>([]);
    const [is3DMode, setIs3DMode] = useState<boolean>(true);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingText, setLoadingText] = useState<string>('Processing Audio...');
    const [zoomLevel, setZoomLevel] = useState<number>(100);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [globalDuration, setGlobalDuration] = useState<number>(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const startOffsetRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setupAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    const updateGlobalDuration = useCallback((sources: SoundSource[]) => {
        const maxDuration = Math.max(0, ...sources.map(s => s.buffer.duration));
        setGlobalDuration(maxDuration);
    }, []);
    
    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setupAudioContext();
        setIsLoading(true);
        setLoadingText('Processing Audio...');

        const newSources: SoundSource[] = [...soundSources];

        for (const file of Array.from(files)) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
                
                const panner = new PannerNode(audioContextRef.current!, { panningModel: 'HRTF', distanceModel: 'inverse' });
                const gainNode = new GainNode(audioContextRef.current!);
                gainNode.connect(panner).connect(audioContextRef.current!.destination);
                
                const color = COLORS[newSources.length % COLORS.length];

                const source: SoundSource = {
                    id: crypto.randomUUID(),
                    name: file.name,
                    buffer: audioBuffer,
                    panner: panner,
                    gainNode: gainNode,
                    color: `#${color.toString(16).padStart(6, '0')}`,
                    sourceNode: null,
                };
                newSources.push(source);
            } catch (e) {
                console.error(`Error processing file ${file.name}:`, e);
            }
        }
        setSoundSources(newSources);
        updateGlobalDuration(newSources);
        setIsLoading(false);
    }, [setupAudioContext, soundSources, updateGlobalDuration]);

    const playAudio = useCallback(() => {
        if (!audioContextRef.current || isPlaying || soundSources.length === 0) return;
        
        setupAudioContext();
        startTimeRef.current = audioContextRef.current.currentTime;

        soundSources.forEach(src => {
            const sourceNode = new AudioBufferSourceNode(audioContextRef.current!, { buffer: src.buffer });
            sourceNode.connect(src.gainNode);
            sourceNode.start(0, startOffsetRef.current % src.buffer.duration);
            src.sourceNode = sourceNode;
        });

        setIsPlaying(true);
    }, [isPlaying, soundSources, setupAudioContext]);

    const pauseAudio = useCallback(() => {
        if (!isPlaying || !audioContextRef.current) return;
        const elapsedTime = audioContextRef.current.currentTime - startTimeRef.current;
        startOffsetRef.current += elapsedTime;
        soundSources.forEach(src => src.sourceNode?.stop());
        setIsPlaying(false);
    }, [isPlaying, soundSources]);
    
    useEffect(() => {
        if (isPlaying) {
            const animate = () => {
                if (!audioContextRef.current) return;
                const elapsedTime = audioContextRef.current.currentTime - startTimeRef.current;
                const newCurrentTime = startOffsetRef.current + elapsedTime;
                
                if (newCurrentTime >= globalDuration) {
                    pauseAudio();
                    startOffsetRef.current = 0;
                    setCurrentTime(0);
                } else {
                    setCurrentTime(newCurrentTime);
                }
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationFrameRef.current);
        }
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isPlaying, globalDuration, pauseAudio]);

    const handleSeek = (newTime: number) => {
        const wasPlaying = isPlaying;
        const clampedTime = Math.max(0, Math.min(newTime, globalDuration));
        
        startOffsetRef.current = clampedTime;
        setCurrentTime(clampedTime);

        if (wasPlaying) {
            soundSources.forEach(src => src.sourceNode?.stop());
            setupAudioContext();
            startTimeRef.current = audioContextRef.current!.currentTime;

            soundSources.forEach(src => {
                const sourceNode = new AudioBufferSourceNode(audioContextRef.current!, { buffer: src.buffer });
                sourceNode.connect(src.gainNode);
                sourceNode.start(0, startOffsetRef.current % src.buffer.duration);
                src.sourceNode = sourceNode;
            });
        }
    };

    const handleExport = async () => {
        if (soundSources.length === 0 || !audioContextRef.current) return;
        setIsLoading(true);
        setLoadingText('Exporting mix...');

        const offlineCtx = new OfflineAudioContext({
            numberOfChannels: 2,
            length: audioContextRef.current.sampleRate * globalDuration,
            sampleRate: audioContextRef.current.sampleRate,
        });

        soundSources.forEach(src => {
            const sourceNode = new AudioBufferSourceNode(offlineCtx, { buffer: src.buffer });
            const panner = new PannerNode(offlineCtx, {
                panningModel: 'HRTF',
                distanceModel: 'inverse',
                positionX: src.panner.positionX.value,
                positionY: src.panner.positionY.value,
                positionZ: src.panner.positionZ.value,
            });
            const gainNode = new GainNode(offlineCtx, { gain: src.gainNode.gain.value });
            
            sourceNode.connect(gainNode).connect(panner).connect(offlineCtx.destination);
            sourceNode.start(0);
        });

        try {
            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = bufferToWav(renderedBuffer);
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'spatial-mix.wav';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Sorry, there was an error exporting your audio.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSourceMove = useCallback((id: string, position: { x: number, y: number, z: number }) => {
        setSoundSources(prevSources => {
            const source = prevSources.find(s => s.id === id);
            if (source && audioContextRef.current) {
                const { x, y, z } = position;
                const now = audioContextRef.current.currentTime;
                source.panner.positionX.linearRampToValueAtTime(x, now + 0.05);
                source.panner.positionY.linearRampToValueAtTime(y, now + 0.05);
                source.panner.positionZ.linearRampToValueAtTime(z, now + 0.05);
            }
            return prevSources;
        });
    }, []);
    
    const handleVolumeChange = useCallback((id: string, volume: number) => {
        const source = soundSources.find(s => s.id === id);
        if (source && audioContextRef.current) {
            source.gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
        }
    }, [soundSources]);

    const handleDeleteSource = useCallback((id: string) => {
        if (isPlaying) {
            pauseAudio();
        }
        
        const newSources = soundSources.filter(s => s.id !== id);
        setSoundSources(newSources);

        const newDuration = Math.max(0, ...newSources.map(s => s.buffer.duration));
        setGlobalDuration(newDuration);
        
        startOffsetRef.current = 0;
        setCurrentTime(0);

    }, [soundSources, isPlaying, pauseAudio]);

    return (
        <div className="flex flex-col h-screen">
            {isLoading && <LoadingIndicator text={loadingText} />}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept="audio/*" 
                onChange={(e) => handleFiles(e.target.files)} 
            />
            
            <ControlsPanel>
                <TracksList soundSources={soundSources} onDeleteSource={handleDeleteSource} />
            </ControlsPanel>
            <ModeToggle is3DMode={is3DMode} onModeToggle={setIs3DMode} />

            <div className="flex-grow relative">
                <Scene
                    soundSources={soundSources}
                    is3DMode={is3DMode}
                    onSourceMove={handleSourceMove}
                />
            </div>
            <Timeline
                soundSources={soundSources}
                currentTime={currentTime}
                duration={globalDuration}
                onSeek={handleSeek}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                onVolumeChange={handleVolumeChange}
                isPlaying={isPlaying}
                onPlayPause={isPlaying ? pauseAudio : playAudio}
                onAddTracks={() => fileInputRef.current?.click()}
                onExport={handleExport}
                isAudioLoaded={soundSources.length > 0}
            />
        </div>
    );
};

export default App;