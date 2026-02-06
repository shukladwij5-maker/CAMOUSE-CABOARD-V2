// Audio Synthesis Module
// Creates oscillators and manages audio for guitar strings

class AudioSynth {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterVolume = this.audioContext.createGain();
        this.masterVolume.connect(this.audioContext.destination);
        this.masterVolume.gain.value = 0.5;

        this.oscillators = {};
        this.gainNodes = {};
        this.filters = {};
        this.activeNotes = new Set();

        this.volume = 0.5;
        this.sensitivity = 0.5;
        this.decay = 1.5; // Increased default decay for better sustain

        // Define guitar-like periodic wave harmonics
        const real = new Float32Array([0, 0, 0, 0, 0, 0]);
        const imag = new Float32Array([0, 1, 0.5, 0.3, 0.1, 0.05]); // Harmonic strengths
        this.guitarWave = this.audioContext.createPeriodicWave(real, imag);
    }

    playNote(stringId, frequency, duration = 2) {
        // Stop if already playing on this string
        if (this.oscillators[stringId]) {
            this.stopNote(stringId);
        }

        try {
            const now = this.audioContext.currentTime;

            // Create oscillator with rich harmonics
            const osc = this.audioContext.createOscillator();
            osc.setPeriodicWave(this.guitarWave);
            osc.frequency.setValueAtTime(frequency, now);

            // Add slight vibrato
            const lfo = this.audioContext.createOscillator();
            lfo.frequency.value = 4 + Math.random(); // Varied vibrato
            const lfoGain = this.audioContext.createGain();
            lfoGain.gain.value = frequency * 0.005; // Proportional to frequency

            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Filter for natural string decay (highs fade faster)
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(4000, now);
            filter.frequency.exponentialRampToValueAtTime(400, now + duration);
            filter.Q.value = 1;

            // Volume Envelope (Attack, Decay)
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0, now);
            // Sharp attack "pluck"
            gainNode.gain.linearRampToValueAtTime(this.volume * this.sensitivity, now + 0.02);
            // Long natural decay
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

            // Pluck transient (high frequency chip)
            const pluck = this.audioContext.createOscillator();
            pluck.type = 'triangle';
            pluck.frequency.setValueAtTime(frequency * 4, now);
            const pluckGain = this.audioContext.createGain();
            pluckGain.gain.setValueAtTime(this.volume * 0.2, now);
            pluckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            // Connect audio graph
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterVolume);

            pluck.connect(pluckGain);
            pluckGain.connect(this.masterVolume);

            // Start oscillators
            osc.start(now);
            lfo.start(now);
            pluck.start(now);

            // Schedule stops
            osc.stop(now + duration);
            lfo.stop(now + duration);
            pluck.stop(now + 0.05);

            // Store references
            this.oscillators[stringId] = osc;
            this.gainNodes[stringId] = gainNode;
            this.filters[stringId] = filter;
            this.activeNotes.add(stringId);

            // Clean up references when sound ends
            setTimeout(() => {
                delete this.oscillators[stringId];
                delete this.gainNodes[stringId];
                delete this.filters[stringId];
                this.activeNotes.delete(stringId);
            }, duration * 1000 + 100);

        } catch (e) {
            console.error('Error playing note:', e);
        }
    }

    stopNote(stringId) {
        if (this.oscillators[stringId]) {
            try {
                const now = this.audioContext.currentTime;
                this.gainNodes[stringId].gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                this.oscillators[stringId].stop(now + 0.1);
                setTimeout(() => {
                    delete this.oscillators[stringId];
                    delete this.gainNodes[stringId];
                    delete this.filters[stringId];
                    this.activeNotes.delete(stringId);
                }, 150);
            } catch (e) {
                console.error('Error stopping note:', e);
            }
        }
    }

    setVolume(value) {
        // value: 0-100
        this.volume = value / 100;
        this.masterVolume.gain.value = this.volume;
    }

    setSensitivity(value) {
        // value: 0-100
        this.sensitivity = value / 100 + 0.1; // Min 0.1, max 1.1
    }

    setDecay(value) {
        // value: seconds (0.1 - 2)
        this.decay = value;
    }

    isNoteActive(stringId) {
        return this.activeNotes.has(stringId);
    }

    stopAll() {
        const now = this.audioContext.currentTime;
        Object.keys(this.oscillators).forEach(stringId => {
            try {
                this.gainNodes[stringId].gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                this.oscillators[stringId].stop(now + 0.1);
            } catch (e) {
                console.error('Error stopping all:', e);
            }
        });
        this.oscillators = {};
        this.gainNodes = {};
        this.activeNotes.clear();
    }
}

// Create global audio synth instance
const audioSynth = new AudioSynth();
