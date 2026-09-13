/**
 * CYMASPACE - Interactive Cymatics Sound Visualizer
 * Simulates Chladni resonance patterns & Web Audio frequency synthesis
 */

class CymaticsVisualizer {
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
    this.frequency = 432;
    this.mode = 'cymatics'; // 'cymatics', 'waveform', 'spectrum'
    this.time = 0;

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
      this.analyser.fftSize = 256;
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0.08; // Comfortable gentle volume
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
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
    this.frequency = freq;
    if (this.oscillator && this.audioCtx) {
      this.oscillator.frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.05);
    }
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
        console.warn('Microphone access denied or unavailable', err);
        alert('Microphone permission was not granted. Using internal sound synthesizer.');
        return false;
      }
    }
  }

  initControls() {
    const toneBtn = document.getElementById('vizToneBtn');
    const micBtn = document.getElementById('vizMicBtn');
    const freqSlider = document.getElementById('vizFreqSlider');
    const freqDisplay = document.getElementById('vizFreqVal');
    const modeBtns = document.querySelectorAll('[data-viz-mode]');

    if (toneBtn) {
      toneBtn.addEventListener('click', () => {
        const active = this.toggleAudioTone();
        toneBtn.classList.toggle('active', active);
        toneBtn.setAttribute('aria-pressed', active);
        toneBtn.querySelector('.btn-text').textContent = active ? 'Stop Tone' : 'Play Tone';
      });
    }

    if (micBtn) {
      micBtn.addEventListener('click', async () => {
        const active = await this.toggleMic();
        micBtn.classList.toggle('active', active);
        micBtn.setAttribute('aria-pressed', active);
        micBtn.querySelector('.btn-text').textContent = active ? 'Mic Active' : 'Live Mic';
      });
    }

    if (freqSlider && freqDisplay) {
      freqSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        freqDisplay.textContent = `${val} Hz`;
        this.setFrequency(val);
      });
    }

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.mode = btn.getAttribute('data-viz-mode');
      });
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.time += 0.02;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Dark background fade for trailing effect in resonant chamber
    ctx.fillStyle = 'rgba(15, 3, 7, 0.28)';
    ctx.fillRect(0, 0, w, h);

    // Render depending on mode
    if (this.mode === 'cymatics') {
      this.renderCymaticPlate(w, h);
    } else if (this.mode === 'waveform') {
      this.renderWaveform(w, h);
    } else if (this.mode === 'spectrum') {
      this.renderSpectrum(w, h);
    }
  }

  renderCymaticPlate(w, h) {
    const ctx = this.ctx;
    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = Math.min(w, h) * 0.42;

    // Frequency harmonic orders m and n based on slider frequency
    const m = 2 + Math.floor((this.frequency / 100) % 5);
    const n = 3 + Math.floor((this.frequency / 70) % 6);

    ctx.save();
    ctx.translate(centerX, centerY);

    // Plate Boundary Circle
    ctx.beginPath();
    ctx.arc(0, 0, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 77, 109, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Secondary subtle boundary rings
    ctx.beginPath();
    ctx.arc(0, 0, maxRadius * 0.65, 0, Math.PI * 2);
    ctx.arc(0, 0, maxRadius * 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    // Geometric Chladni nodal curves (Ruby Red)
    const petals = m * 2;
    const steps = 360;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const harmonic1 = Math.cos(m * angle + this.time);
      const harmonic2 = Math.sin(n * angle - this.time * 0.7);
      const radius = maxRadius * (0.5 + 0.35 * harmonic1 * harmonic2);

      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ff2d55';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255, 45, 85, 0.8)';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Cross nodal ring (Crisp White & Crimson Harmonics)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h3 = Math.sin((m + 1) * angle + this.time * 1.2);
      const radius = maxRadius * (0.3 + 0.25 * h3);

      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Pulsing core node (Signature CymaSpace Crimson)
    const corePulse = Math.sin(this.time * 3) * 6 + 12;
    ctx.beginPath();
    ctx.arc(0, 0, corePulse, 0, Math.PI * 2);
    ctx.fillStyle = '#c30443';
    ctx.shadowColor = 'rgba(255, 45, 85, 1)';
    ctx.shadowBlur = 16;
    ctx.fill();

    ctx.restore();
  }

  renderWaveform(w, h) {
    const ctx = this.ctx;
    const centerY = h / 2;

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff2d55';
    ctx.shadowColor = 'rgba(255, 45, 85, 0.8)';
    ctx.shadowBlur = 10;

    const points = 200;
    for (let i = 0; i < points; i++) {
      const x = (i / points) * w;
      const freqFactor = (this.frequency / 200) * 8;
      const wave = Math.sin((i * 0.08 * freqFactor) + this.time * 4) * Math.cos(i * 0.02 + this.time);
      const y = centerY + wave * (h * 0.25);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  renderSpectrum(w, h) {
    const ctx = this.ctx;
    const bars = 48;
    const barWidth = (w - 80) / bars;

    for (let i = 0; i < bars; i++) {
      const x = 40 + i * barWidth;
      const factor = Math.sin(i * 0.2 + this.time * 2) * Math.cos(i * 0.35 + (this.frequency / 100));
      const barHeight = Math.max(8, Math.abs(factor) * (h * 0.65));
      const y = h - 40 - barHeight;

      const grad = ctx.createLinearGradient(0, y, 0, h - 40);
      grad.addColorStop(0, '#ff4d6d');
      grad.addColorStop(0.5, '#e11d48');
      grad.addColorStop(1, '#c30443');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth - 3, barHeight);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CymaticsVisualizer('cymaticsCanvas');
});
