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

// Split on a pause where possible; cap each segment so continuous speech keeps moving.
export class Segmenter {
  constructor(rate, seconds, emit) {
    this.rate = rate; this.max = Math.round(rate * seconds); this.emit = emit; this.reset();
  }
  reset() { this.buffer = new Float32Array(this.max + 4096); this.size = 0; this.quiet = 0; this.voiced = 0; }
  push(channels) {
    if (!channels.length || !channels[0].length) return;
    const n = channels[0].length;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      let v = 0; for (const channel of channels) v += channel[i] || 0;
      v /= channels.length; this.buffer[this.size + i] = v; energy += v * v;
    }
    this.size += n;
    if (Math.sqrt(energy / n) > 0.003) { this.voiced += n; this.quiet = 0; } else this.quiet += n;
    if (this.size >= this.max || (this.size >= this.rate && this.quiet >= this.rate * 0.5)) {
      if (this.voiced >= this.rate * 0.12) this.emit(this.buffer.slice(0, this.size));
      this.reset();
    }
  }
}
