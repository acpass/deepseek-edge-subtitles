import { encodeWav } from './audio.js';
import { transcribe, translate } from './api.js';
let session;
const send = (s, type, data = {}) => chrome.runtime.sendMessage({target:'background',type,id:s.id,...data}).catch(() => {});
async function stop() {
  const old = session; session = null;
  if (!old) return;
  old.abort.abort(); old.queue.length = 0;
  old.node?.disconnect(); old.source?.disconnect();
  old.stream?.getTracks().forEach(t => t.stop());
  if (old.context && old.context.state !== 'closed') await old.context.close();
  old.settings.apiKey = '';
}
async function start(message) {
  await stop();
  const s = {id:message.id,settings:message.settings,abort:new AbortController(),queue:[],history:[],busy:false,sequence:0,failures:0};
  session = s;
  try {
    s.stream = await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}},video:false});
    s.context = new AudioContext({sampleRate:48000});
    s.source = s.context.createMediaStreamSource(s.stream);
    // Tab capture suppresses normal playback; explicitly route it to the speakers.
    s.source.connect(s.context.destination);
    await s.context.audioWorklet.addModule('pcm-worklet.js');
    s.node = new AudioWorkletNode(s.context,'pcm-recorder',{processorOptions:{seconds:s.settings.seconds},numberOfOutputs:1});
    s.node.port.onmessage = event => {
      if (session !== s) return;
      if (s.queue.length >= 2) { s.queue.shift(); send(s,'status',{text:'处理稍慢，已跳过积压音频以跟上播放。'}); }
      s.queue.push(new Float32Array(event.data)); void drain(s);
    };
    s.source.connect(s.node); s.node.connect(s.context.destination);
    await s.context.resume();
    if (s.context.state !== 'running') throw new Error('音频处理未启动，请回到视频页重新开启字幕。');
    s.stream.getAudioTracks()[0].addEventListener('ended', () => { if (session === s) send(s,'ended'); });
    return {ok:true};
  } catch (error) { await stop(); return {ok:false,error:error.message || '无法捕获此标签页音频。'}; }
}
async function drain(s) {
  if (s.busy) return;
  s.busy = true;
  try {
    while (session === s && s.queue.length) {
      const samples = s.queue.shift(); const seq = ++s.sequence;
      try {
        const original = await transcribe(encodeWav(samples,s.context.sampleRate),s.settings.apiKey,s.abort.signal);
        if (session !== s) break;
        if (!original) continue;
        send(s,'caption',{seq,original,translated:'翻译中…'});
        let translated;
        try { translated = await translate(original,s.history,s.settings,s.abort.signal); }
        catch (error) {
          if (s.abort.signal.aborted) break;
          send(s,'caption',{seq,original,translated:error.message});
          throw error;
        }
        if (session !== s) break;
        s.history.push(original); s.history = s.history.slice(-2);
        s.failures = 0;
        send(s,'caption',{seq,original,translated}); send(s,'status',{text:'正在识别 · 原文 + 简体中文'});
      } catch (error) {
        if (s.abort.signal.aborted) break;
        s.failures++;
        if (error.fatal || s.failures >= 3) {
          await send(s,'fatal',{text:error.message + ' 已停止，请检查后重新开启。'});
          if (session === s) await stop();
          break;
        }
        send(s,'status',{text:error.message});
      }
    }
  } finally { s.busy = false; }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'offscreen') return;
  if (message.type === 'start') { start(message).then(reply); return true; }
  if (message.type === 'stop') { stop().then(() => reply({ok:true})); return true; }
});
