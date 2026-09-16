/**
 * CYMASPACE - Sound-to-Light Frequency Visualizer (White / Light Liquid Stage)
 * Features:
 * - Direct 0-255 Hue mapping across frequency range (Red at 0 Hz to Purple at Max Hz)
 * - 10 kHz default ceiling (optimized for consumer microphones with speech filters)
 * - Configurable range (10 kHz default, 15 kHz, 20 kHz studio) with mic advisory
 * - Continuous chromatic spectrum translation for Deaf and Hard of Hearing accessibility
 * - 60 FPS liquid wave simulation, Chladni nodal resonator, Harmonic Spiral,
 *   Spectrum EQ, Matrix, and Lissajous Scope
 * - Interactive Zoomable/Draggable Electromagnetic Spectrum vs. Acoustic Sound Waves Canvas
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

    // Multi-oscillator audio synthesizer & rock band demo sequencer
    this.oscillators = [];
    this.isPlayingAudio = false;
    this.isMicActive = false;
    this.isUploadedPlaying = false;
    this.uploadedMedia = null;
    this.uploadedSourceNode = null;
    this.uploadedFileUrl = null;
    this.rockDemoTimer = null;
    this.rockStep = 0;
    this.activeRockNodes = [];
    this.noiseBuffer = null;
    this.rockCompressor = null;
    this.guitarDistortion = null;

    // Default max frequency ceiling is 10 kHz (standard consumer mics roll off above 8-10 kHz)
    this.maxFreq = 10000;
    this.activeFreq = 0;
    this.activeHue = 0;
    this.currentEnergy = 0.03; // Baseline ambient silence
    this.prevEnergy = 0.03;

    // Animation pattern: 'pulse', 'chladni', 'spiral', 'spectrum', 'matrix', 'lissajous'
    this.animation = 'pulse';
    this.time = 0;

    // Audio FFT buffers
    this.bufferLength = 0;
    this.dataArray = null;

    // Liquid pulse wave pool
    this.pulses = [];
    this.pulseTimer = 0;

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
    this.initControls();
    this.updateScaleLabels();
    this.animate();
  }

  // =========================================================================
  // Core Mapping: 0 Hz - Max Hz (10k/15k/20k) -> 0 - 255 Hue (Red to Purple)
  // =========================================================================

  /**
   * Directly maps 0 Hz to this.maxFreq (default 10,000 Hz) to 0 - 255 Hue
   */
  freqToHue(freq) {
    const clamped = Math.max(0, Math.min(this.maxFreq, freq));
    return (clamped / this.maxFreq) * 255;
  }

  /**
   * Converts 0-255 Hue into HSL color string
   * Hue 0 = 0 deg (Red), Hue 255 = 285 deg (Purple)
   */
  hueToColor(hue255, lightness = 50, alpha = 1) {
    const clamped = Math.max(0, Math.min(255, hue255));
    const deg = (clamped / 255) * 285;
    return `hsla(${deg}, 95%, ${lightness}%, ${alpha})`;
  }

  /**
   * Directly converts any frequency in Hertz to its corresponding color string
   */
  freqToColor(freq, lightness = 50, alpha = 1) {
    return this.hueToColor(this.freqToHue(freq), lightness, alpha);
  }

  formatFreq(freq) {
    const rounded = Math.round(freq);
    if (rounded < 1000) {
      return `${rounded} Hz`;
    }
    const kHz = rounded / 1000;
    return `${kHz >= 10 ? kHz.toFixed(1) : kHz.toFixed(2)} kHz`;
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      this.gainNode.gain.value = 0.15;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // =========================================================================
  // HIGH-ENERGY ROCK BAND SOUND DEMO
  // Multi-voice rock band simulation: Punchy kick & snare drums, driving bass,
  // overdriven distorted electric guitar power chords, and soaring lead solos.
  // Full audible spectrum: 40 Hz sub-bass (Red) up to 12 kHz cymbals (Purple)!
  // =========================================================================

  makeDistortionCurve(amount = 28) {
    const k = amount;
    const n_samples = 22050;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  getNoiseBuffer() {
    if (!this.noiseBuffer && this.audioCtx) {
      const bufferSize = this.audioCtx.sampleRate * 1.5;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  initRockMaster() {
    if (!this.rockCompressor && this.audioCtx) {
      // Rock master compressor for punch and glue
      const comp = this.audioCtx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-14, this.audioCtx.currentTime);
      comp.knee.setValueAtTime(25, this.audioCtx.currentTime);
      comp.ratio.setValueAtTime(8, this.audioCtx.currentTime);
      comp.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      comp.release.setValueAtTime(0.20, this.audioCtx.currentTime);

      const master = this.audioCtx.createGain();
      master.gain.setValueAtTime(0.22, this.audioCtx.currentTime);

      comp.connect(master);
      master.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      // Electric Guitar Distortion & Cabinet Stage
      const dist = this.audioCtx.createWaveShaper();
      dist.curve = this.makeDistortionCurve(32);
      dist.oversample = '4x';

      const cabPeak = this.audioCtx.createBiquadFilter();
      cabPeak.type = 'peaking';
      cabPeak.frequency.setValueAtTime(1800, this.audioCtx.currentTime);
      cabPeak.Q.setValueAtTime(1.8, this.audioCtx.currentTime);
      cabPeak.gain.setValueAtTime(6.0, this.audioCtx.currentTime);

      const cabLow = this.audioCtx.createBiquadFilter();
      cabLow.type = 'lowpass';
      cabLow.frequency.setValueAtTime(4600, this.audioCtx.currentTime);

      dist.connect(cabPeak);
      cabPeak.connect(cabLow);
      cabLow.connect(comp);

      this.rockCompressor = comp;
      this.rockMaster = master;
      this.guitarDistortion = dist;
    }
  }

  startMusicDemo() {
    this.initAudioContext();
    this.initRockMaster();
    this.stopMusicDemo();
    this.isPlayingAudio = true;
    this.rockStep = 0;

    const toneBtn = document.getElementById('vizToneBtn');
    if (toneBtn) {
      toneBtn.classList.add('active');
      toneBtn.setAttribute('aria-pressed', 'true');
      const textSpan = toneBtn.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Stop Rock Band Demo';
    }

    // 138 BPM energetic rock tempo: 8th-note duration = ~217ms
    const stepDurationMs = 217;

    // 32-step loop (4 bars of driving 4/4 hard rock)
    const playRockBeat = () => {
      if (!this.isPlayingAudio) return;

      const now = this.audioCtx.currentTime;
      const step = this.rockStep;
      const beatInBar = step % 8; // 0 to 7
      const bar = Math.floor(step / 8); // 0 to 3

      // -----------------------------------------------------------------------
      // 1. DRUMS
      // -----------------------------------------------------------------------
      // A. Heavy Sub Kick Drum: Beat 0, 3, 4 (pounding driving syncopation)
      const isKick = (beatInBar === 0 || beatInBar === 3 || beatInBar === 4);
      if (isKick) {
        const kickOsc = this.audioCtx.createOscillator();
        const kickGain = this.audioCtx.createGain();

        // Punchy sub-bass drop 155 Hz -> 42 Hz
        kickOsc.frequency.setValueAtTime(155, now);
        kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.08);

        kickGain.gain.setValueAtTime(0.95, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        kickOsc.connect(kickGain);
        kickGain.connect(this.rockCompressor);
        kickOsc.start(now);
        kickOsc.stop(now + 0.25);
      }

      // B. Cracking Snare Drum: Beat 2 and Beat 6 (classic heavy backbeat)
      const isSnare = (beatInBar === 2 || beatInBar === 6);
      if (isSnare) {
        // Tone punch
        const snareTone = this.audioCtx.createOscillator();
        const snareToneGain = this.audioCtx.createGain();
        snareTone.type = 'triangle';
        snareTone.frequency.setValueAtTime(190, now);
        snareTone.frequency.exponentialRampToValueAtTime(120, now + 0.07);
        snareToneGain.gain.setValueAtTime(0.7, now);
        snareToneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        snareTone.connect(snareToneGain);
        snareToneGain.connect(this.rockCompressor);
        snareTone.start(now);
        snareTone.stop(now + 0.15);

        // Noise crack
        const noiseBuf = this.getNoiseBuffer();
        if (noiseBuf) {
          const noiseSrc = this.audioCtx.createBufferSource();
          const noiseFilter = this.audioCtx.createBiquadFilter();
          const noiseGain = this.audioCtx.createGain();

          noiseSrc.buffer = noiseBuf;
          noiseFilter.type = 'highpass';
          noiseFilter.frequency.setValueAtTime(900, now);

          noiseGain.gain.setValueAtTime(0.65, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

          noiseSrc.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(this.rockCompressor);
          noiseSrc.start(now);
          noiseSrc.stop(now + 0.2);
        }
      }

      // C. Hi-Hats: 8th notes sizzling on 9-12 kHz (Violet / Purple shimmer)
      const isOpenHat = (beatInBar === 7);
      const noiseBuf = this.getNoiseBuffer();
      if (noiseBuf) {
        const hatSrc = this.audioCtx.createBufferSource();
        const hatFilter = this.audioCtx.createBiquadFilter();
        const hatGain = this.audioCtx.createGain();

        hatSrc.buffer = noiseBuf;
        hatFilter.type = 'highpass';
        hatFilter.frequency.setValueAtTime(8500, now);

        const hatDecay = isOpenHat ? 0.22 : 0.045;
        const hatVol = isOpenHat ? 0.45 : 0.25;

        hatGain.gain.setValueAtTime(hatVol, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + hatDecay);

        hatSrc.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(this.rockCompressor);
        hatSrc.start(now);
        hatSrc.stop(now + hatDecay + 0.02);
      }

      // -----------------------------------------------------------------------
      // 2. CRUNCHY DISTORTED ELECTRIC GUITAR (Power Chords)
      // -----------------------------------------------------------------------
      // Progression: Bar 0 = E5, Bar 1 = G5, Bar 2 = A5, Bar 3 = D5/C5/B5
      let chordRoot = 82; // E2
      if (bar === 1) chordRoot = 98; // G2
      else if (bar === 2) chordRoot = 110; // A2
      else if (bar === 3) {
        chordRoot = (beatInBar < 4) ? 147 : (beatInBar < 6 ? 131 : 123); // D3 -> C3 -> B2
      }

      // Play crunchy 8th note chugs
      const chordOsc1 = this.audioCtx.createOscillator(); // Root
      const chordOsc2 = this.audioCtx.createOscillator(); // 5th (root * 1.5)
      const chordOsc3 = this.audioCtx.createOscillator(); // Octave (root * 2.0)
      const guitarGain = this.audioCtx.createGain();

      chordOsc1.type = 'sawtooth';
      chordOsc2.type = 'sawtooth';
      chordOsc3.type = 'triangle';

      chordOsc1.frequency.setValueAtTime(chordRoot, now);
      chordOsc2.frequency.setValueAtTime(chordRoot * 1.498, now); // Just 5th
      chordOsc3.frequency.setValueAtTime(chordRoot * 2.0, now);

      const gDur = (beatInBar === 3 || beatInBar === 7) ? 0.18 : 0.14;
      guitarGain.gain.setValueAtTime(0.32, now);
      guitarGain.gain.exponentialRampToValueAtTime(0.001, now + gDur);

      chordOsc1.connect(this.guitarDistortion);
      chordOsc2.connect(this.guitarDistortion);
      chordOsc3.connect(this.guitarDistortion);
      guitarGain.connect(this.guitarDistortion);

      chordOsc1.start(now); chordOsc1.stop(now + gDur + 0.02);
      chordOsc2.start(now); chordOsc2.stop(now + gDur + 0.02);
      chordOsc3.start(now); chordOsc3.stop(now + gDur + 0.02);

      // -----------------------------------------------------------------------
      // 3. PUMPING ROCK BASSLINE (Sub-bass / Low End in Red & Orange)
      // -----------------------------------------------------------------------
      const bassRoot = chordRoot / 2; // E1 (41 Hz), G1 (49 Hz), A1 (55 Hz), etc.
      const bassOsc = this.audioCtx.createOscillator();
      const bassGain = this.audioCtx.createGain();
      const bassFilter = this.audioCtx.createBiquadFilter();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassRoot, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(320, now);

      bassGain.gain.setValueAtTime(0.48, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.rockCompressor);
      bassOsc.start(now);
      bassOsc.stop(now + 0.21);

      // -----------------------------------------------------------------------
      // 4. SCREAMING LEAD GUITAR SOLOS (Pentatonic Riffs across Green, Blue, Purple)
      // -----------------------------------------------------------------------
      const leadNotes = [
        // Bar 0: A minor blues lick
        440, 523, 587, 659, 784, 880, 784, 659,
        // Bar 1: Ascending run into treble
        880, 988, 1046, 1175, 1318, 1568, 1760, 2093,
        // Bar 2: High soaring blues bends
        1760, 2093, 2349, 2637, 2349, 2093, 1760, 1568,
        // Bar 3: Screaming climax at 3.5 kHz!
        2093, 2637, 3136, 3520, 2637, 2093, 1760, 880
      ];

      const leadFreq = leadNotes[step];
      if (leadFreq && Math.random() > 0.18) {
        const leadOsc = this.audioCtx.createOscillator();
        const leadGain = this.audioCtx.createGain();
        leadOsc.type = 'sawtooth';

        // Expressive pitch bend on accents
        leadOsc.frequency.setValueAtTime(leadFreq * 0.96, now);
        leadOsc.frequency.linearRampToValueAtTime(leadFreq, now + 0.04);

        leadGain.gain.setValueAtTime(0.28, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

        leadOsc.connect(this.guitarDistortion);
        leadOsc.start(now);
        leadOsc.stop(now + 0.22);
      }

      // Advance rock step (32 steps loop)
      this.rockStep = (this.rockStep + 1) % 32;
      this.rockDemoTimer = setTimeout(playRockBeat, stepDurationMs);
    };

    playRockBeat();
  }

  stopMusicDemo() {
    this.isPlayingAudio = false;
    if (this.rockDemoTimer) {
      clearTimeout(this.rockDemoTimer);
      this.rockDemoTimer = null;
    }

    const toneBtn = document.getElementById('vizToneBtn');
    if (toneBtn) {
      toneBtn.classList.remove('active');
      toneBtn.setAttribute('aria-pressed', 'false');
      const textSpan = toneBtn.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Play Rock Band Demo';
    }
  }

  togglePlayTone() {
    if (this.isPlayingAudio) {
      this.stopMusicDemo();
    } else {
      if (this.isMicActive) this.toggleMic();
      if (this.isUploadedPlaying) this.stopUploadedMedia();
      this.startMusicDemo();
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
        if (this.isPlayingAudio) this.stopMusicDemo();
        if (this.isUploadedPlaying) this.stopUploadedMedia();

        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
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
        alert('Microphone access was denied. You can explore all frequency color animations using the Play Rock Band Demo button, Upload Audio/MP4, or the Online Tone Generator.');
      }
    }
  }

  // =========================================================================
  // AUDIO & MP4 VIDEO UPLOAD / LOOPING ENGINE
  // Extracts audio from MP3, WAV, FLAC, OGG, AAC, and MP4 video containers
  // and plays it on a loop directly into the sound-to-light visualizer!
  // =========================================================================

  handleAudioUpload(file) {
    if (!file) return;
    this.initAudioContext();
    if (this.isMicActive) this.toggleMic();
    if (this.isPlayingAudio) this.stopMusicDemo();
    this.stopUploadedMedia();

    const fileUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video') || file.name.match(/\.(mp4|webm|mov|mkv)$/i);
    const media = isVideo ? document.createElement('video') : new Audio();
    media.src = fileUrl;
    media.loop = true; // Loop as requested: "and play it on a loop"
    media.crossOrigin = 'anonymous';

    // Route audio element into Web Audio Analyser and Destination
    const sourceNode = this.audioCtx.createMediaElementSource(media);
    sourceNode.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);

    this.uploadedMedia = media;
    this.uploadedSourceNode = sourceNode;
    this.uploadedFileUrl = fileUrl;
    this.isUploadedPlaying = true;

    media.play().then(() => {
      const trackInfoRow = document.getElementById('vizTrackInfoRow');
      const trackName = document.getElementById('vizTrackName');
      const uploadBtn = document.getElementById('vizUploadBtn');

      if (trackInfoRow) trackInfoRow.style.display = 'flex';
      if (trackName) trackName.textContent = file.name;
      if (uploadBtn) {
        uploadBtn.classList.add('active');
        const textSpan = uploadBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Looping Track';
      }
    }).catch(err => {
      console.warn('Audio playback error:', err);
      alert('Unable to play uploaded media: ' + err.message);
      this.stopUploadedMedia();
    });
  }

  stopUploadedMedia() {
    if (this.uploadedMedia) {
      try {
        this.uploadedMedia.pause();
        this.uploadedMedia.src = '';
        this.uploadedMedia.load();
      } catch (e) {}
      this.uploadedMedia = null;
    }
    if (this.uploadedFileUrl) {
      URL.revokeObjectURL(this.uploadedFileUrl);
      this.uploadedFileUrl = null;
    }
    this.isUploadedPlaying = false;

    const trackInfoRow = document.getElementById('vizTrackInfoRow');
    const uploadBtn = document.getElementById('vizUploadBtn');
    if (trackInfoRow) trackInfoRow.style.display = 'none';
    if (uploadBtn) {
      uploadBtn.classList.remove('active');
      const textSpan = uploadBtn.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Upload Audio / MP4';
    }
    const fileInput = document.getElementById('vizAudioUpload');
    if (fileInput) fileInput.value = '';
  }

  updateScaleLabels() {
    const title = document.getElementById('hueMeterTitle');
    const subtitle = document.getElementById('hueMeterSubtitle');
    const scaleLabels = document.getElementById('hueScaleLabels');

    if (title) title.textContent = `0 Hz – ${this.formatFreq(this.maxFreq)} → 0–255 Hue Chromatic Mapping`;
    if (subtitle) subtitle.textContent = `Continuous sound-to-light spectrum: 0 Hz (Hue 0 • Red) to ${this.formatFreq(this.maxFreq)} (Hue 255 • Purple)`;

    if (scaleLabels) {
      const q1 = this.formatFreq(this.maxFreq * 0.25);
      const q2 = this.formatFreq(this.maxFreq * 0.50);
      const q3 = this.formatFreq(this.maxFreq * 0.75);
      const q4 = this.formatFreq(this.maxFreq);

      scaleLabels.innerHTML = `
        <span>0 Hz (Hue 0 &bull; Red)</span>
        <span>${q1} (Hue 64 &bull; Green)</span>
        <span>${q2} (Hue 128 &bull; Cyan-Blue)</span>
        <span>${q3} (Hue 191 &bull; Violet)</span>
        <span>${q4} (Hue 255 &bull; Purple)</span>
      `;
    }
  }

  initControls() {
    const toneBtn = document.getElementById('vizToneBtn');
    const micBtn = document.getElementById('vizMicBtn');
    const uploadBtn = document.getElementById('vizUploadBtn');
    const fileInput = document.getElementById('vizAudioUpload');
    const stopUploadedBtn = document.getElementById('vizStopUploadedBtn');
    const animBtns = document.querySelectorAll('[data-viz-anim]');
    const maxFreqSelect = document.getElementById('maxFreqSelect');
    const dismissMicNotice = document.getElementById('dismissMicNotice');
    const micRangeNotice = document.getElementById('micRangeNotice');

    if (toneBtn) toneBtn.addEventListener('click', () => this.togglePlayTone());
    if (micBtn) micBtn.addEventListener('click', () => this.toggleMic());

    // File Upload & Looping Handler
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.handleAudioUpload(file);
        }
      });
    }

    if (stopUploadedBtn) {
      stopUploadedBtn.addEventListener('click', () => this.stopUploadedMedia());
    }

    // Max frequency ceiling selector
    if (maxFreqSelect) {
      maxFreqSelect.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        this.maxFreq = val;

        if (micRangeNotice) {
          micRangeNotice.style.display = val > 10000 ? 'flex' : 'none';
        }

        this.updateScaleLabels();
        this.updateUI();
      });
    }

    if (dismissMicNotice && micRangeNotice) {
      dismissMicNotice.addEventListener('click', () => {
        micRangeNotice.style.display = 'none';
      });
    }

    animBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        animBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.animation = btn.getAttribute('data-viz-anim');
      });
    });

    this.updateUI();
  }

  /**
   * Multi-Frequency Analysis & Dominant Pitch Detection
   */
  updateFrequencyEnergies() {
    this.prevEnergy = this.currentEnergy;
    let dominantFreq = 0;
    let maxVal = 0;
    let totalEnergy = 0;

    if (this.analyser && this.dataArray && (this.isMicActive || this.isPlayingAudio || this.isUploadedPlaying)) {
      this.analyser.getByteFrequencyData(this.dataArray);
      const nyquist = this.audioCtx.sampleRate / 2;
      const binHz = nyquist / this.bufferLength;
      const maxBin = Math.min(this.bufferLength - 1, Math.ceil(this.maxFreq / binHz));

      let peakIdx = 0;
      // Scan up to the active max frequency ceiling
      for (let i = 1; i <= maxBin; i++) {
        const val = this.dataArray[i];
        totalEnergy += val;
        if (val > maxVal) {
          maxVal = val;
          peakIdx = i;
        }
      }

      // Threshold to avoid low-level room hiss
      if (maxVal > 22) {
        dominantFreq = Math.min(this.maxFreq, peakIdx * binHz);
      }

      // Energy (volume) calculation normalized 0.0 to 1.0 with fast attack
      const rawEnergy = Math.min(1.0, (totalEnergy / (maxBin * 255.0)) * 2.4);
      if (rawEnergy > this.currentEnergy) {
        this.currentEnergy = this.currentEnergy * 0.4 + rawEnergy * 0.6;
      } else {
        this.currentEnergy = this.currentEnergy * 0.85 + rawEnergy * 0.15;
      }
    } else {
      // In complete silence / idle: very low energy, gentle ambient floor
      this.currentEnergy = 0.03 + Math.sin(this.time * 0.6) * 0.015;
      dominantFreq = 0;
    }

    // Smooth active frequency
    if (dominantFreq > 0) {
      this.activeFreq = this.activeFreq * 0.75 + dominantFreq * 0.25;
    } else {
      // Gentle decay towards 0 Hz in silence
      this.activeFreq = this.activeFreq * 0.92;
    }
    this.activeHue = this.freqToHue(this.activeFreq);

    this.updateUI();
  }

  updateUI() {
    const freq = Math.round(this.activeFreq);
    const hue = Math.round(this.activeHue);
    const color = this.hueToColor(hue);

    const activeFreqLabel = document.getElementById('activeFreqLabel');
    const activeHueLabel = document.getElementById('activeHueLabel');
    const activeHueSwatch = document.getElementById('activeHueSwatch');
    const hueIndicatorPin = document.getElementById('hueIndicatorPin');
    const levelBar = document.getElementById('vizLevelBar');
    const levelText = document.getElementById('vizLevelText');

    const formattedFreq = this.formatFreq(freq);

    if (activeFreqLabel) {
      if (this.currentEnergy < 0.05 && !this.isPlayingAudio && !this.isMicActive && !this.isUploadedPlaying) {
        activeFreqLabel.textContent = '0 Hz (Silence)';
      } else if (this.currentEnergy < 0.05) {
        activeFreqLabel.textContent = 'Silence (< 20 Hz)';
      } else {
        activeFreqLabel.textContent = formattedFreq;
      }
    }
    if (activeHueLabel) activeHueLabel.textContent = `Hue: ${hue} / 255`;
    if (activeHueSwatch) activeHueSwatch.style.backgroundColor = color;
    if (hueIndicatorPin) {
      const pct = Math.min(100, Math.max(0, (this.activeFreq / this.maxFreq) * 100));
      hueIndicatorPin.style.left = `${pct}%`;
    }

    if (levelBar) {
      const pct = Math.max(3, Math.min(100, Math.round(this.currentEnergy * 100)));
      levelBar.style.width = `${pct}%`;
    }
    if (levelText) {
      if (this.currentEnergy < 0.06) {
        levelText.textContent = 'Silent';
        levelText.style.color = '#94a3b8';
      } else if (this.currentEnergy < 0.25) {
        levelText.textContent = 'Quiet';
        levelText.style.color = '#10b981';
      } else if (this.currentEnergy < 0.60) {
        levelText.textContent = 'Moderate';
        levelText.style.color = '#0284c7';
      } else if (this.currentEnergy < 0.85) {
        levelText.textContent = 'Loud';
        levelText.style.color = '#f59e0b';
      } else {
        levelText.textContent = 'Peak!';
        levelText.style.color = '#ef4444';
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.time += 0.025;

    this.updateFrequencyEnergies();

    const ctx = this.ctx;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
  // PATTERN 1: Volume-Reactive Liquid Pulse Waves
  // - Pulse timing accelerates on volume: loud sounds pulse earlier, silence pulses very slowly
  // - Wave colors, saturation, brightness, and thickness dynamically match audio level
  // =========================================================================
  renderLiquidPulseWaves(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(w, h) * 0.56;
    const energy = this.currentEnergy; // 0.0 to 1.0

    // Volume-Reactive Pulse Timing:
    // Complete silence (energy ~ 0.03): increments by ~0.35/frame -> pulses every ~160 frames (~2.7s) - very slow!
    // Loud sounds (energy ~ 0.8 - 1.0): increments by ~5.5/frame -> pulses every ~10 frames (~160ms) - rapid fire!
    this.pulseTimer += 0.35 + Math.min(1.0, energy * 1.4) * 5.2;

    // Transient beat detection: sudden volume surge gets it to pulse earlier!
    const deltaEnergy = energy - this.prevEnergy;
    const isTransientBeat = deltaEnergy > 0.16 && this.pulseTimer > 12;

    if (this.pulseTimer >= 56 || isTransientBeat) {
      this.pulseTimer = 0;
      this.pulses.push({
        r: 6,
        maxR: maxR,
        speed: 2.0 + energy * 3.2,
        freq: this.activeFreq,
        hue: this.activeHue,
        energy: energy, // Audio volume level at birth
        phase: Math.random() * Math.PI * 2
      });
    }

    // Central Vibrating Liquid Reservoir colored by active Hue and audio level
    // In complete silence: tiny, dim reservoir
    // Loud audio: expands, pulsates, and glows vividly
    const coreR = 8 + energy * 26;
    const coreAlpha = 0.15 + energy * 0.75;
    const coreSat = 35 + energy * 63; // 35% in silence -> 98% in loud audio
    const coreLit = 35 + energy * 20;

    const deg = (Math.max(0, Math.min(255, this.activeHue)) / 255) * 285;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${deg}, ${coreSat}%, ${coreLit}%, ${coreAlpha})`;
    ctx.fill();

    // Secondary harmonic corona ring (grows with volume)
    if (energy > 0.08) {
      const harmDeg = (((this.activeHue + 35) % 256) / 255) * 285;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 1.15, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${harmDeg}, ${coreSat}%, ${coreLit}%, ${coreAlpha * 0.7})`;
      ctx.lineWidth = 1.5 + energy * 2.5;
      ctx.stroke();
    }

    // Render active liquid pulses traveling outward
    for (let p = this.pulses.length - 1; p >= 0; p--) {
      const pulse = this.pulses[p];
      pulse.r += pulse.speed;

      if (pulse.r >= pulse.maxR) {
        this.pulses.splice(p, 1);
        continue;
      }

      const progress = pulse.r / pulse.maxR;
      const fade = Math.pow(1.0 - progress, 0.75);
      const thickness = 10 + progress * 35;
      const points = 72;

      // Pulse color modulated by its audio level at birth:
      // In silence: low saturation (35%), darker (38%), dim alpha (~0.15), thin line (1.5px)
      // Loud sound: high saturation (98%), bright (54%), radiant alpha (~0.85), bold line (4.5px)
      const pEnergy = pulse.energy;
      const pSat = 35 + pEnergy * 63;
      const pLit = 38 + pEnergy * 18;
      const pAlpha = (0.15 + pEnergy * 0.72) * fade;
      const pWidth = 1.5 + pEnergy * 3.5;
      const pHueDeg = (Math.max(0, Math.min(255, pulse.hue)) / 255) * 285;

      // 1. Primary Wave colored with its exact frequency Hue and audio level
      ctx.beginPath();
      const rMid = pulse.r;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = Math.sin(angle * 6 - pulse.phase + this.time * 2.0) * (3 + pEnergy * 8);
        const curR = rMid + wobble;
        const x = cx + curR * Math.cos(angle);
        const y = cy + curR * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${pHueDeg}, ${pSat}%, ${pLit}%, ${pAlpha})`;
      ctx.lineWidth = pWidth;
      ctx.stroke();

      // 2. Harmonic Sub-layer (-25 Hue along the 0-255 scale) - only on audible levels
      if (pEnergy > 0.12) {
        ctx.beginPath();
        const rInner = Math.max(6, pulse.r - thickness * 0.4);
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wobble = Math.sin(angle * 4 + pulse.phase + this.time * 1.5) * (2 + pEnergy * 6);
          const curR = rInner + wobble;
          const x = cx + curR * Math.cos(angle);
          const y = cy + curR * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const innerHue = Math.max(0, pulse.hue - 25);
        const innerDeg = (innerHue / 255) * 285;
        ctx.strokeStyle = `hsla(${innerDeg}, ${pSat}%, ${pLit}%, ${pAlpha * 0.65})`;
        ctx.lineWidth = Math.max(1, pWidth * 0.65);
        ctx.stroke();
      }

      // 3. Harmonic Overtone Crest (+25 Hue along the 0-255 scale) - only on louder levels
      if (pEnergy > 0.25) {
        ctx.beginPath();
        const rOuter = pulse.r + thickness * 0.4;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wobble = Math.cos(angle * 8 + pulse.phase * 1.5 + this.time * 2.8) * (2 + pEnergy * 5);
          const curR = rOuter + wobble;
          const x = cx + curR * Math.cos(angle);
          const y = cy + curR * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const outerHue = Math.min(255, pulse.hue + 25);
        const outerDeg = (outerHue / 255) * 285;
        ctx.strokeStyle = `hsla(${outerDeg}, ${pSat}%, ${pLit}%, ${pAlpha * 0.65})`;
        ctx.lineWidth = Math.max(1, pWidth * 0.55);
        ctx.stroke();
      }
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
    const energy = this.currentEnergy;
    const fundamentalHue = this.activeHue;

    // 1. Fundamental Nodal Curve
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const wave = Math.cos(3 * angle + this.time * 0.8) * (energy * 0.22);
      const r = maxR * (0.85 + wave);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.hueToColor(fundamentalHue, 50, 0.5 + energy * 0.5);
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 2. Harmonic 2nd Nodal Curve
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h1 = Math.cos(5 * angle - this.time * 1.2);
      const h2 = Math.sin(4 * angle + this.time * 0.6);
      const r = maxR * (0.48 + (h1 * h2) * (0.2 + energy * 0.25));
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const harm2Hue = (fundamentalHue + 60) % 256;
    ctx.strokeStyle = this.hueToColor(harm2Hue, 50, 0.5 + energy * 0.5);
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 3. Harmonic 3rd Nodal Curve
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i * Math.PI) / 180;
      const h3 = Math.sin(7 * angle + this.time * 2.0) * (0.15 + energy * 0.2);
      const r = maxR * (0.24 + h3);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const harm3Hue = (fundamentalHue + 120) % 256;
    ctx.strokeStyle = this.hueToColor(harm3Hue, 50, 0.5 + energy * 0.5);
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // PATTERN 3: Harmonic Spiral (Continuous 0-255 Hue Gradient)
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

      // Direct continuous mapping: ratio (0 to 1) -> 0 to 255 Hue
      const hue = ratio * 255;
      const energy = this.currentEnergy;
      const pColor = this.hueToColor(hue, 50, 0.55 + energy * 0.45);
      const pRadius = 2.0 + (1.0 - ratio * 0.5) * (1.5 + energy * 3.0);

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
  // PATTERN 4: Frequency Spectrum EQ (Direct 0-255 Hue)
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
      const hue = ratio * 255;
      const hex = this.hueToColor(hue, 50, 1.0);

      let amp = 0.2;
      if (this.dataArray && (this.isMicActive || this.isPlayingAudio)) {
        const fftIdx = Math.min(this.bufferLength - 1, Math.floor(ratio * (this.bufferLength - 1)));
        amp = (this.dataArray[fftIdx] || 10) / 255.0;
      } else {
        const wave = Math.sin(i * 0.35 + this.time * 3) * 0.25 + 0.4;
        amp = wave * (0.3 + this.currentEnergy * 0.7);
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
  // PATTERN 5: Pixelblaze 2D LED Matrix (Continuous 0-255 Hue Sweep)
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
      const ratio = c / cols;
      const hue = ratio * 255;
      const energy = this.currentEnergy;

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
          ctx.fillStyle = this.hueToColor(hue, 50, Math.min(1.0, intensity * 1.1));
        } else {
          ctx.fillStyle = '#e2e8f0';
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
    const energy = this.currentEnergy;
    const fundamentalHue = this.activeHue;

    // 1. Primary Phase Curve
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = scaleX * Math.sin(2 * t + delta) * (0.75 + energy * 0.25);
      const y = scaleY * Math.sin(3 * t) * (0.75 + energy * 0.25);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.hueToColor(fundamentalHue, 50, 0.5 + energy * 0.5);
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 2. Secondary Harmonic Ribbon
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = (scaleX * 0.85) * Math.sin(3 * t + delta * 1.3);
      const y = (scaleY * 0.85) * Math.sin(4 * t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const ribbonHue = (fundamentalHue + 60) % 256;
    ctx.strokeStyle = this.hueToColor(ribbonHue, 50, 0.5 + energy * 0.5);
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 3. Tertiary High Harmonic Ribbon
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = (scaleX * 0.65) * Math.sin(5 * t + delta * 1.8);
      const y = (scaleY * 0.65) * Math.sin(6 * t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const overtoneHue = (fundamentalHue + 140) % 256;
    ctx.strokeStyle = this.hueToColor(overtoneHue, 50, 0.45 + energy * 0.55);
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.restore();
  }
}

// ===========================================================================
// INTERACTIVE ZOOMABLE / DRAGGABLE ELECTROMAGNETIC SPECTRUM VS SOUND CANVAS
// ===========================================================================

class ElectromagneticSpectrumCanvas {
  constructor(canvasId, wrapperId) {
    this.canvas = document.getElementById(canvasId);
    this.wrapper = document.getElementById(wrapperId);
    if (!this.canvas || !this.wrapper) return;

    this.ctx = this.canvas.getContext('2d');
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.startPanX = 0;
    this.startPanY = 0;
    this.hoverItem = null;
    this.mouse = { x: -1, y: -1 };
    this.hintElem = document.getElementById('emCanvasHintText');

    // Base logical diagram canvas dimensions
    this.BASE_W = 1080;
    this.BASE_H = 450;

    this.initCanvasSize();
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      this.clampPan();
      this.render();
    });

    this.initInteraction();
    this.render();
  }

  initCanvasSize() {
    const rect = this.wrapper.getBoundingClientRect();
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    this.width = rect.width || 1000;
    this.height = rect.height || 520;

    // Buffer dimensions scaled by DPR for razor-sharp rendering on Retina/4K/HiDPI
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  getTransform() {
    const marginX = 24;
    const marginY = 20;
    const fitScale = Math.min(
      (this.width - marginX * 2) / this.BASE_W,
      (this.height - marginY * 2) / this.BASE_H
    );
    const scale = fitScale * this.zoom;
    const originX = this.width / 2 + this.panX;
    const originY = this.height / 2 + this.panY;
    return { scale, originX, originY, fitScale };
  }

  screenToLogical(sx, sy) {
    const { scale, originX, originY } = this.getTransform();
    return {
      lx: (sx - originX) / scale + this.BASE_W / 2,
      ly: (sy - originY) / scale + this.BASE_H / 2
    };
  }

  clampPan() {
    const { scale } = this.getTransform();
    const diagramW = this.BASE_W * scale;
    const diagramH = this.BASE_H * scale;
    const limitX = Math.max(this.width * 0.4, (diagramW - this.width) / 2 + this.width * 0.25);
    const limitY = Math.max(this.height * 0.4, (diagramH - this.height) / 2 + this.height * 0.25);
    this.panX = Math.max(-limitX, Math.min(limitX, this.panX));
    this.panY = Math.max(-limitY, Math.min(limitY, this.panY));
  }

  initInteraction() {
    const wrapper = this.wrapper;

    // 2D Mouse drag
    wrapper.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startPanX = this.panX;
      this.startPanY = this.panY;
      wrapper.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;

      if (this.isDragging) {
        this.panX = this.startPanX + (e.clientX - this.startX);
        this.panY = this.startPanY + (e.clientY - this.startY);
        this.clampPan();
      }

      this.updateHoverState();
      this.render();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        wrapper.classList.remove('is-dragging');
      }
    });

    // Mouse wheel zoom centered on cursor
    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.7, Math.min(5.0, this.zoom * zoomFactor));
      if (newZoom === this.zoom) return;

      const { scale: oldScale, originX: oldOriginX, originY: oldOriginY } = this.getTransform();
      const { fitScale } = this.getTransform();
      const newScale = fitScale * newZoom;

      const lx = (mouseX - oldOriginX) / oldScale + this.BASE_W / 2;
      const ly = (mouseY - oldOriginY) / oldScale + this.BASE_H / 2;

      this.zoom = newZoom;
      this.panX = mouseX - this.width / 2 - (lx - this.BASE_W / 2) * newScale;
      this.panY = mouseY - this.height / 2 - (ly - this.BASE_H / 2) * newScale;

      this.clampPan();
      this.updateHoverState();
      this.render();
    }, { passive: false });

    // Touch support (1-finger pan & 2-finger pinch zoom)
    let lastTouchX = 0;
    let lastTouchY = 0;
    let initialPinchDist = 0;
    let initialZoom = 1.0;

    wrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.startPanX = this.panX;
        this.startPanY = this.panY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = this.zoom;
      }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        this.panX = this.startPanX + (e.touches[0].clientX - lastTouchX);
        this.panY = this.startPanY + (e.touches[0].clientY - lastTouchY);
        this.clampPan();
        this.render();
      } else if (e.touches.length === 2 && initialPinchDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / initialPinchDist;
        this.zoom = Math.max(0.7, Math.min(5.0, initialZoom * factor));
        this.clampPan();
        this.render();
      }
    }, { passive: true });

    wrapper.addEventListener('touchend', () => {
      this.isDragging = false;
      initialPinchDist = 0;
    });

    // Control buttons
    const zoomInBtn = document.getElementById('emZoomInBtn');
    const zoomOutBtn = document.getElementById('emZoomOutBtn');
    const focusBtn = document.getElementById('emFocusBtn');
    const resetBtn = document.getElementById('emResetBtn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
      this.zoom = Math.min(5.0, this.zoom * 1.3);
      this.clampPan();
      this.render();
    });

    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
      this.zoom = Math.max(0.7, this.zoom / 1.3);
      this.clampPan();
      this.render();
    });

    if (focusBtn) focusBtn.addEventListener('click', () => {
      // Smoothly zoom in on the Visible Light & Hearing comparison in center
      this.zoom = 1.75;
      this.panX = 0;
      this.panY = 0;
      this.render();
    });

    if (resetBtn) resetBtn.addEventListener('click', () => {
      // Default rest view: complete diagram is 100% shown
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.render();
    });
  }

  updateHoverState() {
    if (this.mouse.x < 0 || this.mouse.y < 0) {
      this.hoverItem = null;
      return;
    }

    const { lx, ly } = this.screenToLogical(this.mouse.x, this.mouse.y);
    let newHover = null;
    let hintText = '';

    // Hit test Track 1: EM Bands (y: 36 to 74)
    if (ly >= 36 && ly <= 74) {
      if (lx >= 35 && lx < 285) {
        newHover = 'radio';
        hintText = '📻 Radio Waves: 10² – 10⁹ Hz • Wavelength λ > 1m • AM/FM, WiFi, Cellular. Non-ionizing.';
      } else if (lx >= 285 && lx < 435) {
        newHover = 'microwave';
        hintText = '📡 Microwaves: 10⁹ – 10¹² Hz • Wavelength λ ~ 1mm–1m • Radar, Satellite Comms, Microwave ovens.';
      } else if (lx >= 435 && lx < 570) {
        newHover = 'infrared';
        hintText = '🔥 Infrared (IR): 10¹² – 4×10¹⁴ Hz • Wavelength λ ~ 700nm–1mm • Thermal heat radiation, Night vision.';
      } else if (lx >= 570 && lx <= 622) {
        newHover = 'visible_slit';
        hintText = '🌈 Visible Light: 4×10¹⁴ – 7.5×10¹⁴ Hz (400–700nm) • The only light octave detected by human eyes!';
      } else if (lx > 622 && lx < 747) {
        newHover = 'uv';
        hintText = '☀️ Ultraviolet (UV): 10¹⁵ – 10¹⁶ Hz • Wavelength λ ~ 10–400nm • Sunburns, Blacklights, Sterilization.';
      } else if (lx >= 747 && lx < 892) {
        newHover = 'xray';
        hintText = '🩻 X-Rays: 10¹⁶ – 10¹⁹ Hz • Wavelength λ ~ 0.01–10nm • Medical radiography, Crystallography. High energy.';
      } else if (lx >= 892 && lx <= 1045) {
        newHover = 'gamma';
        hintText = '⚛️ Gamma Rays: > 10¹⁹ Hz • Wavelength λ < 0.01nm • Nuclear decay, Supernovae, Cosmic rays.';
      }
    }

    // Hit test Track 2: Visible Light Rainbow (y: 142 to 186, x: 180 to 900)
    if (ly >= 142 && ly <= 186 && lx >= 180 && lx <= 900) {
      newHover = 'visible_rainbow';
      if (lx < 300) {
        hintText = '🔴 Red Light: Lowest visible frequency (~4.3×10¹⁴ Hz, 700 nm) • CymaSpace maps 0 Hz sound to Red (Hue 0).';
      } else if (lx > 780) {
        hintText = '🟣 Purple Light: Highest visible frequency (~7.5×10¹⁴ Hz, 400 nm) • CymaSpace maps Max Sound to Purple (Hue 255).';
      } else {
        hintText = '🌈 Visible Light Spectrum: 400nm to 700nm • Exactly ~1 Octave of electromagnetic frequencies.';
      }
    }

    // Hit test Sensory Bridge Badge (y: 212 to 254, x: 260 to 820)
    if (ly >= 212 && ly <= 254 && lx >= 260 && lx <= 820) {
      newHover = 'bridge';
      hintText = '⇄ CymaSpace Sensory Substitution: Direct 0–255 Hue mapping converts sound pitch into visual color.';
    }

    // Hit test Track 3: Sound Waves (y: 280 to 322)
    if (ly >= 280 && ly <= 322) {
      if (lx >= 50 && lx < 180) {
        newHover = 'infrasound';
        hintText = '🫀 Infrasound: < 20 Hz • Sub-audible acoustic pressure vibrations felt physically in the body.';
      } else if (lx >= 180 && lx <= 900) {
        newHover = 'audible_sound';
        hintText = '👂 Human Hearing: 0 Hz – 20,000 Hz (~10 Octaves) • Proportionally mapped to visible light colors.';
      } else if (lx > 900 && lx <= 1045) {
        newHover = 'ultrasound';
        hintText = '🦇 Ultrasound: > 20 kHz • Beyond human hearing, utilized by bats, marine sonar, and medical imaging.';
      }
    }

    this.hoverItem = newHover;
    if (this.hintElem) {
      if (hintText) {
        this.hintElem.textContent = hintText;
      } else {
        this.hintElem.innerHTML = '&#9757; Drag to pan &bull; Scroll / pinch to zoom &bull; Hover over bands to inspect';
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);

    // Reset base transform to DPR backing scale for ultra-crisp vector rasterization
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const w = this.width;
    const h = this.height;

    // Dark obsidian stage background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Subtle ambient background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Apply responsive auto-fit transform
    const { scale, originX, originY } = this.getTransform();

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale); // UNIFORM SCALING: Prevents text stretching and raster blur!
    ctx.translate(-this.BASE_W / 2, -this.BASE_H / 2);

    // =======================================================================
    // 1. THE ELECTROMAGNETIC SPECTRUM (Full Range 10^2 to >10^19 Hz)
    // =======================================================================
    const t1X = 35;
    const t1Y = 36;
    const t1W = 1010;
    const t1H = 38;

    // Category Title & Directional Arrow
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('1. THE ELECTROMAGNETIC SPECTRUM (Quantum Light Waves • Frequency in Hertz)', t1X, 23);

    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Increasing Frequency (E = h·f) →', t1X + t1W, 23);
    ctx.textAlign = 'left';

    const emBands = [
      { id: 'radio', name: 'Radio Waves', x: 35, w: 250, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.22)', freq: '10² – 10⁹ Hz', note: 'AM/FM/WiFi' },
      { id: 'microwave', name: 'Microwaves', x: 285, w: 150, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.22)', freq: '10⁹ – 10¹² Hz', note: 'Radar / Comms' },
      { id: 'infrared', name: 'Infrared (IR)', x: 435, w: 135, color: '#f97316', bg: 'rgba(249, 115, 22, 0.22)', freq: '10¹² – 4×10¹⁴ Hz', note: 'Heat Waves' },
      { id: 'visible_slit', name: 'Visible', x: 570, w: 52, isVisible: true, freq: '400–700nm', note: 'Human Eyes' },
      { id: 'uv', name: 'Ultraviolet (UV)', x: 622, w: 125, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.22)', freq: '10¹⁵ – 10¹⁶ Hz', note: 'Blacklight' },
      { id: 'xray', name: 'X-Rays', x: 747, w: 145, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.22)', freq: '10¹⁶ – 10¹⁹ Hz', note: 'Medical Imaging' },
      { id: 'gamma', name: 'Gamma Rays', x: 892, w: 153, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.22)', freq: '> 10¹⁹ Hz', note: 'Nuclear Energy' }
    ];

    emBands.forEach(b => {
      const isHovered = this.hoverItem === b.id;

      if (b.isVisible) {
        // High-contrast rainbow for visible light slit
        const grad = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
        grad.addColorStop(0.0, '#ef4444');
        grad.addColorStop(0.2, '#f97316');
        grad.addColorStop(0.4, '#eab308');
        grad.addColorStop(0.6, '#22c55e');
        grad.addColorStop(0.8, '#3b82f6');
        grad.addColorStop(1.0, '#a855f7');
        ctx.fillStyle = grad;
        ctx.fillRect(b.x, t1Y, b.w, t1H);

        // Glowing white border
        ctx.strokeStyle = isHovered ? '#38bdf8' : '#ffffff';
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.strokeRect(b.x, t1Y - 1, b.w, t1H + 2);

        // Indicator pill above
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VISIBLE', b.x + b.w / 2, t1Y + 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = '8.5px sans-serif';
        ctx.fillText('SLIT', b.x + b.w / 2, t1Y + 28);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = isHovered ? b.color : b.bg;
        ctx.globalAlpha = isHovered ? 0.45 : 1.0;
        ctx.fillRect(b.x, t1Y, b.w, t1H);
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = isHovered ? '#ffffff' : b.color;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.strokeRect(b.x, t1Y, b.w, t1H);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(b.name, b.x + 8, t1Y + 16);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(b.freq, b.x + 8, t1Y + 30);
      }
    });

    // =======================================================================
    // 2. EXPANSION PROJECTION CONE (Connects tiny Visible Slit to Expanded Ribbon)
    // =======================================================================
    const visSlotX1 = 570;
    const visSlotX2 = 622;
    const expStartX = 180;
    const expEndX = 900;
    const expWidth = expEndX - expStartX;
    const expTrackY = 142;
    const rainbowH = 44;

    // Translucent projection cone fill
    ctx.beginPath();
    ctx.moveTo(visSlotX1, t1Y + t1H);
    ctx.lineTo(visSlotX2, t1Y + t1H);
    ctx.lineTo(expEndX, expTrackY);
    ctx.lineTo(expStartX, expTrackY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    // Dotted projection lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(visSlotX1, t1Y + t1H);
    ctx.lineTo(expStartX, expTrackY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(visSlotX2, t1Y + t1H);
    ctx.lineTo(expEndX, expTrackY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Expansion annotation label in center of projection cone
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ Expanding the ~1 Octave of Light Human Eyes Can Perceive ▼', (expStartX + expEndX) / 2, 108);
    ctx.textAlign = 'left';

    // =======================================================================
    // 3. EXPANDED VISIBLE LIGHT SPECTRUM (Human Vision Ribbon)
    // =======================================================================
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('VISIBLE LIGHT SPECTRUM (Human Vision • 400 nm to 700 nm • ~1 Octave)', expStartX, expTrackY - 10);

    const rainbowGrad = ctx.createLinearGradient(expStartX, 0, expEndX, 0);
    rainbowGrad.addColorStop(0.00, '#dc2626'); // Red
    rainbowGrad.addColorStop(0.16, '#ea580c'); // Orange
    rainbowGrad.addColorStop(0.33, '#eab308'); // Yellow
    rainbowGrad.addColorStop(0.50, '#16a34a'); // Green
    rainbowGrad.addColorStop(0.68, '#0284c7'); // Cyan/Blue
    rainbowGrad.addColorStop(0.85, '#4f46e5'); // Indigo
    rainbowGrad.addColorStop(1.00, '#9333ea'); // Purple/Violet

    ctx.fillStyle = rainbowGrad;
    ctx.fillRect(expStartX, expTrackY, expWidth, rainbowH);

    ctx.strokeStyle = this.hoverItem === 'visible_rainbow' ? '#38bdf8' : '#ffffff';
    ctx.lineWidth = this.hoverItem === 'visible_rainbow' ? 2.5 : 1.5;
    ctx.strokeRect(expStartX, expTrackY, expWidth, rainbowH);

    // Color wavelength & frequency callouts
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('RED (Lowest Freq • 700 nm)', expStartX + 10, expTrackY + 18);
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('4.3 × 10¹⁴ Hz (Hue 0)', expStartX + 10, expTrackY + 33);

    const rightText = 'PURPLE (Highest Freq • 400 nm)';
    const rightSub = '7.5 × 10¹⁴ Hz (Hue 255)';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const rw1 = ctx.measureText(rightText).width;
    ctx.fillText(rightText, expEndX - rw1 - 10, expTrackY + 18);
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const rw2 = ctx.measureText(rightSub).width;
    ctx.fillText(rightSub, expEndX - rw2 - 10, expTrackY + 33);

    // =======================================================================
    // 4. ACOUSTIC SOUND WAVES (Human Hearing)
    // =======================================================================
    const track3Y = 280;
    const soundBarH = 42;

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('2. ACOUSTIC SOUND WAVES (Mechanical Pressure Vibrations in Matter • What Human Ears Work For)', 50, track3Y - 12);

    // A. Infrasound (< 20 Hz)
    const infraX = 50;
    const infraW = expStartX - infraX; // 130px (50 to 180)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.fillRect(infraX, track3Y, infraW, soundBarH);
    ctx.strokeStyle = this.hoverItem === 'infrasound' ? '#ffffff' : 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = this.hoverItem === 'infrasound' ? 2 : 1;
    ctx.strokeRect(infraX, track3Y, infraW, soundBarH);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('INFRASOUND', infraX + 8, track3Y + 17);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('< 20 Hz (Body Vibration)', infraX + 8, track3Y + 32);

    // B. Human Audible Sound (0 Hz to 20,000 Hz) - Aligned directly under the Rainbow!
    const audStartX = expStartX;
    const audW = expWidth; // 720px (180 to 900)

    const audGrad = ctx.createLinearGradient(audStartX, 0, audStartX + audW, 0);
    audGrad.addColorStop(0.00, 'rgba(220, 38, 38, 0.85)'); // Red (0 Hz)
    audGrad.addColorStop(0.18, 'rgba(234, 88, 12, 0.85)'); // Orange
    audGrad.addColorStop(0.35, 'rgba(234, 179, 8, 0.85)'); // Yellow
    audGrad.addColorStop(0.52, 'rgba(22, 163, 74, 0.85)'); // Green
    audGrad.addColorStop(0.70, 'rgba(2, 132, 199, 0.85)'); // Blue
    audGrad.addColorStop(1.00, 'rgba(147, 51, 234, 0.85)'); // Purple (Max Hz)

    ctx.fillStyle = audGrad;
    ctx.fillRect(audStartX, track3Y, audW, soundBarH);
    ctx.strokeStyle = this.hoverItem === 'audible_sound' ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(audStartX, track3Y, audW, soundBarH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('HUMAN AUDIBLE SOUND (0 Hz – 20,000 Hz • ~10 Octaves)', audStartX + 12, track3Y + 18);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('0–20 Hz: Sub-Bass Kick Drums • 60–250 Hz: Bass • 500–2k Hz: Mid/Vocals', audStartX + 12, track3Y + 32);

    const audMaxText = 'Max Pitch (10k–20k Hz): Treble & Air';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const audMaxW = ctx.measureText(audMaxText).width;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(audMaxText, audStartX + audW - audMaxW - 12, track3Y + 32);

    // C. Ultrasound (> 20 kHz)
    const ultraStartX = expEndX;
    const ultraW = 1045 - ultraStartX; // 145px (900 to 1045)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.fillRect(ultraStartX, track3Y, ultraW, soundBarH);
    ctx.strokeStyle = this.hoverItem === 'ultrasound' ? '#ffffff' : 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = this.hoverItem === 'ultrasound' ? 2 : 1;
    ctx.strokeRect(ultraStartX, track3Y, ultraW, soundBarH);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ULTRASOUND', ultraStartX + 8, track3Y + 17);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('> 20 kHz (Bats & Sonar)', ultraStartX + 8, track3Y + 32);

    // =======================================================================
    // 5. CYMASPACE SENSORY SUBSTITUTION ALIGNMENT BRACKETS & BADGE
    // =======================================================================
    // Left Bracket: 0 Hz Sound <-> Red Light
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(expStartX, expTrackY + rainbowH);
    ctx.lineTo(expStartX, track3Y);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(expStartX, expTrackY + rainbowH, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(expStartX, track3Y, 4, 0, Math.PI * 2); ctx.fill();

    // Right Bracket: Max Sound <-> Purple Light
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(expEndX, expTrackY + rainbowH);
    ctx.lineTo(expEndX, track3Y);
    ctx.stroke();

    ctx.fillStyle = '#a855f7';
    ctx.beginPath(); ctx.arc(expEndX, expTrackY + rainbowH, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(expEndX, track3Y, 4, 0, Math.PI * 2); ctx.fill();

    // Center Sensory Substitution Badge
    const badgeW = 540;
    const badgeH = 40;
    const badgeX = (this.BASE_W - badgeW) / 2;
    const badgeY = (expTrackY + rainbowH + track3Y) / 2 - badgeH / 2;

    ctx.fillStyle = 'rgba(11, 17, 32, 0.96)';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = this.hoverItem === 'bridge' ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⇄ CYMASPACE PROPORTIONAL SENSORY SUBSTITUTION ⇄', badgeX + badgeW / 2, badgeY + 16);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Lowest Audible Sound (0 Hz) = Red (Hue 0)  •  Max Sound (10k–20k Hz) = Purple (Hue 255)', badgeX + badgeW / 2, badgeY + 31);
    ctx.textAlign = 'left';

    // =======================================================================
    // 6. BOTTOM COMPARISON CARDS (Physics Distinction)
    // =======================================================================
    const t4Y = 352;
    const cardH = 50;
    const cardW = 490;

    // Left Physics Card (Light)
    const card1X = 35;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(card1X, t4Y, cardW, cardH);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(card1X, t4Y, cardW, cardH);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('⚡ LIGHT: Oscillating Photons (Electromagnetic Radiation • 300,000 km/s)', card1X + 10, t4Y + 18);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Travels through space vacuum. Human vision perceives only ~1 octave (400–700 nm).', card1X + 10, t4Y + 34);

    // Right Physics Card (Sound)
    const card2X = 555;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(card2X, t4Y, cardW, cardH);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(card2X, t4Y, cardW, cardH);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('🔊 SOUND: Vibrating Matter (Mechanical Pressure Waves • 343 m/s in Air)', card2X + 10, t4Y + 18);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Requires physical medium. CymaSpace maps 0 Hz to Red & 20 kHz to Purple for inclusion.', card2X + 10, t4Y + 34);

    ctx.restore();
  }
}

// Instantiate both visualizer and electromagnetic spectrum canvas on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new SoundLightVisualizer('cymaticsCanvas');
  new ElectromagneticSpectrumCanvas('emSpectrumCanvas', 'emCanvasWrapper');
});
