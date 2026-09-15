/**
 * CYMASPACE - Sound-to-Light Frequency Visualizer
 * Overhauled with:
 * - Pixelblaze-style animation pattern selection
 * - Dynamic color mapping by detected audio frequency:
 *     0 - 200 Hz   (Low):    Red colors
 *     200 - 1000 Hz (Middle): Blue colors
 *     1000+ Hz      (High):   Purple colors
 * - Multi-band spectral reactivity and Web Audio API live microphone analysis
 */

class SoundLightVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.audioCtx = null;
    this.oscillator = null;
    this.analyser = null;
    this.gainNode = null;
    this.micStream = null;

    this.isPlayingAudio = false;
    this.isMicActive = false;
    this.frequency = 120; // Starts in Low (Red) range
    this.animation = 'pulse'; // 'pulse', 'chladni', 'spiral', 'spectrum', 'matrix', 'lissajous'
    this.time = 0;

    // FFT data buffer
    this.dataArray = null;
    this.bufferLength = 0;

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
    this.initControls();
    this.updateFrequencyDisplay(this.frequency);
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
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.82;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0.08; // Pleasant listening volume
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Translates frequency (Hz) into colors according to user specification:
   * 0 - 200 Hz (Low): Red colors
   * 200 - 1000 Hz (Middle): Blue colors
   * 1000+ Hz (High): Purple colors
   */
  getFrequencyColor(freq, alpha = 1.0) {
    let r = 239, g = 68, b = 68; // Default Red (low)

    if (freq <= 200) {
      // 0 - 200 Hz: Pure warm reds
      // 40Hz -> deep crimson (#dc2626), 200Hz -> bright red (#ef4444)
      const t = Math.max(0, Math.min(1, (freq - 40) / 160));
      r = Math.round(220 + t * (239 - 220));
      g = Math.round(38 + t * (68 - 38));
      b = Math.round(38 + t * (68 - 38));
    } else if (freq <= 1000) {
      // 200 - 1000 Hz: Middle frequency - Pure Electric Blues
      // Rapid boundary blend at 200-240Hz, then solid rich electric blue across the band
      if (freq < 240) {
        const t = (freq - 200) / 40;
        r = Math.round(239 * (1 - t) + 30 * t);
        g = Math.round(68 * (1 - t) + 100 * t);
        b = Math.round(68 * (1 - t) + 235 * t);
      } else {
        const t = (freq - 240) / 760;
        // From 240Hz (#1e40af / #2563eb) to 1000Hz (#3b82f6 / #0284c7)
        r = Math.round(30 + t * (59 - 30));
        g = Math.round(100 + t * (130 - 100));
        b = Math.round(235 + t * (246 - 235));
      }
    } else {
      // 1000+ Hz: High frequency - Radiant Purple / Violet
      // 1000Hz (blue) -> 1300Hz+ (rich luminous purple #9333ea / #a855f7)
      const t = Math.min(1, (freq - 1000) / 600);
      r = Math.round(59 * (1 - t) + 168 * t);
      g = Math.round(130 * (1 - t) + 85 * t);
      b = Math.round(246 * (1 - t) + 247 * t);
    }

    return {
      rgba: `rgba(${r}, ${g}, ${b}, ${alpha})`,
      hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
      r, g, b
    };
  }

  getFrequencyCategory(freq) {
    if (freq <= 200) {
      return { label: 'Low Frequency', colorName: 'Warm Red', zoneClass: 'preset-red' };
    } else if (freq <= 1000) {
      return { label: 'Middle Frequency', colorName: 'Electric Blue', zoneClass: 'preset-blue' };
    } else {
      return { label: 'High Frequency', colorName: 'Luminous Purple', zoneClass: 'preset-purple' };
    }
  }

  toggleAudioTone() {
    this.initAudioContext();

    if (this.isPlayingAudio) {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }
      this.isPlayingAudio = false;
      return false;
    } else {
      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(this.frequency, this.audioCtx.currentTime);
      this.oscillator.connect(this.gainNode);
      this.oscillator.start();
      this.isPlayingAudio = true;
      return true;
    }
  }

  setFrequency(freq) {
    this.frequency = Math.max(20, Math.min(4000, freq));
    if (this.oscillator && this.audioCtx) {
      this.oscillator.frequency.setTargetAtTime(this.frequency, this.audioCtx.currentTime, 0.05);
    }
    this.updateFrequencyDisplay(this.frequency);
  }

  async toggleMic() {
    this.initAudioContext();

    if (this.isMicActive) {
      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
        this.micStream = null;
      }
      this.isMicActive = false;
      return false;
    } else {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = this.audioCtx.createMediaStreamSource(this.micStream);
        source.connect(this.analyser);
        this.isMicActive = true;
        return true;
      } catch (err) {
        console.warn('Microphone permission not granted or unavailable:', err);
        alert('Microphone access was denied. You can still use the audio tone generator and frequency slider to explore.');
        return false;
      }
    }
  }

  updateFrequencyDisplay(freq) {
    const freqDisplay = document.getElementById('vizFreqVal');
    const statusPillText = document.getElementById('vizFreqStatusText');
    const statusIndicator = document.getElementById('vizStatusIndicator');
    const hudZoneText = document.getElementById('hudZoneText');
    const slider = document.getElementById('vizFreqSlider');

    if (slider && parseInt(slider.value, 10) !== Math.round(freq)) {
      slider.value = Math.round(freq);
    }

    if (freqDisplay) {
      freqDisplay.textContent = `${Math.round(freq)} Hz`;
    }

    const cat = this.getFrequencyCategory(freq);
    const color = this.getFrequencyColor(freq, 1.0);

    if (statusPillText) {
      statusPillText.textContent = `${Math.round(freq)} Hz • ${cat.label} (${cat.colorName})`;
    }

    if (statusIndicator) {
      statusIndicator.style.backgroundColor = color.hex;
      statusIndicator.style.boxShadow = `0 0 10px ${color.hex}`;
    }

    if (hudZoneText) {
      hudZoneText.textContent = `${cat.label} → ${cat.colorName}`;
      hudZoneText.parentElement.style.borderColor = color.hex;
    }

    // Highlight active preset button if applicable
    const presetBtns = document.querySelectorAll('.freq-preset-btn');
    presetBtns.forEach(btn => {
      const pFreq = parseInt(btn.getAttribute('data-freq'), 10);
      btn.classList.toggle('active', Math.abs(pFreq - freq) < 40);
    });
  }

  initControls() {
    const toneBtn = document.getElementById('vizToneBtn');
    const micBtn = document.getElementById('vizMicBtn');
    const freqSlider = document.getElementById('vizFreqSlider');
    const animBtns = document.querySelectorAll('[data-viz-anim]');
    const presetBtns = document.querySelectorAll('.freq-preset-btn');

    if (toneBtn) {
      toneBtn.addEventListener('click', () => {
        const active = this.toggleAudioTone();
        toneBtn.classList.toggle('active', active);
        toneBtn.setAttribute('aria-pressed', active);
        const textSpan = toneBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = active ? 'Stop Tone' : 'Play Tone';
      });
    }

    if (micBtn) {
      micBtn.addEventListener('click', async () => {
        const active = await this.toggleMic();
        micBtn.classList.toggle('active', active);
        micBtn.setAttribute('aria-pressed', active);
        const textSpan = micBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = active ? 'Mic Active' : 'Live Mic';
      });
    }

    if (freqSlider) {
      freqSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setFrequency(val);
      });
    }

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetFreq = parseInt(btn.getAttribute('data-freq'), 10);
        this.setFrequency(targetFreq);
      });
    });

    // Pixelblaze Pattern Row Buttons
    animBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        animBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.animation = btn.getAttribute('data-viz-anim');
      });
    });
  }

  detectDominantPitch() {
    if (!this.analyser || !this.dataArray) return this.frequency;

    this.analyser.getByteFrequencyData(this.dataArray);
    let maxVal = -1;
    let maxIndex = -1;

    // Search for the dominant frequency bin
    for (let i = 1; i < this.bufferLength; i++) {
      if (this.dataArray[i] > maxVal) {
        maxVal = this.dataArray[i];
        maxIndex = i;
      }
    }

    // If there is meaningful volume signal (threshold)
    if (maxVal > 30) {
      const nyquist = this.audioCtx.sampleRate / 2;
      const detectedFreq = (maxIndex / this.bufferLength) * nyquist;
      // Smooth frequency tracking
      this.frequency = this.frequency * 0.85 + detectedFreq * 0.15;
      this.updateFrequencyDisplay(this.frequency);
    }
    return this.frequency;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.time += 0.025;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Detect pitch if live mic or audio active
    if (this.isMicActive || this.isPlayingAudio) {
      this.detectDominantPitch();
    }

    const currentFreq = this.frequency;
    const activeColor = this.getFrequencyColor(currentFreq, 1.0);

    // Subtle dark trail fade for fluid persistence
    ctx.fillStyle = 'rgba(9, 12, 20, 0.22)';
    ctx.fillRect(0, 0, w, h);

    // Render the active Pixelblaze animation pattern
    switch (this.animation) {
      case 'pulse':
        this.renderPulseWaves(w, h, currentFreq, activeColor);
        break;
      case 'chladni':
        this.renderChladniNodes(w, h, currentFreq, activeColor);
        break;
      case 'spiral':
        this.renderHarmonicSpiral(w, h, currentFreq, activeColor);
        break;
      case 'spectrum':
        this.renderFrequencySpectrum(w, h, currentFreq);
        break;
      case 'matrix':
        this.renderPixelblazeMatrix(w, h, currentFreq);
        break;
      case 'lissajous':
        this.renderLissajousScope(w, h, currentFreq, activeColor);
        break;
      default:
        this.renderPulseWaves(w, h, currentFreq, activeColor);
        break;
    }
  }

  // -------------------------------------------------------------
  // PATTERN 1: Concentric Pulse Waves
  // -------------------------------------------------------------
  renderPulseWaves(w, h, freq, color) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.46;
    const rings = 8;
    const speed = 0.8 + (freq / 400);

    ctx.save();
    for (let i = 0; i < rings; i++) {
      const progress = ((this.time * speed + i / rings) % 1);
      const r = progress * maxR;
      const alpha = Math.sin(progress * Math.PI) * 0.85;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = this.getFrequencyColor(freq, alpha).rgba;
      ctx.lineWidth = 2.5 + (1 - progress) * 3;
      ctx.shadowColor = color.hex;
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    // Central Resonant Core
    const corePulse = 14 + Math.sin(this.time * speed * 3) * 6;
    ctx.beginPath();
    ctx.arc(cx, cy, corePulse, 0, Math.PI * 2);
    ctx.fillStyle = color.hex;
    ctx.shadowBlur = 24;
    ctx.fill();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // PATTERN 2: Chladni Resonator Nodes
  // -------------------------------------------------------------
  renderChladniNodes(w, h, freq, color) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.44;

    // Geometric harmonic orders based on frequency
    const m = 2 + Math.floor((freq / 120) % 6);
    const n = 3 + Math.floor((freq / 90) % 7);

    ctx.save();
    ctx.translate(cx, cy);

    // Outer boundary ring
    ctx.beginPath();
    ctx.arc(0, 0, maxR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Primary harmonic curve
    const steps = 360;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h1 = Math.cos(m * angle + this.time);
      const h2 = Math.sin(n * angle - this.time * 0.8);
      const r = maxR * (0.52 + 0.38 * h1 * h2);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color.hex;
    ctx.lineWidth = 3;
    ctx.shadowColor = color.hex;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Secondary inner harmonic ring
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h3 = Math.sin((m + 1) * angle + this.time * 1.3);
      const r = maxR * (0.28 + 0.22 * h3);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // PATTERN 3: Harmonic Spiral
  // -------------------------------------------------------------
  renderHarmonicSpiral(w, h, freq, color) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const particles = 180;
    const maxR = Math.min(w, h) * 0.44;

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < particles; i++) {
      const ratio = i / particles;
      const angle = ratio * Math.PI * 12 + this.time * (1 + freq / 500);
      const r = Math.pow(ratio, 0.75) * maxR;

      const wave = Math.sin(ratio * 20 - this.time * 4) * 8;
      const x = (r + wave) * Math.cos(angle);
      const y = (r + wave) * Math.sin(angle);

      const dotColor = this.getFrequencyColor(freq, 0.3 + ratio * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + ratio * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = dotColor.rgba;
      ctx.shadowColor = color.hex;
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // PATTERN 4: Frequency Spectrum (Mapped to Red -> Blue -> Purple)
  // -------------------------------------------------------------
  renderFrequencySpectrum(w, h, activeFreq) {
    const ctx = this.ctx;
    const bars = 42;
    const padding = 30;
    const totalW = w - padding * 2;
    const barW = totalW / bars;
    const baseH = h - 50;

    for (let i = 0; i < bars; i++) {
      const x = padding + i * barW;
      // Map bar index to frequency across audible range (30 Hz to 3500 Hz)
      const binFreq = 30 + Math.pow(i / bars, 1.8) * 3500;
      const barColor = this.getFrequencyColor(binFreq, 1.0);

      // Height influenced by FFT data or simulation
      let amplitude = 0.2;
      if (this.dataArray && (this.isMicActive || this.isPlayingAudio)) {
        const fftIdx = Math.floor((i / bars) * (this.bufferLength * 0.75));
        amplitude = (this.dataArray[fftIdx] || 10) / 255;
      } else {
        // Natural sine simulation peaking near active frequency
        const freqDist = Math.abs(binFreq - activeFreq);
        const peakFactor = Math.exp(-Math.pow(freqDist / 250, 2));
        const wave = Math.sin(i * 0.35 + this.time * 3) * 0.25 + 0.45;
        amplitude = Math.min(1.0, wave * 0.4 + peakFactor * 0.65);
      }

      const barHeight = Math.max(8, amplitude * (h * 0.68));
      const y = baseH - barHeight;

      // Gradient for bar
      const grad = ctx.createLinearGradient(0, y, 0, baseH);
      grad.addColorStop(0, barColor.hex);
      grad.addColorStop(1, this.getFrequencyColor(binFreq, 0.25).rgba);

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW - 3, barHeight);

      // Peak dot
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - 3, barW - 3, 2);
    }
  }

  // -------------------------------------------------------------
  // PATTERN 5: Pixelblaze 2D LED Matrix
  // -------------------------------------------------------------
  renderPixelblazeMatrix(w, h, activeFreq) {
    const ctx = this.ctx;
    const cols = 24;
    const rows = 12;
    const padX = 40;
    const padY = 40;
    const gridW = w - padX * 2;
    const gridH = h - padY * 2;
    const cellW = gridW / cols;
    const cellH = gridH / rows;

    for (let c = 0; c < cols; c++) {
      // Columns map to frequencies from low (left) to high (right)
      const colFreq = 40 + (c / cols) * 3000;
      const cellColor = this.getFrequencyColor(colFreq, 1.0);

      for (let r = 0; r < rows; r++) {
        const x = padX + c * cellW + cellW * 0.5;
        const y = padY + (rows - 1 - r) * cellH + cellH * 0.5;

        // Wave energy flowing up
        const phase = Math.sin(c * 0.4 + this.time * 4) * Math.cos(r * 0.3 - this.time * 2);
        const activeHighlight = Math.exp(-Math.pow(Math.abs(colFreq - activeFreq) / 400, 2));
        const intensity = Math.max(0.12, (phase * 0.5 + 0.5) * 0.6 + activeHighlight * 0.4);

        ctx.beginPath();
        const dotRadius = Math.min(cellW, cellH) * (0.18 + intensity * 0.28);
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);

        if (intensity > 0.45) {
          ctx.fillStyle = this.getFrequencyColor(colFreq, intensity).rgba;
          ctx.shadowColor = cellColor.hex;
          ctx.shadowBlur = intensity * 10;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
    }
  }

  // -------------------------------------------------------------
  // PATTERN 6: Lissajous Harmonic Scope
  // -------------------------------------------------------------
  renderLissajousScope(w, h, freq, color) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const scaleX = w * 0.38;
    const scaleY = h * 0.36;

    // Harmonic frequency ratio
    const a = 2 + Math.floor((freq / 200) % 5);
    const b = 3 + Math.floor((freq / 350) % 4);
    const delta = this.time * 1.5;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = scaleX * Math.sin(a * t + delta);
      const y = scaleY * Math.sin(b * t);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = color.hex;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = color.hex;
    ctx.shadowBlur = 20;
    ctx.stroke();

    // Subtle ghosting inner ribbon
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = (scaleX * 0.85) * Math.sin(a * t + delta + 0.3);
      const y = (scaleY * 0.85) * Math.sin(b * t);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.stroke();

    ctx.restore();
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new SoundLightVisualizer('cymaticsCanvas');
});
