/**
 * CYMASPACE - Sound-to-Light Frequency Visualizer
 * Fully overhauled to:
 * - Use ALL frequencies simultaneously (Low = Red, Mid = Blue, High = Purple)
 * - Provide butter-smooth temporal animation without skipping or jittering
 * - Decompose audio in real time across 3 frequency bands
 * - Support Pixelblaze animation patterns with layered tri-band color physics
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

    // Multi-oscillator synthesizer for rich composite sounds
    this.oscillators = [];
    this.isPlayingAudio = false;
    this.isMicActive = false;

    // Frequency state (Hz)
    this.sliderFreq = 440;
    this.soundMode = 'all'; // 'all', 'bass', 'mid', 'high'

    // Real-time smoothed frequency band energies (0.0 to 1.0)
    this.smoothLow = 0.45;   // 0 - 200 Hz (Red)
    this.smoothMid = 0.55;   // 200 - 1000 Hz (Blue)
    this.smoothHigh = 0.40;  // 1000+ Hz (Purple)

    // Pixelblaze pattern: 'pulse', 'chladni', 'spiral', 'spectrum', 'matrix', 'lissajous'
    this.animation = 'pulse';
    this.time = 0;

    // Audio FFT buffers
    this.bufferLength = 0;
    this.dataArray = null;

    // Pulse wave particles buffer for multi-band concentric rings
    this.wavefronts = [];

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
      // Tri-Band Composite Chord: Low bass (80Hz), Mid voice (440Hz), High overtone (2400Hz)
      const f1 = 80;
      const f2 = 440;
      const f3 = 2400;

      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const osc3 = this.audioCtx.createOscillator();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(f1, now);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(f2, now);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(f3, now);

      const g1 = this.audioCtx.createGain();
      const g2 = this.audioCtx.createGain();
      const g3 = this.audioCtx.createGain();
      g1.gain.value = 0.5;
      g2.gain.value = 0.35;
      g3.gain.value = 0.15;

      osc1.connect(g1); g1.connect(this.gainNode);
      osc2.connect(g2); g2.connect(this.gainNode);
      osc3.connect(g3); g3.connect(this.gainNode);

      osc1.start(); osc2.start(); osc3.start();
      this.oscillators = [osc1, osc2, osc3];
    } else {
      // Single band focus with gentle harmonics
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
        alert('Microphone access was denied. You can explore all frequency color animations using the sound buttons and presets below!');
      }
    }
  }

  setSliderFrequency(freq) {
    this.sliderFreq = freq;
    const freqDisplay = document.getElementById('vizFreqVal');
    if (freqDisplay) freqDisplay.textContent = `${Math.round(freq)} Hz`;

    // If currently playing a single oscillator, update frequency seamlessly
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
   * Analyzes the real incoming FFT energy across 3 distinct continuous bands:
   * 0 - 200 Hz   -> Low (Red)
   * 200 - 1000 Hz -> Mid (Blue)
   * 1000+ Hz      -> High (Purple)
   * Applies smooth exponential filtering to eliminate jitter and skipping.
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

      rawLow = countLow > 0 ? (sumLow / countLow) : 0;
      rawMid = countMid > 0 ? (sumMid / countMid) : 0;
      rawHigh = countHigh > 0 ? (sumHigh / countHigh) : 0;
    } else {
      // Natural, organic simulation wave when audio is idle
      const t = this.time;
      if (this.soundMode === 'all') {
        rawLow = 0.35 + Math.sin(t * 1.5) * 0.25;
        rawMid = 0.45 + Math.cos(t * 2.1) * 0.30;
        rawHigh = 0.30 + Math.sin(t * 3.4) * 0.20;
      } else if (this.soundMode === 'bass' || this.sliderFreq <= 200) {
        rawLow = 0.75 + Math.sin(t * 3.0) * 0.2;
        rawMid = 0.20 + Math.sin(t * 1.5) * 0.1;
        rawHigh = 0.10;
      } else if (this.soundMode === 'mid' || (this.sliderFreq > 200 && this.sliderFreq <= 1000)) {
        rawLow = 0.20;
        rawMid = 0.80 + Math.sin(t * 2.5) * 0.15;
        rawHigh = 0.25 + Math.cos(t * 2.0) * 0.1;
      } else {
        rawLow = 0.15;
        rawMid = 0.25;
        rawHigh = 0.80 + Math.sin(t * 4.0) * 0.15;
      }
    }

    // Smooth Exponential Moving Average (Attack / Decay)
    const smoothFactor = 0.18;
    this.smoothLow = this.smoothLow * (1 - smoothFactor) + rawLow * smoothFactor;
    this.smoothMid = this.smoothMid * (1 - smoothFactor) + rawMid * smoothFactor;
    this.smoothHigh = this.smoothHigh * (1 - smoothFactor) + rawHigh * smoothFactor;

    // Update Tri-Band Meters in UI
    const meterRed = document.getElementById('meterRed');
    const meterBlue = document.getElementById('meterBlue');
    const meterPurple = document.getElementById('meterPurple');

    if (meterRed) meterRed.style.width = `${Math.min(100, Math.max(8, this.smoothLow * 120))}%`;
    if (meterBlue) meterBlue.style.width = `${Math.min(100, Math.max(8, this.smoothMid * 120))}%`;
    if (meterPurple) meterPurple.style.width = `${Math.min(100, Math.max(8, this.smoothHigh * 120))}%`;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.time += 0.025;

    this.updateFrequencyEnergies();

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear with elegant translucent dark stage fade for light persistence
    ctx.fillStyle = 'rgba(8, 12, 22, 0.24)';
    ctx.fillRect(0, 0, w, h);

    switch (this.animation) {
      case 'pulse':
        this.renderPulseWaves(w, h);
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
        this.renderPulseWaves(w, h);
        break;
    }
  }

  // =========================================================================
  // PATTERN 1: Multi-Band Concentric Pulse Waves
  // Renders all 3 frequency bands simultaneously:
  // - Inner heavy crimson rings react to Bass (Low)
  // - Middle azure rings react to Melody & Vocals (Mid)
  // - Outer violet ripples react to Cymbals & Treble (High)
  // =========================================================================
  renderPulseWaves(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.44;

    ctx.save();

    // 1. LOW FREQUENCY LAYER (Red Bass Waves)
    const bassCount = 4;
    for (let i = 0; i < bassCount; i++) {
      const progress = ((this.time * 0.6 + i / bassCount) % 1);
      const r = progress * (maxR * 0.55);
      const alpha = Math.sin(progress * Math.PI) * (0.4 + this.smoothLow * 0.6);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.lineWidth = 3 + this.smoothLow * 5 * (1 - progress);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 16 * this.smoothLow;
      ctx.stroke();
    }

    // 2. MIDDLE FREQUENCY LAYER (Electric Blue Melodic Waves)
    const midCount = 5;
    for (let i = 0; i < midCount; i++) {
      const progress = ((this.time * 0.9 + (i + 0.5) / midCount) % 1);
      const r = (0.2 + progress * 0.6) * maxR;
      const alpha = Math.sin(progress * Math.PI) * (0.35 + this.smoothMid * 0.65);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(37, 99, 235, ${alpha})`;
      ctx.lineWidth = 2.5 + this.smoothMid * 3.5 * (1 - progress);
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 14 * this.smoothMid;
      ctx.stroke();
    }

    // 3. HIGH FREQUENCY LAYER (Luminous Purple Treble Wavefronts)
    const highCount = 6;
    for (let i = 0; i < highCount; i++) {
      const progress = ((this.time * 1.3 + i / highCount) % 1);
      const r = (0.45 + progress * 0.55) * maxR;
      const alpha = Math.sin(progress * Math.PI) * (0.3 + this.smoothHigh * 0.7);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
      ctx.lineWidth = 1.5 + this.smoothHigh * 2;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12 * this.smoothHigh;
      ctx.stroke();
    }

    // Center Tri-Color Core Pulse
    const coreR = 12 + this.smoothLow * 14;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 20;
    ctx.fill();

    const midRing = coreR * (0.6 + this.smoothMid * 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, midRing, 0, Math.PI * 2);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // PATTERN 2: Chladni Nodes (Standing Wave Resonator)
  // Lows drive plate diameter and core red standing wave.
  // Mids drive secondary blue harmonic nodal curves.
  // Highs drive high-order purple resonance petals and nodal particles.
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
    const m = 3;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const wave = Math.cos(m * angle + this.time * 0.8) * (this.smoothLow * 0.25);
      const r = maxR * (0.8 + wave);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + this.smoothLow * 0.6})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 14;
    ctx.stroke();

    // 2. Blue Mid-Frequency Nodal Curves
    const n = 5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h1 = Math.cos(n * angle - this.time * 1.2);
      const h2 = Math.sin((n - 1) * angle + this.time * 0.5);
      const r = maxR * (0.45 + (h1 * h2) * (0.2 + this.smoothMid * 0.25));
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.5 + this.smoothMid * 0.5})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // 3. Purple High-Frequency Harmonic Overtone Rings
    const k = 7;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h3 = Math.sin(k * angle + this.time * 2.0) * (0.15 + this.smoothHigh * 0.2);
      const r = maxR * (0.22 + h3);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(168, 85, 247, ${0.4 + this.smoothHigh * 0.6})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // PATTERN 3: Harmonic Spiral (Tri-Band Orbital Particles)
  // Inner particles = Red (Bass), Middle = Blue (Vocals), Outer = Purple (Treble)
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
        // Low Band (Red)
        energy = this.smoothLow;
        pColor = `rgba(239, 68, 68, ${0.4 + energy * 0.6})`;
        pRadius = 2.5 + energy * 3.5;
      } else if (ratio < 0.68) {
        // Mid Band (Blue)
        energy = this.smoothMid;
        pColor = `rgba(59, 130, 246, ${0.4 + energy * 0.6})`;
        pRadius = 2.0 + energy * 3.0;
      } else {
        // High Band (Purple)
        energy = this.smoothHigh;
        pColor = `rgba(168, 85, 247, ${0.4 + energy * 0.6})`;
        pRadius = 1.8 + energy * 2.8;
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
  // PATTERN 4: Real-Time Spectrum EQ
  // 0 - 200 Hz: Red bars
  // 200 - 1000 Hz: Blue bars
  // 1000+ Hz: Purple bars
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
      // Map 0 to 1 across 30Hz to 3800Hz
      const freq = 30 + Math.pow(ratio, 1.8) * 3800;

      let barColor, energy;
      if (freq <= 200) {
        barColor = { hex: '#ef4444', r: 239, g: 68, b: 68 };
        energy = this.smoothLow;
      } else if (freq <= 1000) {
        barColor = { hex: '#3b82f6', r: 59, g: 130, b: 246 };
        energy = this.smoothMid;
      } else {
        barColor = { hex: '#a855f7', r: 168, g: 85, b: 247 };
        energy = this.smoothHigh;
      }

      // Height influenced by real FFT or smoothed band
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

      const grad = ctx.createLinearGradient(0, y, 0, baseH);
      grad.addColorStop(0, barColor.hex);
      grad.addColorStop(1, `rgba(${barColor.r}, ${barColor.g}, ${barColor.b}, 0.2)`);

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth - 3, barHeight);

      // White peak indicator
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - 2, barWidth - 3, 2);
    }
  }

  // =========================================================================
  // PATTERN 5: Pixelblaze 2D LED Matrix
  // Columns partitioned into 3 color zones:
  // - Columns 0 - 7:   Red LEDs (Low Bass)
  // - Columns 8 - 15:  Blue LEDs (Mid Vocals)
  // - Columns 16 - 23: Purple LEDs (High Treble)
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
      let zoneColor, energy;
      if (c < 8) {
        zoneColor = { hex: '#ef4444', r: 239, g: 68, b: 68 };
        energy = this.smoothLow;
      } else if (c < 16) {
        zoneColor = { hex: '#3b82f6', r: 59, g: 130, b: 246 };
        energy = this.smoothMid;
      } else {
        zoneColor = { hex: '#a855f7', r: 168, g: 85, b: 247 };
        energy = this.smoothHigh;
      }

      for (let r = 0; r < rows; r++) {
        const x = padX + c * cellW + cellW * 0.5;
        const y = padY + (rows - 1 - r) * cellH + cellH * 0.5;

        // Sound intensity flowing upward
        const normR = r / rows;
        const phase = Math.sin(c * 0.45 + this.time * 3.5) * 0.3 + 0.5;
        const intensity = Math.max(0.08, (energy * 1.1 + phase * 0.4) - normR * 0.7);

        ctx.beginPath();
        const dotRadius = Math.min(cellW, cellH) * (0.18 + Math.min(0.3, intensity * 0.25));
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);

        if (intensity > 0.35) {
          ctx.fillStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${Math.min(1.0, intensity)})`;
          ctx.shadowColor = zoneColor.hex;
          ctx.shadowBlur = intensity * 10;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
    }
  }

  // =========================================================================
  // PATTERN 6: Lissajous Resonance Scope
  // Composite phase resonance ribbon combining Red, Blue, and Purple harmonics
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

    // 1. Red Base Curve (Lows)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = scaleX * Math.sin(2 * t + delta) * (0.7 + this.smoothLow * 0.3);
      const y = scaleY * Math.sin(3 * t) * (0.7 + this.smoothLow * 0.3);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + this.smoothLow * 0.6})`;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 14;
    ctx.stroke();

    // 2. Blue Mid Harmonic Ribbon (Mids)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = (scaleX * 0.85) * Math.sin(3 * t + delta * 1.3);
      const y = (scaleY * 0.85) * Math.sin(4 * t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.45 + this.smoothMid * 0.55})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // 3. Purple High Transient Ribbon (Highs)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = (scaleX * 0.65) * Math.sin(5 * t + delta * 1.8);
      const y = (scaleY * 0.65) * Math.sin(6 * t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(168, 85, 247, ${0.4 + this.smoothHigh * 0.6})`;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.restore();
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new SoundLightVisualizer('cymaticsCanvas');
});
