const {chromium}=require('playwright');
const path=require('node:path');
const fs=require('node:fs/promises');
const http=require('node:http');
const os=require('node:os');
const assert=require('node:assert/strict');
(async()=>{
  const extension=path.resolve(__dirname,'..');
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'deepseek-subtitles-test-'));
  const resultDir=path.join(extension,'test-results');
  await fs.mkdir(resultDir,{recursive:true});
  const context=await chromium.launchPersistentContext(profile,{
    channel:process.env.BROWSER_CHANNEL || 'chromium',headless:true,
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--autoplay-policy=no-user-gesture-required'],
    viewport:{width:1100,height:760}
  });
  try{
    let worker=context.serviceWorkers()[0];
    if(!worker) worker=await context.waitForEvent('serviceworker',{timeout:15000});
    const id=new URL(worker.url()).hostname;
    await worker.evaluate(async()=>{await chrome.storage.local.clear();await chrome.storage.session.clear();});
    console.log('Extension service worker loaded:',id);
    const popup=await context.newPage();const errors=[];
    popup.on('pageerror',e=>errors.push(e.message));
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.getByText('尚未开启字幕',{exact:true}).waitFor();
    await popup.screenshot({path:path.join(resultDir,'popup.png')});
    await popup.locator('#apiKey').fill('LOCAL_TEST_KEY');
    await popup.locator('#save').click();
    await popup.getByText('设置已保存；正在运行的字幕需重新开启后生效。').waitFor();
    const storage=await worker.evaluate(async()=>({local:await chrome.storage.local.get('apiKey'),session:await chrome.storage.session.get('apiKey')}));
    if(storage.local.apiKey || storage.session.apiKey!=='LOCAL_TEST_KEY') throw Error('Session-only key storage failed');
    await popup.locator('#remember').check();await popup.locator('#save').click();
    await popup.getByText('设置已保存；正在运行的字幕需重新开启后生效。').waitFor();
    await popup.waitForFunction(async()=>!!(await chrome.storage.local.get('apiKey')).apiKey);
    console.log('Popup renders and both key-storage modes work.');
    // Exercise AudioWorklet and WAV upload in the real browser, using synthetic
    // audio and mocked DeepSeek responses. No real credentials or API traffic.
    await worker.evaluate(()=>{globalThis.observed=[];chrome.runtime.onMessage.addListener(m=>{if(m.target==='background')globalThis.observed.push(m);});});
    const processor=await context.newPage();
    processor.on('pageerror',e=>errors.push(e.message));
    await processor.addInitScript(()=>{
      globalThis.requests=[];
      navigator.mediaDevices.getUserMedia=async()=>{
        const audio=new AudioContext({sampleRate:48000});const oscillator=audio.createOscillator();const dest=audio.createMediaStreamDestination();
        const gain=audio.createGain();
        oscillator.frequency.value=440;oscillator.connect(gain);gain.connect(dest);oscillator.start();await audio.resume();
        globalThis.syntheticGain=gain;globalThis.syntheticAudio=audio;return dest.stream;
      };
      globalThis.fetch=async(url,init)=>{
        globalThis.requests.push({url,body:typeof init.body==='string'?JSON.parse(init.body):null});
        if(url.endsWith('/tools/asr')) {
          const file=init.body.get('file');const bytes=await file.arrayBuffer();const view=new DataView(bytes);
          if(view.getUint16(22,true)!==1||view.getUint16(34,true)!==16||view.getUint32(24,true)!==48000) throw Error('Invalid audio upload');
          globalThis.requests.at(-1).audioBytes=bytes.byteLength;
          const text=bytes.byteLength<48000*2*5 ? 'A small step today' : 'A small step today can make a big difference tomorrow.';
          return new Response(JSON.stringify({text}),{headers:{'Content-Type':'application/json'}});
        }
        const current=JSON.parse(JSON.parse(init.body).messages[1].content).current;
        return new Response(JSON.stringify({choices:[{message:{content:current==='A small step today'?'今天迈出一小步…':'今天迈出一小步，明天就可能大不相同。'}}]}),{headers:{'Content-Type':'application/json'}});
      };
    });
    await processor.goto(`chrome-extension://${id}/offscreen.html`);
    const capture={id:'local-test',tabId:999999,status:'test'};
    await worker.evaluate(async capture=>{
      await chrome.storage.session.set({capture});
      const result=await chrome.runtime.sendMessage({target:'offscreen',type:'start',id:capture.id,streamId:'synthetic',settings:{seconds:3,apiKey:'TEST_KEY',model:'deepseek-flash'}});
      if(!result.ok)throw Error(result.error);
    },capture);
    await processor.waitForFunction(()=>globalThis.requests.filter(x=>x.url.endsWith('/chat/completions')).length>=2,{},{timeout:15000});
    await processor.evaluate(()=>syntheticGain.gain.value=0);
    await processor.waitForFunction(()=>globalThis.requests.filter(x=>x.url.endsWith('/chat/completions')).some(x=>!JSON.parse(x.body.messages[1].content).provisional),{},{timeout:5000});
    // Background forwarding is asynchronous; wait for the final pair, not just fetch invocation.
    const deadline=Date.now()+5000;
    while(!await worker.evaluate(()=>globalThis.observed.some(m=>m.type==='status'&&m.text.startsWith('停顿定稿')))) {
      if(Date.now()>deadline)throw Error('Sentence finalization was not forwarded');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const messages=await worker.evaluate(()=>globalThis.observed);
    const revisions=messages.filter(m=>m.type==='caption');
    assert.ok(revisions.length>=3);
    assert.ok(revisions.every(m=>m.seq===1),'Growing phrase must revise the same caption');
    assert.equal(revisions[0].original,'A small step today');
    assert.equal(revisions.at(-1).original,'A small step today can make a big difference tomorrow.');
    const requests=await processor.evaluate(()=>globalThis.requests);
    const uploads=requests.filter(x=>x.audioBytes);
    assert.ok(uploads[1].audioBytes>uploads[0].audioBytes*1.9,'Second request must contain the first request audio too');
    assert.ok(requests.filter(x=>x.body).every(x=>JSON.parse(x.body.messages[1].content).previous.length===0),'A phrase must not become its own previous context');
    const caption=messages.find(m=>m.type==='caption'&&m.translated==='今天迈出一小步，明天就可能大不相同。');
    if(!caption)throw Error('Translated caption missing');
    await worker.evaluate(()=>chrome.runtime.sendMessage({target:'offscreen',type:'stop'}));
    if(!await processor.evaluate(()=>syntheticAudio.state==='running'))throw Error('Synthetic fixture unexpectedly stopped');
    await processor.evaluate(()=>syntheticAudio.close());
    console.log('Growing AudioWorklet snapshots revise one caption, preserve full sentence audio, and finalize at a pause.');
    const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><body style="margin:0;background:#163833;color:#fff;font-family:system-ui"><main style="padding:100px"><p style="letter-spacing:3px;color:#8dc5ae">BILINGUAL CAPTIONS / 双语字幕</p><h1 style="font-size:52px">让每一句，都听得懂。</h1><p style="color:#a3bcaf">字幕界面示例 · 使用模拟识别结果</p></main></body></html>');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    try{
      const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(id=>{globalThis.chrome={runtime:{id,onMessage:{addListener:fn=>globalThis.receiveCaption=fn},sendMessage:async()=>{globalThis.stopped=true;}}};},id);
      await page.addScriptTag({content:await fs.readFile(path.join(extension,'content.js'),'utf8')});
      await page.evaluate(({id,caption})=>{
        receiveCaption({channel:'deepseek-subtitles',type:'show',fontSize:26,text:'正在识别 · 原文 + 简体中文'},{id});
        receiveCaption({channel:'deepseek-subtitles',...caption},{id});
      },{id,caption});
      const popover=page.locator('[popover]');await popover.waitFor({state:'visible'});
      await page.screenshot({path:path.join(resultDir,'overlay.png')});
      await page.evaluate(()=>document.documentElement.requestFullscreen());
      await page.waitForFunction(()=>!!document.fullscreenElement);
      if(!await popover.evaluate(el=>el.matches(':popover-open')))throw Error('Overlay not in top layer during fullscreen');
      await page.evaluate(()=>document.exitFullscreen());
      await page.evaluate(id=>receiveCaption({channel:'deepseek-subtitles',type:'hide'},{id}),id);
      if(await popover.count())throw Error('Overlay did not disappear on stop');
      console.log('Overlay renders, survives fullscreen, and removes on stop.');
    }finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});}
    if(errors.length) throw Error(errors.join('\n'));
    await worker.evaluate(async()=>{await chrome.storage.local.clear();await chrome.storage.session.clear();});
  }finally{await context.close(); if(path.basename(profile).startsWith("deepseek-subtitles-test-") && path.dirname(profile)===os.tmpdir()) await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
