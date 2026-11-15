const $ = id => document.getElementById(id);
const tell = (text,error=false) => { $('message').textContent=text; $('message').className=error?'error':''; };
const call = message => chrome.runtime.sendMessage({target:'background',...message});
let currentTab, busy=false;
async function refresh() {
  const result=await call({type:'get-state'});
  const running=!!result.capture;
  $('dot').className=running?'on':''; $('stop').hidden=!running;
  $('status').textContent=running ? (result.capture.tabId===currentTab?.id ? result.capture.status : '另一个标签页正在显示字幕') : '尚未开启字幕';
  $('start').textContent=running?'在当前页重新开启':'开启当前页字幕';
  if (result.lastError && !running) tell(result.lastError,true);
}
async function save() {
  const apiKey=$('apiKey').value.trim();
  if (!apiKey || /\s/.test(apiKey)) throw new Error('请填写有效的 API Key（不要包含空格）。');
  const model=$('model').value.trim();
  if (!model) throw new Error('请填写翻译模型名称。');
  await chrome.storage.local.set({settings:{model,seconds:Number($('seconds').value),fontSize:Number($('fontSize').value)}});
  if ($('remember').checked) { await chrome.storage.local.set({apiKey}); await chrome.storage.session.remove('apiKey'); }
  else { await chrome.storage.session.set({apiKey}); await chrome.storage.local.remove('apiKey'); }
  await chrome.storage.session.remove('lastError');
}
async function action(fn) {
  if(busy) return; busy=true; document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try { await fn(); } catch(error) { tell(error.message,true); }
  finally { busy=false; document.querySelectorAll('button').forEach(b=>b.disabled=false); }
}
$('fontSize').oninput=()=>{$('sizeValue').textContent=$('fontSize').value;};
$('save').onclick=()=>action(async()=>{await save();tell('设置已保存；正在运行的字幕需重新开启后生效。');});
$('start').onclick=()=>action(async()=>{
  await save(); [currentTab]=await chrome.tabs.query({active:true,currentWindow:true});
  if (!currentTab?.id) throw new Error('没有找到当前标签页。');
  tell('正在连接当前标签页…');
  const result=await call({type:'start',tabId:currentTab.id});
  if(!result?.ok) throw new Error(result?.error || '开启失败。');
  tell('已开启，可以关闭此面板并播放视频。'); await refresh();
});
$('stop').onclick=()=>action(async()=>{await call({type:'stop'});tell('已停止音频捕获和后续请求。');await refresh();});
async function init() {
  const [local,temp,tabs]=await Promise.all([chrome.storage.local.get(['apiKey','settings']),chrome.storage.session.get('apiKey'),chrome.tabs.query({active:true,currentWindow:true})]);
  currentTab=tabs[0]; $('apiKey').value=temp.apiKey||local.apiKey||''; $('remember').checked=!!local.apiKey;
  const settings=local.settings||{}; for(const id of ['model','seconds','fontSize']) if(settings[id]!=null) $(id).value=settings[id];
  $('sizeValue').textContent=$('fontSize').value; await refresh();
}
init().catch(error=>tell(error.message,true));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session' && changes.capture && !busy) refresh().catch(()=>{});});
