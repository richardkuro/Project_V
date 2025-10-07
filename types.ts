
export interface SoundSource {
    id: string;
    name: string;
    buffer: AudioBuffer;
    panner: PannerNode;
    gainNode: GainNode;
    sourceNode: AudioBufferSourceNode | null;
    color: string;
}
