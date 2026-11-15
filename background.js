const ready = Promise.all([
  chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),
  chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
]);
let tasks = Promise.resolve();
const serial = fn => { const next = tasks.then(fn); tasks = next.catch(() => {}); return next; };
const state = async () => (await chrome.storage.session.get('capture')).capture;
const put = capture => chrome.storage.session.set({capture});
async function overlay(tabId, message) {
  try { await chrome.tabs.sendMessage(tabId,{channel:'deepseek-subtitles',...message}); } catch { /* Page may have navigated. */ }
}
async function stop(reason = '', keepOverlay = false) {
  const current = await state();
  await chrome.storage.session.remove('capture');
  try { await chrome.runtime.sendMessage({target:'offscreen',type:'stop'}); } catch {}
  if (current) {
    await overlay(current.tabId,{type:keepOverlay ? 'error' : 'hide',text:reason});
    await chrome.action.setBadgeText({tabId:current.tabId,text:''}).catch(() => {});
  }
  if (reason) await chrome.storage.session.set({lastError:reason});
}
async function start(tabId) {
  const saved = await chrome.storage.local.get(['settings','apiKey']);
  const temporary = await chrome.storage.session.get('apiKey');
  const settings = {...{model:'deepseek-flash',seconds:4,fontSize:24},...saved.settings,apiKey:temporary.apiKey || saved.apiKey || ''};
  if (!settings.apiKey) throw new Error('请先填写并保存 DeepSeek API Key。');
  settings.seconds = [3,4,6].includes(Number(settings.seconds)) ? Number(settings.seconds) : 4;
  settings.fontSize = Math.min(40,Math.max(16,Number(settings.fontSize)||24));
  settings.model = String(settings.model || 'deepseek-flash').trim();
  const tab = await chrome.tabs.get(tabId);
  if (!/^https?:\/\//.test(tab.url || '')) throw new Error('请在播放视频的普通网页开启字幕，Edge 设置页和新标签页不支持。');
  await stop();
  await chrome.scripting.executeScript({target:{tabId},files:['content.js']});
  const contexts = await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
  if (!contexts.length) await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'捕获用户选择的标签页音频并生成双语字幕'});
  const streamId = await chrome.tabCapture.getMediaStreamId({targetTabId:tabId});
  const capture = {id:crypto.randomUUID(),tabId,status:'等待声音 · 原文 + 简体中文'};
  await put(capture);
  try {
    await overlay(tabId,{type:'show',fontSize:settings.fontSize,text:capture.status});
    const result = await chrome.runtime.sendMessage({target:'offscreen',type:'start',id:capture.id,streamId,settings});
    if (!result?.ok) throw new Error(result?.error || '音频捕获未启动。');
    await chrome.storage.session.remove('lastError');
    await chrome.action.setBadgeBackgroundColor({tabId,color:'#12796c'});
    await chrome.action.setBadgeText({tabId,text:'ON'});
    return {ok:true,capture};
  } catch (error) { await stop(error.message,true); throw error; }
}
async function handle(message,sender) {
  await ready;
  const fromPopup = sender.url === chrome.runtime.getURL('popup.html');
  const fromOffscreen = sender.url === chrome.runtime.getURL('offscreen.html');
  if (message.type === 'get-state' && fromPopup) return {ok:true,capture:await state(),...(await chrome.storage.session.get('lastError'))};
  if (message.type === 'start' && fromPopup) return start(message.tabId);
  if (message.type === 'stop') {
    const current = await state();
    if (fromPopup || (sender.tab?.id === current?.tabId)) { await stop(); return {ok:true}; }
  }
  if (fromOffscreen) {
    const current = await state();
    if (!current || current.id !== message.id) return {ok:false};
    if (message.type === 'ended') { await stop(); return {ok:true}; }
    if (message.type === 'fatal') { await stop(message.text,true); return {ok:true}; }
    if (message.type === 'caption') await overlay(current.tabId,{type:'caption',seq:message.seq,original:message.original,translated:message.translated});
    if (message.type === 'status') { current.status = message.text; await put(current); await overlay(current.tabId,{type:'status',text:message.text}); }
    return {ok:true};
  }
  return {ok:false,error:'不支持的操作。'};
}
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'background') return;
  serial(() => handle(message,sender)).then(reply,error => reply({ok:false,error:error.message || '操作失败。'}));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => { void serial(async () => { if ((await state())?.tabId === tabId) await stop(); }); });
chrome.tabs.onUpdated.addListener((tabId,change) => {
  if (change.status === 'loading') void serial(async () => { if ((await state())?.tabId === tabId) await stop(); });
});
