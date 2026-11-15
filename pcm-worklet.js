import { Segmenter } from './audio.js';
class PCMRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.segmenter = new Segmenter(sampleRate, options.processorOptions.seconds, samples => {
      this.port.postMessage(samples.buffer, [samples.buffer]);
    });
  }
  process(inputs) { this.segmenter.push(inputs[0] || []); return true; }
}
registerProcessor('pcm-recorder', PCMRecorder);
