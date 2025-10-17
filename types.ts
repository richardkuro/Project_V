
export interface SoundSource {
    id: string;
    name: string;
    buffer: AudioBuffer;
}

export interface AudioClip {
    id: string;
    sourceId: string;
    trackId: string;
    name: string;
    // Playback state
    startTime: number; // position on the main timeline
    offset: number; // start point within the audio buffer
    duration: number; // how much of the buffer to play
    gain: number; // for attenuation
    sourceNode: AudioBufferSourceNode | null; // each clip needs its own source node
    clipGainNode: GainNode | null; // for real-time gain updates
}

export interface Track {
    id:string;
    name: string;
    color: string;
    panner: PannerNode;
    gainNode: GainNode; // master track gain
    clips: AudioClip[];
    height: number; // For resizable tracks
}
