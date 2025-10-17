import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SoundSource, Track, AudioClip } from './types';
import Scene from './components/Scene';
import ControlsPanel from './components/ControlsPanel';
import TracksList from './components/TracksList';
import Timeline from './components/Timeline';
import LoadingIndicator from './components/LoadingIndicator';
import { bufferToWav } from './utils/audio';
import ModeToggle from './components/ModeToggle';
import ShortcutMenu from './components/ShortcutMenu';
import { AddIcon } from './components/Icons';

const COLORS = [0xff6347, 0x4682b4, 0x32cd32, 0xffd700, 0x6a5acd, 0xda70d6];

const App: React.FC = () => {
    const [soundSources, setSoundSources] = useState<SoundSource[]>([]);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [is3DMode, setIs3DMode] = useState<boolean>(true);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingText, setLoadingText] = useState<string>('Processing Audio...');
    const [zoomLevel, setZoomLevel] =useState<number>(50);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [globalDuration, setGlobalDuration] = useState<number>(0);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<AudioClip | null>(null);
    const [timelineHeight, setTimelineHeight] = useState<number>(250);

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

    const updateGlobalDuration = useCallback((currentTracks: Track[]) => {
        const maxDuration = Math.max(0, ...currentTracks.flatMap(t => t.clips).map(c => c.startTime + c.duration));
        setGlobalDuration(maxDuration);
    }, []);
    
    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setupAudioContext();
        setIsLoading(true);
        setLoadingText('Processing Audio...');

        const newSources = [...soundSources];
        const newTracks = [...tracks];

        for (const file of Array.from(files)) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
                
                const source: SoundSource = { id: crypto.randomUUID(), name: file.name, buffer: audioBuffer };
                newSources.push(source);

                const panner = new PannerNode(audioContextRef.current!, { panningModel: 'HRTF', distanceModel: 'inverse' });
                const gainNode = new GainNode(audioContextRef.current!);
                gainNode.connect(panner).connect(audioContextRef.current!.destination);
                
                const trackId = crypto.randomUUID();
                const clip: AudioClip = {
                    id: crypto.randomUUID(),
                    sourceId: source.id,
                    trackId: trackId,
                    name: file.name,
                    startTime: 0,
                    offset: 0,
                    duration: audioBuffer.duration,
                    gain: 1.0,
                    sourceNode: null,
                    clipGainNode: null,
                };

                const track: Track = {
                    id: trackId,
                    name: file.name,
                    color: `#${COLORS[newTracks.length % COLORS.length].toString(16).padStart(6, '0')}`,
                    panner,
                    gainNode,
                    clips: [clip],
                    height: 60, // Default track height
                };
                newTracks.push(track);

            } catch (e) {
                console.error(`Error processing file ${file.name}:`, e);
            }
        }
        setSoundSources(newSources);
        setTracks(newTracks);
        updateGlobalDuration(newTracks);
        setIsLoading(false);
    }, [setupAudioContext, soundSources, tracks, updateGlobalDuration]);

    const playAudio = useCallback(() => {
        if (!audioContextRef.current || isPlaying || tracks.length === 0) return;
        
        setupAudioContext();
        startTimeRef.current = audioContextRef.current.currentTime;
        const playbackStartTime = startOffsetRef.current;
        
        setTracks(prevTracks => {
            const updatedTracks = [...prevTracks];
            updatedTracks.forEach(track => {
                track.clips.forEach(clip => {
                    const clipEndTime = clip.startTime + clip.duration;
                    if (clipEndTime > playbackStartTime && clip.startTime < globalDuration) {
                        const source = soundSources.find(s => s.id === clip.sourceId);
                        if (!source) return;

                        const sourceNode = new AudioBufferSourceNode(audioContextRef.current!, { buffer: source.buffer });
                        const clipGainNode = new GainNode(audioContextRef.current!);
                        clipGainNode.gain.value = clip.gain;

                        sourceNode.connect(clipGainNode).connect(track.gainNode);
                        
                        const when = startTimeRef.current + Math.max(0, clip.startTime - playbackStartTime);
                        const offset = clip.offset + Math.max(0, playbackStartTime - clip.startTime);
                        const duration = clip.duration - Math.max(0, playbackStartTime - clip.startTime);
                        
                        if (duration > 0) {
                            sourceNode.start(when, offset, duration);
                            clip.sourceNode = sourceNode;
                            clip.clipGainNode = clipGainNode; // Store gain node for real-time updates
                        }
                    }
                });
            });
            return updatedTracks;
        });

        setIsPlaying(true);
    }, [isPlaying, tracks, setupAudioContext, globalDuration, soundSources]);

    const pauseAudio = useCallback(() => {
        if (!isPlaying || !audioContextRef.current) return;
        const elapsedTime = audioContextRef.current.currentTime - startTimeRef.current;
        startOffsetRef.current += elapsedTime;
        
        tracks.forEach(track => track.clips.forEach(clip => {
            if (clip.sourceNode) {
                try {
                    clip.sourceNode.stop();
                    clip.sourceNode.disconnect();
                    if (clip.clipGainNode) clip.clipGainNode.disconnect();
                } catch (e) {
                    // Ignore errors from stopping already-stopped nodes
                }
                clip.sourceNode = null;
                clip.clipGainNode = null;
            }
        }));

        setIsPlaying(false);
    }, [isPlaying, tracks]);
    
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
        if (wasPlaying) pauseAudio();

        const clampedTime = Math.max(0, Math.min(newTime, globalDuration));
        startOffsetRef.current = clampedTime;
        setCurrentTime(clampedTime);
        
        if (wasPlaying) playAudio();
    };
    
    const handleExport = async () => {
        if (tracks.length === 0 || isLoading) return;
        setIsLoading(true);
        setLoadingText("Exporting Mixdown...");

        try {
            const sampleRate = audioContextRef.current?.sampleRate || 44100;
            const offlineCtx = new OfflineAudioContext(2, sampleRate * globalDuration, sampleRate);

            for (const track of tracks) {
                const offlinePanner = new PannerNode(offlineCtx, {
                    panningModel: 'HRTF',
                    distanceModel: 'inverse',
                    positionX: track.panner.positionX.value,
                    positionY: track.panner.positionY.value,
                    positionZ: track.panner.positionZ.value
                });
                const offlineTrackGain = new GainNode(offlineCtx, { gain: track.gainNode.gain.value });
                offlinePanner.connect(offlineTrackGain).connect(offlineCtx.destination);
                
                for (const clip of track.clips) {
                    const sourceBuffer = soundSources.find(s => s.id === clip.sourceId)?.buffer;
                    if (!sourceBuffer) continue;

                    const offlineSource = new AudioBufferSourceNode(offlineCtx, { buffer: sourceBuffer });
                    const offlineClipGain = new GainNode(offlineCtx, { gain: clip.gain });
                    offlineSource.connect(offlineClipGain).connect(offlinePanner);
                    offlineSource.start(clip.startTime, clip.offset, clip.duration);
                }
            }

            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = bufferToWav(renderedBuffer);

            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'Project_V_Export.wav';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error("Export failed:", error);
            alert("An error occurred during export. Please check the console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTrackMove = useCallback((id: string, position: { x: number, y: number, z: number }) => {
        setTracks(prevTracks => {
            const track = prevTracks.find(t => t.id === id);
            if (track && audioContextRef.current) {
                const { x, y, z } = position;
                const now = audioContextRef.current.currentTime;
                // Using setTargetAtTime for smoother transitions
                track.panner.positionX.setTargetAtTime(x, now, 0.015);
                track.panner.positionY.setTargetAtTime(y, now, 0.015);
                track.panner.positionZ.setTargetAtTime(z, now, 0.015);
            }
            return prevTracks;
        });
    }, []);

    const handleUpdateClip = useCallback((updatedClip: AudioClip) => {
        setTracks(prevTracks => {
            const newTracks = prevTracks.map(track => {
                if (track.id === updatedClip.trackId) {
                    return {
                        ...track,
                        clips: track.clips.map(clip => {
                            if (clip.id === updatedClip.id) {
                                // Real-time gain update during playback
                                if (clip.clipGainNode && clip.gain !== updatedClip.gain && audioContextRef.current) {
                                    clip.clipGainNode.gain.setValueAtTime(updatedClip.gain, audioContextRef.current.currentTime);
                                }
                                return updatedClip;
                            }
                            return clip;
                        })
                    };
                }
                return track;
            });
            updateGlobalDuration(newTracks);
            return newTracks;
        });
    }, [updateGlobalDuration]);

    const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
        setTracks(prevTracks => 
            prevTracks.map(t => t.id === trackId ? { ...t, ...updates } : t)
        );
    }, []);

    const handleSliceClip = useCallback(() => {
        if (!selectedClipId || currentTime <= 0) return;
        
        setTracks(prevTracks => {
            const newTracks = [...prevTracks];
            let found = false;

            for(const track of newTracks) {
                const clipIndex = track.clips.findIndex(c => c.id === selectedClipId);
                if (clipIndex > -1) {
                    const clip = track.clips[clipIndex];
                    const sliceTimeInClip = currentTime - clip.startTime;
                    if (sliceTimeInClip > 0.01 && sliceTimeInClip < clip.duration - 0.01) {
                        const firstPartDuration = sliceTimeInClip;
                        const secondPartDuration = clip.duration - sliceTimeInClip;
                        
                        const firstClip: AudioClip = {
                            ...clip,
                            duration: firstPartDuration,
                        };

                        const secondClip: AudioClip = {
                            ...clip,
                            id: crypto.randomUUID(),
                            startTime: clip.startTime + firstPartDuration,
                            offset: clip.offset + firstPartDuration,
                            duration: secondPartDuration,
                        };

                        track.clips.splice(clipIndex, 1, firstClip, secondClip);
                        found = true;
                        break;
                    }
                }
            }
            if (found) updateGlobalDuration(newTracks);
            return newTracks;
        });
        setSelectedClipId(null);
    }, [selectedClipId, currentTime, updateGlobalDuration]);
    
    const handleDeleteTrack = useCallback((id: string) => {
        if (isPlaying) pauseAudio();
        const newTracks = tracks.filter(t => t.id !== id);
        setTracks(newTracks);
        updateGlobalDuration(newTracks);
        startOffsetRef.current = 0;
        setCurrentTime(0);
    }, [tracks, isPlaying, pauseAudio, updateGlobalDuration]);

    const handleDeleteClip = useCallback((clipId: string) => {
        if (!clipId) return;

        setTracks(prevTracks => {
            const newTracks = prevTracks.map(track => {
                const clipExists = track.clips.some(c => c.id === clipId);
                if (clipExists) {
                    return {
                        ...track,
                        clips: track.clips.filter(c => c.id !== clipId)
                    };
                }
                return track;
            });
            updateGlobalDuration(newTracks);
            return newTracks;
        });
        setSelectedClipId(null);
    }, [updateGlobalDuration]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                isPlaying ? pauseAudio() : playAudio();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedClipId) {
                    const clip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);
                    if (clip) setClipboard(clip);
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (clipboard) {
                    setTracks(prevTracks => {
                        const newTracks = [...prevTracks];
                        const targetTrack = newTracks.find(t => t.id === clipboard.trackId);
                        if (targetTrack) {
                            const newClip: AudioClip = {
                                ...clipboard,
                                id: crypto.randomUUID(),
                                startTime: currentTime,
                                sourceNode: null,
                                clipGainNode: null,
                            };
                            targetTrack.clips.push(newClip);
                        }
                        updateGlobalDuration(newTracks);
                        return newTracks;
                    });
                }
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedClipId) {
                    e.preventDefault(); // Prevent browser back navigation on backspace
                    handleDeleteClip(selectedClipId);
                }
            }
            if (e.key.toLowerCase() === 's') {
                const selectedClip = selectedClipId ? tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) : null;
                const isPossible = selectedClip ? (currentTime > selectedClip.startTime + 0.01 && currentTime < selectedClip.startTime + selectedClip.duration - 0.01) : false;
                if (isPossible) {
                    e.preventDefault();
                    handleSliceClip();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, pauseAudio, playAudio, selectedClipId, tracks, clipboard, currentTime, updateGlobalDuration, handleDeleteClip, handleSliceClip]);

    const selectedClip = selectedClipId ? tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) : null;
    const isSlicePossible = selectedClip ? (currentTime > selectedClip.startTime + 0.01 && currentTime < selectedClip.startTime + selectedClip.duration - 0.01) : false;

    return (
        <div className="flex flex-col h-screen bg-grid-pattern">
            {isLoading && <LoadingIndicator text={loadingText} />}
            <input type="file" ref={fileInputRef} className="hidden" multiple accept="audio/*" onChange={(e) => handleFiles(e.target.files)} />
            
            <ControlsPanel onSliceClip={handleSliceClip} isSlicePossible={isSlicePossible}>
                <TracksList tracks={tracks} onDeleteTrack={handleDeleteTrack} />
            </ControlsPanel>
            
            <div className="absolute top-0 right-0 p-4 sm:p-6 pointer-events-auto z-20 flex flex-col items-end gap-3">
                <ShortcutMenu />
                <ModeToggle is3DMode={is3DMode} onModeToggle={setIs3DMode} />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 sm:py-2 font-semibold rounded-full sm:rounded-lg transition-all duration-200 shadow-lg bg-cyan-600 hover:bg-cyan-700 text-white border border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] hover:shadow-[0_0_15px_rgba(34,211,238,0.7)]"
                    aria-label="Add new audio track"
                >
                    <AddIcon />
                    <span className="ml-2 hidden sm:inline">Add Track</span>
                </button>
            </div>

            <div className="flex-grow relative" style={{ height: `calc(100% - ${timelineHeight}px)`}}>
                <Scene
                    tracks={tracks}
                    is3DMode={is3DMode}
                    onTrackMove={handleTrackMove}
                />
            </div>
            <Timeline
                tracks={tracks}
                soundSources={soundSources}
                currentTime={currentTime}
                duration={globalDuration}
                onSeek={handleSeek}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                onUpdateClip={handleUpdateClip}
                onUpdateTrack={handleUpdateTrack}
                height={timelineHeight}
                onHeightChange={setTimelineHeight}
                isPlaying={isPlaying}
                onPlayPause={isPlaying ? pauseAudio : playAudio}
                onExport={handleExport}
                isAudioLoaded={tracks.length > 0}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onSliceClip={handleSliceClip}
            />
        </div>
    );
};

export default App;
