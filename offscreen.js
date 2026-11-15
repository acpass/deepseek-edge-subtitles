import { encodeWav } from './audio.js';
import { transcribe, translate } from './api.js';
import { PendingUtterances, trimAudioOverlap } from './transcript.js';
let session;
const send = (s, type, data = {}) => chrome.runtime.sendMessage({target:'background',type,id:s.id,...data}).catch(() => {});
async function stop() {
  const old = session; session = null;
  if (!old) return;
  old.abort.abort(); old.queue.clear();
  old.node?.disconnect(); old.source?.disconnect();
  old.stream?.getTracks().forEach(t => t.stop());
  if (old.context && old.context.state !== 'closed') await old.context.close();
  old.settings.apiKey = '';
}
async function start(message) {
  await stop();
  const s = {id:message.id,settings:message.settings,abort:new AbortController(),queue:new PendingUtterances(),history:[],busy:false,failures:0,current:null,lastUtterance:0};
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
      const skipped = s.queue.push({...event.data,samples:new Float32Array(event.data.audio)});
      if (skipped) send(s,'status',{text:'处理稍慢，已跳过积压话语；跳过处会重置翻译上下文。'});
      void drain(s);
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
      const segment = s.queue.shift(); const seq = segment.utterance;
      if (seq !== s.lastUtterance) {
        if (seq !== s.lastUtterance+1) { s.history = []; s.current = null; }
        if (s.current) s.history.push({original:s.current.original,translated:s.current.translated});
        s.history = s.history.slice(-4); s.current = null; s.lastUtterance = seq;
      }
      try {
        const raw = await transcribe(encodeWav(segment.samples,s.context.sampleRate),s.settings.apiKey,s.abort.signal);
        if (session !== s) break;
        // A longer snapshot supersedes a pending shorter one. Do not translate
        // stale half-sentences when their continuation is already waiting.
        if (s.queue.hasNewer(segment)) continue;
        const original = trimAudioOverlap(s.history.at(-1)?.original,raw,segment.continued);
        if (!original) continue;
        s.current = {original,translated:''};
        let translated;
        try { translated = await translate(original,s.history,s.settings,s.abort.signal,segment); }
        catch (error) {
          if (s.abort.signal.aborted) break;
          send(s,'caption',{seq,original,translated:error.message});
          throw error;
        }
        if (session !== s) break;
        s.current = {original,translated};
        s.failures = 0;
        send(s,'caption',{seq,original,translated});
        send(s,'status',{text:segment.final && segment.reason==='pause' ? '停顿定稿 · 原文 + 简体中文' : '句子尚未结束 · 字幕会随下文修订'});
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
