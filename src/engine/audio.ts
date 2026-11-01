/** Fully procedural audio: no assets, everything synthesised with WebAudio. */
export class AudioEngine {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  musicBus: GainNode | null = null
  sfxBus: GainNode | null = null
  ambientBus: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private musicVolume = 0.55
  private sfxVolume = 0.7
  private musicPlaying = false
  private schedulerId: number | null = null
  private nextNoteTime = 0
  private step = 0
  private tempo = 76
  private pickup: AudioNode | null = null
  private ambientTimer: number | null = null
  isNight = false
  private rainLevel = 0

  init() {
    if (this.ctx) return
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 22
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.24
    comp.connect(this.master)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.musicVolume
    this.musicBus.connect(comp)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = this.sfxVolume
    this.sfxBus.connect(comp)

    this.ambientBus = ctx.createGain()
    this.ambientBus.gain.value = 0.5
    this.ambientBus.connect(comp)

    // reverb-ish: short feedback delay for space
    const delay = ctx.createDelay(1.0)
    delay.delayTime.value = 0.28
    const fb = ctx.createGain()
    fb.gain.value = 0.28
    const wet = ctx.createGain()
    wet.gain.value = 0.22
    delay.connect(fb)
    fb.connect(delay)
    delay.connect(wet)
    wet.connect(comp)

    // noise buffer
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuf = buf

    // pad pickup for reverb send
    this.pickup = delay
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMusicVolume(v: number) {
    this.musicVolume = v
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1)
  }
  setSfxVolume(v: number) {
    this.sfxVolume = v
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1)
  }

  private noise(dur: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1, when = 0, dest?: AudioNode) {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuf) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = filterType
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    const t = ctx.currentTime + when
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(dest ?? this.sfxBus!)
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number, dest?: AudioNode) {
    const ctx = this.ctx
    if (!ctx) return
    const osc = ctx.createOscillator()
    osc.type = type
    const t = ctx.currentTime + when
    osc.frequency.setValueAtTime(freq, t)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur)
    osc.connect(g)
    g.connect(dest ?? this.sfxBus!)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  footstep(material: string) {
    if (!this.ctx) return
    const r = 0.9 + Math.random() * 0.25
    if (material === 'stone' || material === 'metal') {
      this.noise(0.09, 0.13, 'bandpass', 1400 * r, 1.2)
      this.tone(120 * r, 0.06, 'sine', 0.05)
    } else if (material === 'wood') {
      this.noise(0.1, 0.11, 'bandpass', 700 * r, 1.5)
      this.tone(160 * r, 0.07, 'triangle', 0.04)
    } else if (material === 'water') {
      this.noise(0.22, 0.16, 'lowpass', 900 * r, 0.7)
    } else if (material === 'carpet') {
      this.noise(0.08, 0.06, 'lowpass', 520 * r, 0.7)
    } else {
      this.noise(0.11, 0.1, 'lowpass', 700 * r, 0.7)
    }
  }

  noiseBurst() {
    this.noise(0.14, 0.14, 'bandpass', 900 + Math.random() * 500, 1.1)
    this.tone(90, 0.1, 'sine', 0.05)
  }
  jump() {
    this.tone(320, 0.12, 'triangle', 0.06, 0, 480)
  }
  land() {
    this.noise(0.12, 0.09, 'lowpass', 420, 0.7)
  }
  ui(kind: 'hover' | 'click' | 'open' | 'close' | 'error') {
    if (!this.ctx) return
    switch (kind) {
      case 'hover':
        this.tone(880, 0.05, 'sine', 0.028)
        break
      case 'click':
        this.tone(660, 0.07, 'sine', 0.05)
        this.tone(990, 0.05, 'sine', 0.03, 0.02)
        break
      case 'open':
        this.tone(520, 0.09, 'triangle', 0.05)
        this.tone(780, 0.12, 'triangle', 0.04, 0.05)
        break
      case 'close':
        this.tone(620, 0.09, 'triangle', 0.045)
        this.tone(420, 0.12, 'triangle', 0.035, 0.05)
        break
      case 'error':
        this.tone(200, 0.14, 'square', 0.035)
        break
    }
  }
  pickupSound() {
    this.tone(784, 0.1, 'sine', 0.06)
    this.tone(1175, 0.16, 'sine', 0.045, 0.07)
  }
  questSound() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.05, i * 0.09))
  }
  levelUpSound() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((f, i) => {
      this.tone(f, 0.5, 'sine', 0.05, i * 0.08)
      this.tone(f / 2, 0.5, 'triangle', 0.03, i * 0.08)
    })
  }
  coinSound() {
    this.tone(1046, 0.08, 'square', 0.03)
    this.tone(1568, 0.14, 'square', 0.022, 0.06)
  }
  coffeeSound() {
    this.noise(0.9, 0.09, 'highpass', 1800, 0.6)
    this.tone(220, 0.5, 'sawtooth', 0.02, 0.1, 140)
  }
  sleepSound() {
    const notes = [392, 329.63, 261.63, 196]
    notes.forEach((f, i) => this.tone(f, 0.9, 'sine', 0.04, i * 0.25))
  }
  thunder() {
    this.noise(1.4, 0.22, 'lowpass', 260, 0.5)
    this.tone(60, 1.2, 'sine', 0.12, 0.05, 30)
  }

  // ---------------- generative lo-fi music ----------------
  startMusic() {
    if (!this.ctx || this.musicPlaying) return
    this.musicPlaying = true
    this.nextNoteTime = this.ctx.currentTime + 0.15
    this.step = 0
    // vinyl hiss
    const hiss = this.ctx.createBufferSource()
    hiss.buffer = this.noiseBuf
    hiss.loop = true
    const hf = this.ctx.createBiquadFilter()
    hf.type = 'bandpass'
    hf.frequency.value = 3200
    hf.Q.value = 0.4
    const hg = this.ctx.createGain()
    hg.gain.value = 0.012
    hiss.connect(hf)
    hf.connect(hg)
    hg.connect(this.musicBus!)
    hiss.start()
    this.schedulerId = window.setInterval(() => this.schedule(), 120)
  }

  stopMusic() {
    this.musicPlaying = false
    if (this.schedulerId) window.clearInterval(this.schedulerId)
    this.schedulerId = null
  }

  private midi(n: number) {
    return 440 * Math.pow(2, (n - 69) / 12)
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || !this.musicPlaying) return
    const spb = 60 / this.tempo / 4
    while (this.nextNoteTime < ctx.currentTime + 0.6) {
      this.scheduleStep(this.step, this.nextNoteTime)
      this.step = (this.step + 1) % 64
      this.nextNoteTime += spb
    }
  }

  private pad(freqs: number[], when: number, dur: number, gain: number) {
    const ctx = this.ctx!
    freqs.forEach((f, i) => {
      for (let d = 0; d < 2; d++) {
        const osc = ctx.createOscillator()
        osc.type = d === 0 ? 'triangle' : 'sine'
        osc.frequency.value = f * (d === 0 ? 1 : 2.002)
        osc.detune.value = (Math.random() - 0.5) * 8
        const g = ctx.createGain()
        const t = when + i * 0.04
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(gain / (d + 1.4), t + 0.4)
        g.gain.linearRampToValueAtTime(0.0001, t + dur)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(700, t)
        lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.5)
        osc.connect(lp)
        lp.connect(g)
        g.connect(this.musicBus!)
        if (this.pickup) g.connect(this.pickup)
        osc.start(t)
        osc.stop(t + dur + 0.1)
      }
    })
  }

  private scheduleStep(step: number, when: number) {
    const ctx = this.ctx!
    // 4-bar progression: Dm9 -> Bbmaj7 -> Gm7 -> A7sus
    const chords = [
      [62, 65, 69, 72],
      [58, 62, 65, 69],
      [55, 58, 62, 65],
      [57, 60, 64, 67],
    ]
    const bar = Math.floor(step / 16) % 4
    const inBar = step % 16
    if (inBar === 0) {
      const chord = chords[bar]
      this.pad(
        chord.map((n) => this.midi(n)),
        when,
        (60 / this.tempo) * 3.4,
        0.075,
      )
      // bass
      this.tone(this.midi(chord[0] - 12), 1.4, 'sine', 0.12, 0, undefined, this.musicBus!)
    }
    if (inBar === 8 && Math.random() > 0.35) {
      this.tone(this.midi(chords[bar][2] - 12), 0.9, 'sine', 0.08, 0, undefined, this.musicBus!)
    }
    // soft kick
    if (inBar % 8 === 0) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.frequency.setValueAtTime(110, when)
      osc.frequency.exponentialRampToValueAtTime(46, when + 0.14)
      g.gain.setValueAtTime(0.16, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.26)
      osc.connect(g)
      g.connect(this.musicBus!)
      osc.start(when)
      osc.stop(when + 0.3)
    }
    // brushes/hat
    if (inBar % 4 === 2) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const f = ctx.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = 6500
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.05, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.09)
      src.connect(f)
      f.connect(g)
      g.connect(this.musicBus!)
      src.start(when)
      src.stop(when + 0.12)
    }
    // wandering pluck melody
    if (inBar % 4 === 0 && Math.random() > 0.55) {
      const chord = chords[bar]
      const note = chord[Math.floor(Math.random() * chord.length)] + 12
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = this.midi(note)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, when)
      g.gain.linearRampToValueAtTime(0.045, when + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0008, when + 0.9)
      osc.connect(g)
      g.connect(this.musicBus!)
      if (this.pickup) g.connect(this.pickup)
      osc.start(when)
      osc.stop(when + 1)
    }
  }

  // ---------------- ambience ----------------
  startAmbience() {
    if (!this.ctx || this.ambientTimer) return
    const tick = () => {
      if (!this.ctx) return
      if (this.isNight) {
        // crickets
        for (let i = 0; i < 3; i++) {
          const f = 3800 + Math.random() * 900
          const t = Math.random() * 0.4
          this.noise(0.05, 0.014, 'bandpass', f, 18, t, this.ambientBus!)
        }
      } else if (this.rainLevel < 0.35) {
        // birdsong
        const base = 1900 + Math.random() * 1600
        const kind = Math.random()
        if (kind > 0.5) {
          this.tone(base, 0.1, 'sine', 0.02, 0, base * 1.5, this.ambientBus!)
          this.tone(base * 1.4, 0.09, 'sine', 0.015, 0.12, base, this.ambientBus!)
        } else {
          this.tone(base * 1.2, 0.07, 'sine', 0.018, 0, base * 0.8, this.ambientBus!)
        }
      }
      this.ambientTimer = window.setTimeout(tick, 2200 + Math.random() * 5200)
    }
    this.ambientTimer = window.setTimeout(tick, 1800)
  }

  setRain(level: number) {
    this.rainLevel = level
  }

  setNight(night: boolean) {
    this.isNight = night
  }
}

export const audio = new AudioEngine()
