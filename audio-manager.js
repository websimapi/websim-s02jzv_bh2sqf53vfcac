const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = new Map();

let listenerX = 0;
let listenerY = 0;
let tileSize = 32;
const MAX_DISTANCE_TILES = 32;

async function loadSound(url) {
    if (soundBuffers.has(url)) {
        return soundBuffers.get(url);
    }
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        soundBuffers.set(url, buffer);
        return buffer;
    } catch (error) {
        console.error(`Failed to load sound: ${url}`, error);
        return null;
    }
}

function playSound(buffer, sourceGridX, sourceGridY) {
    if (!buffer) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    if (sourceGridX !== undefined && sourceGridY !== undefined) {
        const sourcePixelX = sourceGridX * tileSize + tileSize / 2;
        const sourcePixelY = sourceGridY * tileSize + tileSize / 2;

        const dx = sourcePixelX - listenerX;
        const dy = sourcePixelY - listenerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const maxDistancePixels = MAX_DISTANCE_TILES * tileSize;

        if (distance > maxDistancePixels) {
            return; // Sound is too far away to be heard
        }

        const gainNode = audioContext.createGain();
        const panNode = audioContext.createStereoPanner();
        
        // Volume falloff (quadratic for a more natural feel)
        const volume = 1.0 - (distance / maxDistancePixels);
        gainNode.gain.value = volume * volume;

        // Panning (-1 left, 1 right)
        // Normalize the horizontal distance to the panning range
        const panRange = maxDistancePixels * 0.75; // Sounds pan fully when they are 75% of the max distance away horizontally
        const pan = Math.max(-1, Math.min(1, dx / panRange));
        panNode.pan.value = pan;
        
        source.connect(gainNode).connect(panNode).connect(audioContext.destination);
    } else {
        // Fallback for non-spatial sounds
        source.connect(audioContext.destination);
    }
    
    source.start(0);
}

export const AudioManager = {
    async init() {
        const resumeAudio = () => {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            document.body.removeEventListener('click', resumeAudio);
            document.body.removeEventListener('touchstart', resumeAudio);
        };
        document.body.addEventListener('click', resumeAudio);
        document.body.addEventListener('touchstart', resumeAudio);

        // Preload sounds
        await Promise.all([
            loadSound('./chop.mp3'),
            loadSound('./tree_fall.mp3')
        ]);
    },
    setListenerPosition(x, y, ts) {
        listenerX = x;
        listenerY = y;
        tileSize = ts;
    },
    play: playSound,
    getBuffer: (url) => soundBuffers.get(url),
};

