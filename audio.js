// === AUDIO ENGINE ===
const AudioEngine = {
    ctx: null,
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    play(type) {
        if (!this.ctx) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        const t = this.ctx.currentTime;
        switch(type) {
            case 'jump':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, t);
                osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
                gain.gain.setValueAtTime(0.4, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'slide':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'coin':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, t);
                osc.frequency.setValueAtTime(1100, t + 0.08);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
                osc.start(t); osc.stop(t + 0.15);
                break;
            case 'crash':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.exponentialRampToValueAtTime(20, t + 0.6);
                gain.gain.setValueAtTime(0.8, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
                osc.start(t); osc.stop(t + 0.6);
                // Add second noise layer
                const n = this.ctx.createOscillator();
                const ng = this.ctx.createGain();
                n.connect(ng); ng.connect(this.ctx.destination);
                n.type = 'square';
                n.frequency.setValueAtTime(60, t);
                ng.gain.setValueAtTime(0.5, t);
                ng.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
                n.start(t); n.stop(t + 0.4);
                break;
            case 'nearmiss':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500, t);
                osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
                osc.start(t); osc.stop(t + 0.15);
                break;
            case 'growl':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(40, t);
                osc.frequency.setValueAtTime(55, t + 0.3);
                osc.frequency.setValueAtTime(35, t + 0.6);
                gain.gain.setValueAtTime(0.25, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
                break;
            case 'thunder':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(80, t);
                osc.frequency.linearRampToValueAtTime(30, t + 1.2);
                gain.gain.setValueAtTime(0.7, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
                osc.start(t); osc.stop(t + 1.5);
                // Low-frequency noise/rumble layer
                const t2 = this.ctx.createOscillator();
                const tg2 = this.ctx.createGain();
                t2.connect(tg2); tg2.connect(this.ctx.destination);
                t2.type = 'triangle';
                t2.frequency.setValueAtTime(45, t);
                t2.frequency.linearRampToValueAtTime(20, t + 1.8);
                tg2.gain.setValueAtTime(0.8, t);
                tg2.gain.exponentialRampToValueAtTime(0.01, t + 2.0);
                t2.start(t); t2.stop(t + 2.0);
                break;
            case 'countdown':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(160, t);
                osc.frequency.exponentialRampToValueAtTime(90, t + 0.16);
                gain.gain.setValueAtTime(0.55, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'countdown_go':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, t);
                osc.frequency.exponentialRampToValueAtTime(550, t + 0.35);
                gain.gain.setValueAtTime(0.65, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
        }
    },
    ambientId: null,
    startAmbient() {
        if (!this.ctx || this.ambientId) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.3; lfoGain.gain.value = 15;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        osc.type = 'triangle'; osc.frequency.value = 55;
        gain.gain.value = 0.08;
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); lfo.start();
        this.ambientId = { osc, lfo, gain };
    },
    stopAmbient() {
        if (this.ambientId) {
            this.ambientId.osc.stop();
            this.ambientId.lfo.stop();
            this.ambientId = null;
        }
    }
};
