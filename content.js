(() => {
  if (globalThis.__deepseekSubtitleInstalled) return;
  globalThis.__deepseekSubtitleInstalled = true;
  let host,root,original,translated,status,lastSeq = 0,hideTimer;
  const stop = () => chrome.runtime.sendMessage({target:'background',type:'stop'}).catch(() => {});
  function hide() { clearTimeout(hideTimer); host?.remove(); host = null; }
  function create(size) {
    hide(); lastSeq = 0;
    host = document.createElement('div'); host.setAttribute('popover','manual');
    host.style.cssText = 'all:initial;position:fixed;inset:auto;left:50%;bottom:7%;transform:translateX(-50%);width:min(860px,90vw);height:auto;margin:0;padding:0;border:0;background:transparent;overflow:visible;z-index:2147483647;color-scheme:dark;';
    root = host.attachShadow({mode:'closed'});
    root.innerHTML = `<style>
      :host{font-family:system-ui,"Microsoft YaHei",sans-serif} *{box-sizing:border-box}
      .panel{border:1px solid #ffffff25;border-radius:15px;background:rgba(12,19,27,.88);box-shadow:0 8px 40px #0006;color:#fff;padding:10px 18px 16px;backdrop-filter:blur(10px)}
      header{display:flex;gap:10px;align-items:center;cursor:grab;touch-action:none;user-select:none;color:#aabcc5;font-size:11px;line-height:24px}
      .dot{width:6px;height:6px;border-radius:50%;background:#70dfc2;flex:none} .status{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      button{border:0;border-radius:5px;background:#ffffff12;color:#dce9ee;font-size:12px;padding:3px 9px;cursor:pointer} button:hover{background:#ffffff30}button:focus-visible{outline:2px solid #70dfc2}
      .original{font-size:.76em;color:#d2dbe1;line-height:1.45;margin:5px 0 8px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:20vh;overflow:auto}
      .translated{font-weight:600;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;max-height:25vh;overflow:auto}
      .empty{display:none}
    </style><section class="panel" aria-label="DeepSeek 双语字幕"><header><span class="dot"></span><span class="status"></span><button class="smaller" title="缩小字幕" aria-label="缩小字幕">A−</button><button class="larger" title="放大字幕" aria-label="放大字幕">A+</button><button class="stop" title="停止识别并关闭字幕">停止 ×</button></header><div class="original"></div><div class="translated" aria-live="polite"></div></section>`;
    const panel = root.querySelector('.panel'); panel.style.fontSize = size + 'px';
    original = root.querySelector('.original'); translated = root.querySelector('.translated'); status = root.querySelector('.status');
    root.querySelector('.stop').onclick = () => { stop(); hide(); };
    const resize = delta => { size = Math.max(16,Math.min(40,size + delta)); panel.style.fontSize = size + 'px'; };
    root.querySelector('.smaller').onclick = () => resize(-2); root.querySelector('.larger').onclick = () => resize(2);
    const header = root.querySelector('header'); let drag;
    header.onpointerdown = e => {
      if (e.target.closest('button')) return;
      const rect = host.getBoundingClientRect(); drag = {x:e.clientX-rect.left,y:e.clientY-rect.top};
      header.setPointerCapture(e.pointerId);
    };
    header.onpointermove = e => {
      if (!drag || !host) return;
      const rect = host.getBoundingClientRect();
      host.style.left = Math.max(0,Math.min(innerWidth-rect.width,e.clientX-drag.x))+'px';
      host.style.top = Math.max(0,Math.min(innerHeight-rect.height,e.clientY-drag.y))+'px';
      host.style.bottom = 'auto'; host.style.transform = 'none';
    };
    header.onpointerup = header.onpointercancel = () => { drag = null; };
    document.documentElement.append(host);
    try { host.showPopover(); } catch {}
  }
  document.addEventListener('fullscreenchange',() => {
    if (!host) return;
    host.style.left='50%'; host.style.top='auto'; host.style.bottom='7%'; host.style.transform='translateX(-50%)';
    try { host.hidePopover(); host.showPopover(); } catch {}
  });
  chrome.runtime.onMessage.addListener((message,sender) => {
    if (sender.id !== chrome.runtime.id || message.channel !== 'deepseek-subtitles') return;
    if (message.type === 'hide') { hide(); return; }
    if (message.type === 'show') { create(message.fontSize || 24); status.textContent=message.text; original.textContent=''; translated.textContent='正在等待标签页里的声音…'; return; }
    if (!host) return;
    if (message.type === 'status' || message.type === 'error') {
      status.textContent=message.text;
      if (message.type === 'error') { clearTimeout(hideTimer); translated.textContent=message.text; }
    }
    if (message.type === 'caption' && message.seq >= lastSeq) {
      lastSeq=message.seq; clearTimeout(hideTimer);
      original.textContent=message.original; translated.textContent=message.translated;
      hideTimer=setTimeout(() => { if(host) { original.textContent=''; translated.textContent=''; } },20000);
    }
  });
})();
