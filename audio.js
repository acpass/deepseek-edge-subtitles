export function encodeWav(samples, sampleRate) {
  if (![8000, 16000, 22050, 24000, 32000, 44100, 48000].includes(sampleRate)) throw new Error('不支持的采样率');
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  str(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => { const s = Math.max(-1, Math.min(1, v)); view.setInt16(44 + i * 2, Math.round(s * (s < 0 ? 32768 : 32767)), true); });
  return buffer;
}

// Refresh a growing utterance without cutting it at every display interval.
// A real pause finalizes it; very long speech rolls over with shared audio.
export class Segmenter {
  constructor(rate, seconds, emit) {
    this.rate = rate; this.interval = Math.round(rate * seconds); this.max = rate * 18;
    this.emit = emit; this.utterance = 0; this.overlap = Math.round(rate * 1.2); this.reset();
  }
  reset(tail = null) {
    this.buffer = new Float32Array(this.max + 4096); this.size = tail?.length || 0;
    if (tail) this.buffer.set(tail);
    this.quiet = 0; this.voiced = 0; this.active = !!tail; this.continued = !!tail;
    this.revision = 0; this.lastEmission = this.size; this.newVoice = 0;
  }
  snapshot(final, reason) {
    const samples = this.buffer.slice(0, this.size);
    this.emit(samples, {utterance:this.utterance,revision:++this.revision,final,reason,continued:this.continued});
    this.lastEmission = this.size; this.newVoice = 0;
  }
  push(channels) {
    if (!channels.length || !channels[0].length) return;
    const n = channels[0].length;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      let v = 0; for (const channel of channels) v += channel[i] || 0;
      v /= channels.length; this.buffer[this.size + i] = v; energy += v * v;
    }
    const speaking = Math.sqrt(energy / n) > 0.003;
    this.size += n;
    if (!this.active) {
      if (speaking) { this.active = true; this.utterance++; }
      else {
        // Keep a short lead-in so speech onset is not clipped, without recording long silence.
        const keep = Math.min(this.size, Math.round(this.rate * 0.2));
        this.buffer.copyWithin(0,this.size-keep,this.size); this.size = keep; return;
      }
    }
    if (speaking) { this.voiced += n; this.newVoice += n; this.quiet = 0; } else this.quiet += n;
    if (this.quiet >= this.rate * 0.7) {
      if (this.voiced >= this.rate * 0.12) this.snapshot(true,'pause');
      this.reset(); return;
    }
    if (this.size >= this.max) {
      if (this.voiced >= this.rate * 0.12) this.snapshot(true,'limit');
      const tail = this.buffer.slice(this.size-this.overlap,this.size);
      this.utterance++; this.reset(tail); return;
    }
    if (this.size-this.lastEmission >= this.interval && this.newVoice >= this.rate * 0.12) {
      this.snapshot(false,'refresh');
    }
  }
}
