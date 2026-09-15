/**
 * CYMASPACE - Sound-to-Light Frequency Visualizer (White / Light Liquid Stage)
 * Features:
 * - Clean white canvas surface with translucent watercolor / liquid dye diffusion
 * - True multi-band sampling: each pulse wave carries ALL frequencies rippling out to the ends
 * - Inner layer dyed Warm Red (0-200 Hz Bass)
 * - Middle body dyed Electric Blue (200-1000 Hz Voice & Melodies)
 * - Outer crest dyed Vibrant Purple (1000+ Hz Treble & Cymbals)
 * - 60 FPS butter-smooth liquid wave simulation with zero stutter
 */

class SoundLightVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.audioCtx = null;
    this.analyser = null;
    this.gainNode = null;
    this.micStream = null;

    // Multi-oscillator audio synthesizer
    this.oscillators = [];
    this.isPlayingAudio = false;
    this.isMicActive = false;

    // Current sound mode and pitch
    this.sliderFreq = 440;
    this.soundMode = 'all'; // 'all', 'bass', 'mid', 'high', 'custom'

    // Smooth tri-band frequency energies (0.0 to 1.0)
    this.smoothLow = 0.50;   // 0 - 200 Hz (Red)
    this.smoothMid = 0.60;   // 200 - 1000 Hz (Blue)
    this.smoothHigh = 0.45;  // 1000+ Hz (Purple)

    // Pixelblaze pattern: 'pulse', 'chladni', 'spiral', 'spectrum', 'matrix', 'lissajous'
    this.animation = 'pulse';
    this.time = 0;

    // Audio FFT buffers
    this.bufferLength = 0;
    this.dataArray = null;

    // Liquid pulse wave pool (pre-allocated for locked 60 FPS)
    this.pulses = [];
    this.pulseTimer = 0;

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
    this.initControls();
    this.animate();
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.85;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0.08;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  stopOscillators() {
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.oscillators = [];
  }

  startSound(mode, freq = 440) {
    this.initAudioContext();
    this.stopOscillators();

    const now = this.audioCtx.currentTime;

    if (mode === 'all') {
      // Tri-Band Composite Chord: 80Hz Bass + 440Hz Melody + 2400Hz Shimmer
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const osc3 = this.audioCtx.createOscillator();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(80, now);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(2400, now);

      const g1 = this.audioCtx.createGain();
      const g2 = this.audioCtx.createGain();
      const g3 = this.audioCtx.createGain();
      g1.gain.value = 0.55;
      g2.gain.value = 0.35;
      g3.gain.value = 0.15;

      osc1.connect(g1); g1.connect(this.gainNode);
      osc2.connect(g2); g2.connect(this.gainNode);
      osc3.connect(g3); g3.connect(this.gainNode);

      osc1.start(); osc2.start(); osc3.start();
      this.oscillators = [osc1, osc2, osc3];
    } else {
      const osc = this.audioCtx.createOscillator();
      osc.type = mode === 'bass' ? 'sine' : (mode === 'mid' ? 'triangle' : 'sine');
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(this.gainNode);
      osc.start();
      this.oscillators = [osc];
    }

    this.isPlayingAudio = true;
  }

  togglePlayTone() {
    const toneBtn = document.getElementById('vizToneBtn');
    if (this.isPlayingAudio) {
      this.stopOscillators();
      this.isPlayingAudio = false;
      if (toneBtn) {
        toneBtn.classList.remove('active');
        toneBtn.setAttribute('aria-pressed', 'false');
        toneBtn.querySelector('.btn-text').textContent = 'Play Sound Demo';
      }
    } else {
      this.startSound(this.soundMode, this.sliderFreq);
      if (toneBtn) {
        toneBtn.classList.add('active');
        toneBtn.setAttribute('aria-pressed', 'true');
        toneBtn.querySelector('.btn-text').textContent = 'Stop Sound';
      }
    }
  }

  async toggleMic() {
    this.initAudioContext();
    const micBtn = document.getElementById('vizMicBtn');

    if (this.isMicActive) {
      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
        this.micStream = null;
      }
      this.isMicActive = false;
      if (micBtn) {
        micBtn.classList.remove('active');
        micBtn.setAttribute('aria-pressed', 'false');
        micBtn.querySelector('.btn-text').textContent = 'Live Microphone';
      }
    } else {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = this.audioCtx.createMediaStreamSource(this.micStream);
        source.connect(this.analyser);
        this.isMicActive = true;
        if (micBtn) {
          micBtn.classList.add('active');
          micBtn.setAttribute('aria-pressed', 'true');
          micBtn.querySelector('.btn-text').textContent = 'Microphone Active';
        }
      } catch (err) {
        console.warn('Microphone permission denied or unavailable:', err);
        alert('Microphone access was denied. You can explore all frequency color animations using the sound buttons and presets below.');
      }
    }
  }

  setSliderFrequency(freq) {
    this.sliderFreq = freq;
    const freqDisplay = document.getElementById('vizFreqVal');
    if (freqDisplay) freqDisplay.textContent = `${Math.round(freq)} Hz`;

    if (this.isPlayingAudio && this.oscillators.length === 1 && this.audioCtx) {
      this.oscillators[0].frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.05);
    }
  }

  initControls() {
    const toneBtn = document.getElementById('vizToneBtn');
    const micBtn = document.getElementById('vizMicBtn');
    const freqSlider = document.getElementById('vizFreqSlider');
    const animBtns = document.querySelectorAll('[data-viz-anim]');
    const presetBtns = document.querySelectorAll('.freq-preset-btn');

    if (toneBtn) toneBtn.addEventListener('click', () => this.togglePlayTone());
    if (micBtn) micBtn.addEventListener('click', () => this.toggleMic());

    if (freqSlider) {
      freqSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.soundMode = 'custom';
        this.setSliderFrequency(val);
        presetBtns.forEach(b => b.classList.remove('active'));
      });
    }

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        const targetFreq = parseInt(btn.getAttribute('data-freq') || '440', 10);

        this.soundMode = mode;
        this.sliderFreq = targetFreq;
        if (freqSlider) freqSlider.value = targetFreq;
        this.setSliderFrequency(targetFreq);

        if (this.isPlayingAudio) {
          this.startSound(mode, targetFreq);
        }
      });
    });

    animBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        animBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.animation = btn.getAttribute('data-viz-anim');
      });
    });
  }

  /**
   * Multi-Band Frequency Decomposition
   * Samples live audio energy across:
   * Low: 0-200 Hz (Red)
   * Mid: 200-1000 Hz (Blue)
   * High: 1000+ Hz (Purple)
   */
  updateFrequencyEnergies() {
    let rawLow = 0;
    let rawMid = 0;
    let rawHigh = 0;

    if (this.analyser && this.dataArray && (this.isMicActive || this.isPlayingAudio)) {
      this.analyser.getByteFrequencyData(this.dataArray);
      const nyquist = this.audioCtx.sampleRate / 2;
      const binHz = nyquist / this.bufferLength;

      let countLow = 0, sumLow = 0;
      let countMid = 0, sumMid = 0;
      let countHigh = 0, sumHigh = 0;

      for (let i = 1; i < this.bufferLength; i++) {
        const freq = i * binHz;
        const val = this.dataArray[i] / 255.0;

        if (freq <= 200) {
          sumLow += val;
          countLow++;
        } else if (freq <= 1000) {
          sumMid += val;
          countMid++;
        } else if (freq <= 4000) {
          sumHigh += val;
          countHigh++;
        }
      }

      rawLow = countLow > 0 ? (sumLow / countLow) * 1.6 : 0;
      rawMid = countMid > 0 ? (sumMid / countMid) * 1.5 : 0;
      rawHigh = countHigh > 0 ? (sumHigh / countHigh) * 1.4 : 0;
    } else {
      const t = this.time;
      if (this.soundMode === 'all') {
        rawLow = 0.40 + Math.sin(t * 1.6) * 0.25;
        rawMid = 0.50 + Math.cos(t * 2.2) * 0.25;
        rawHigh = 0.38 + Math.sin(t * 3.1) * 0.20;
      } else if (this.soundMode === 'bass' || this.sliderFreq <= 200) {
        rawLow = 0.85 + Math.sin(t * 3.0) * 0.15;
        rawMid = 0.20 + Math.sin(t * 1.4) * 0.1;
        rawHigh = 0.12;
      } else if (this.soundMode === 'mid' || (this.sliderFreq > 200 && this.sliderFreq <= 1000)) {
        rawLow = 0.18;
        rawMid = 0.85 + Math.sin(t * 2.4) * 0.15;
        rawHigh = 0.25 + Math.cos(t * 1.8) * 0.1;
      } else {
        rawLow = 0.15;
        rawMid = 0.22;
        rawHigh = 0.85 + Math.sin(t * 3.8) * 0.15;
      }
    }

    // Smooth Exponential Moving Average (Attack: fast response, Decay: gentle fade)
    const smoothFactor = 0.20;
    this.smoothLow = this.smoothLow * (1 - smoothFactor) + Math.min(1.0, rawLow) * smoothFactor;
    this.smoothMid = this.smoothMid * (1 - smoothFactor) + Math.min(1.0, rawMid) * smoothFactor;
    this.smoothHigh = this.smoothHigh * (1 - smoothFactor) + Math.min(1.0, rawHigh) * smoothFactor;

    // Update Tri-Band Meters in UI
    const meterRed = document.getElementById('meterRed');
    const meterBlue = document.getElementById('meterBlue');
    const meterPurple = document.getElementById('meterPurple');

    if (meterRed) meterRed.style.width = `${Math.min(100, Math.max(10, this.smoothLow * 120))}%`;
    if (meterBlue) meterBlue.style.width = `${Math.min(100, Math.max(10, this.smoothMid * 120))}%`;
    if (meterPurple) meterPurple.style.width = `${Math.min(100, Math.max(10, this.smoothHigh * 120))}%`;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.time += 0.025;

    this.updateFrequencyEnergies();

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clean white canvas clear with soft watercolor diffusion trails
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.fillRect(0, 0, w, h);

    switch (this.animation) {
      case 'pulse':
        this.renderLiquidPulseWaves(w, h);
        break;
      case 'chladni':
        this.renderChladniNodes(w, h);
        break;
      case 'spiral':
        this.renderHarmonicSpiral(w, h);
        break;
      case 'spectrum':
        this.renderFrequencySpectrum(w, h);
        break;
      case 'matrix':
        this.renderPixelblazeMatrix(w, h);
        break;
      case 'lissajous':
        this.renderLissajousScope(w, h);
        break;
      default:
        this.renderLiquidPulseWaves(w, h);
        break;
    }
  }

  // =========================================================================
  // PATTERN 1: Liquid Dyed Pulse Waves (All Frequencies Rippling Outward)
  // Samples all 3 frequencies at pulse birth and ripples outward:
  // - Inner ring dyed Warm Red (Bass)
  // - Middle body dyed Electric Blue (Vocals / Melodies)
  // - Outer wave crest dyed Radiant Purple (Cymbals / Treble)
  // Ripples smoothly all the way to the ends of the canvas at 60 FPS
  // =========================================================================
  renderLiquidPulseWaves(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(w, h) * 0.56; // Ripples all the way to the canvas edges!

    // Spawn new pulse periodically or on bass peaks
    this.pulseTimer++;
    if (this.pulseTimer >= 26) {
      this.pulseTimer = 0;
      this.pulses.push({
        r: 6,
        maxR: maxR,
        speed: 2.4 + (this.smoothLow * 1.6 + this.smoothMid * 1.2 + this.smoothHigh * 1.0),
        // Sample ALL frequencies for this exact pulse:
        low: this.smoothLow,
        mid: this.smoothMid,
        high: this.smoothHigh,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Central Vibrating Liquid Reservoir (Core)
    const coreR = 16 + this.smoothLow * 18;
    // Central Red Droplet (Bass)
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(225, 29, 72, ${0.45 + this.smoothLow * 0.55})`;
    ctx.fill();

    // Central Blue Ring (Voice)
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(37, 99, 235, ${0.5 + this.smoothMid * 0.5})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Central Purple Corona (Treble)
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 1.15, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(147, 51, 234, ${0.4 + this.smoothHigh * 0.6})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Render active liquid pulses traveling outward
    for (let p = this.pulses.length - 1; p >= 0; p--) {
      const pulse = this.pulses[p];
      pulse.r += pulse.speed;

      if (pulse.r >= pulse.maxR) {
        this.pulses.splice(p, 1);
        continue;
      }

      const progress = pulse.r / pulse.maxR;
      const fade = Math.pow(1.0 - progress, 0.7); // Gentle fade out as it reaches the ends
      const thickness = 14 + progress * 40;
      const points = 72; // Smooth 72-point liquid contour for high 60fps performance

      // 1. INNER LIQUID LAYER (Warm Red - Bass)
      ctx.beginPath();
      const rInner = Math.max(8, pulse.r - thickness * 0.45);
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = Math.sin(angle * 4 + pulse.phase + this.time * 1.5) * (3 + pulse.low * 6);
        const curR = rInner + wobble;
        const x = cx + curR * Math.cos(angle);
        const y = cy + curR * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(225, 29, 72, ${fade * (0.35 + pulse.low * 0.55)})`;
      ctx.lineWidth = 3 + pulse.low * 4 * (1 - progress);
      ctx.stroke();

      // 2. MIDDLE LIQUID BODY (Electric Blue - Vocals & Melodies)
      ctx.beginPath();
      const rMid = pulse.r;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = Math.sin(angle * 6 - pulse.phase + this.time * 2.0) * (4 + pulse.mid * 7);
        const curR = rMid + wobble;
        const x = cx + curR * Math.cos(angle);
        const y = cy + curR * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(37, 99, 235, ${fade * (0.35 + pulse.mid * 0.55)})`;
      ctx.lineWidth = 2.5 + pulse.mid * 3.5;
      ctx.stroke();

      // 3. OUTER WAVE CREST (Radiant Purple - Treble & Cymbals)
      ctx.beginPath();
      const rOuter = pulse.r + thickness * 0.45;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = Math.cos(angle * 8 + pulse.phase * 1.5 + this.time * 2.8) * (3 + pulse.high * 5);
        const curR = rOuter + wobble;
        const x = cx + curR * Math.cos(angle);
        const y = cy + curR * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(147, 51, 234, ${fade * (0.35 + pulse.high * 0.55)})`;
      ctx.lineWidth = 2 + pulse.high * 2.5;
      ctx.stroke();
    }
  }

  // =========================================================================
  // PATTERN 2: Chladni Nodes on White Canvas
  // =========================================================================
  renderChladniNodes(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.43;

    ctx.save();
    ctx.translate(cx, cy);

    const steps = 360;

    // 1. Red Bass Boundary Curve
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const wave = Math.cos(3 * angle + this.time * 0.8) * (this.smoothLow * 0.22);
      const r = maxR * (0.85 + wave);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(225, 29, 72, ${0.45 + this.smoothLow * 0.55})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 2. Blue Mid-Frequency Nodal Curves
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h1 = Math.cos(5 * angle - this.time * 1.2);
      const h2 = Math.sin(4 * angle + this.time * 0.6);
      const r = maxR * (0.48 + (h1 * h2) * (0.2 + this.smoothMid * 0.25));
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(37, 99, 235, ${0.5 + this.smoothMid * 0.5})`;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 3. Purple High Harmonic Rings
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h3 = Math.sin(7 * angle + this.time * 2.0) * (0.15 + this.smoothHigh * 0.2);
      const r = maxR * (0.24 + h3);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(147, 51, 234, ${0.45 + this.smoothHigh * 0.55})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // PATTERN 3: Harmonic Spiral (Liquid Dyed Particles)
  // =========================================================================
  renderHarmonicSpiral(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.44;
    const totalParticles = 180;

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < totalParticles; i++) {
      const ratio = i / totalParticles;
      const angle = ratio * Math.PI * 12 + this.time * 0.8;
      const baseR = Math.pow(ratio, 0.75) * maxR;

      let pColor, pRadius, energy;
      if (ratio < 0.33) {
        energy = this.smoothLow;
        pColor = `rgba(225, 29, 72, ${0.5 + energy * 0.5})`;
        pRadius = 3.0 + energy * 3.5;
      } else if (ratio < 0.68) {
        energy = this.smoothMid;
        pColor = `rgba(37, 99, 235, ${0.5 + energy * 0.5})`;
        pRadius = 2.5 + energy * 3.0;
      } else {
        energy = this.smoothHigh;
        pColor = `rgba(147, 51, 234, ${0.5 + energy * 0.5})`;
        pRadius = 2.0 + energy * 2.5;
      }

      const wave = Math.sin(ratio * 18 - this.time * 3) * (5 + energy * 8);
      const r = baseR + wave;
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(x, y, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = pColor;
      ctx.fill();
    }

    ctx.restore();
  }

  // =========================================================================
  // PATTERN 4: Frequency Spectrum EQ on Clean White
  // =========================================================================
  renderFrequencySpectrum(w, h) {
    const ctx = this.ctx;
    const bars = 48;
    const padding = 35;
    const barWidth = (w - padding * 2) / bars;
    const baseH = h - 45;

    for (let i = 0; i < bars; i++) {
      const x = padding + i * barWidth;
      const ratio = i / bars;
      const freq = 30 + Math.pow(ratio, 1.8) * 3800;

      let hex, energy;
      if (freq <= 200) {
        hex = '#dc2626';
        energy = this.smoothLow;
      } else if (freq <= 1000) {
        hex = '#2563eb';
        energy = this.smoothMid;
      } else {
        hex = '#9333ea';
        energy = this.smoothHigh;
      }

      let amp = 0.2;
      if (this.dataArray && (this.isMicActive || this.isPlayingAudio)) {
        const fftIdx = Math.min(this.bufferLength - 1, Math.floor(ratio * (this.bufferLength * 0.75)));
        amp = (this.dataArray[fftIdx] || 10) / 255.0;
      } else {
        const wave = Math.sin(i * 0.35 + this.time * 3) * 0.25 + 0.4;
        amp = wave * (0.3 + energy * 0.7);
      }

      const barHeight = Math.max(8, amp * (h * 0.65));
      const y = baseH - barHeight;

      ctx.fillStyle = hex;
      ctx.fillRect(x, y, barWidth - 3, barHeight);

      // Top peak cap
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y - 3, barWidth - 3, 2);
    }
  }

  // =========================================================================
  // PATTERN 5: Pixelblaze 2D LED Matrix on Clean Light Panel
  // =========================================================================
  renderPixelblazeMatrix(w, h) {
    const ctx = this.ctx;
    const cols = 24;
    const rows = 12;
    const padX = 40;
    const padY = 35;
    const gridW = w - padX * 2;
    const gridH = h - padY * 2;
    const cellW = gridW / cols;
    const cellH = gridH / rows;

    for (let c = 0; c < cols; c++) {
      let rgb, energy;
      if (c < 8) {
        rgb = '225, 29, 72'; // Red
        energy = this.smoothLow;
      } else if (c < 16) {
        rgb = '37, 99, 235'; // Blue
        energy = this.smoothMid;
      } else {
        rgb = '147, 51, 234'; // Purple
        energy = this.smoothHigh;
      }

      for (let r = 0; r < rows; r++) {
        const x = padX + c * cellW + cellW * 0.5;
        const y = padY + (rows - 1 - r) * cellH + cellH * 0.5;

        const normR = r / rows;
        const phase = Math.sin(c * 0.45 + this.time * 3.5) * 0.3 + 0.5;
        const intensity = Math.max(0.08, (energy * 1.1 + phase * 0.4) - normR * 0.7);

        ctx.beginPath();
        const dotRadius = Math.min(cellW, cellH) * (0.22 + Math.min(0.28, intensity * 0.25));
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);

        if (intensity > 0.35) {
          ctx.fillStyle = `rgba(${rgb}, ${Math.min(1.0, intensity * 1.1)})`;
        } else {
          ctx.fillStyle = '#e2e8f0'; // Light grey inactive LED socket
        }
        ctx.fill();
      }
    }
  }

  // =========================================================================
  // PATTERN 6: Lissajous Resonance Scope
  // =========================================================================
  renderLissajousScope(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const scaleX = w * 0.36;
    const scaleY = h * 0.34;

    ctx.save();
    ctx.translate(cx, cy);

    const steps = 360;
    const delta = this.time * 1.2;

    // 1. Red Low Phase Curve
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = scaleX * Math.sin(2 * t + delta) * (0.75 + this.smoothLow * 0.25);
      const y = scaleY * Math.sin(3 * t) * (0.75 + this.smoothLow * 0.25);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(225, 29, 72, ${0.5 + this.smoothLow * 0.5})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 2. Blue Mid Phase Ribbon
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = (scaleX * 0.85) * Math.sin(3 * t + delta * 1.3);
      const y = (scaleY * 0.85) * Math.sin(4 * t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(37, 99, 235, ${0.5 + this.smoothMid * 0.5})`;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 3. Purple High Phase Ribbon
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = (scaleX * 0.65) * Math.sin(5 * t + delta * 1.8);
      const y = (scaleY * 0.65) * Math.sin(6 * t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(147, 51, 234, ${0.45 + this.smoothHigh * 0.55})`;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.restore();
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new SoundLightVisualizer('cymaticsCanvas');
});
