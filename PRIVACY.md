# Privacy / 隐私说明

## English

The extension captures audio only after you click its start button for a tab. It does not request microphone access, capture video frames, read webpage text, or include analytics. It makes recognition and translation requests directly to `api.deepseek.com`; there is no project-operated backend.

### What leaves your device

- Short mono WAV segments go to DeepSeek's ASR endpoint.
- The resulting transcript and up to two previous source-text segments go to DeepSeek's chat endpoint for translation.
- Your DeepSeek API key is sent in the Authorization header of these requests.

DeepSeek's own terms and data practices govern data received by DeepSeek. This project cannot promise or control provider-side deletion, retention, or billing.

### Local storage

- Settings are saved in `chrome.storage.local`.
- By default, the key is saved in `chrome.storage.session`. A browser running in the background can outlive its last visible window.
- If you enable “remember key,” it is saved in `chrome.storage.local`. It is not synced or separately encrypted by this extension.
- Local and session storage access is restricted to trusted extension contexts. Webpage content scripts do not receive the key.
- Recordings and transcript history are not written to disk. Short audio buffers, queued segments, and limited translation context exist in memory while processing. The current caption is displayed on the page.
- Stop clears the processing queue and cancels local outstanding requests. Already-submitted requests may still be processed and billed by DeepSeek. Uninstalling the extension removes its extension storage through the browser's normal uninstall behavior.

### Permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Access the tab after you invoke the extension |
| `scripting` | Insert the subtitle overlay into that tab |
| `tabCapture` | Capture that tab's audio |
| `offscreen` | Process audio after the popup closes |
| `storage` | Save settings, the key, and active capture state |
| `https://api.deepseek.com/*` | Send ASR and translation requests to DeepSeek |

The extension does not request blanket access to all websites. Screenshots and issue reports are not uploaded automatically.

## 简体中文

只有点击开启字幕后，扩展才捕获指定标签页的音频。不申请麦克风权限，不采集视频画面或网页正文，不包含统计追踪。识别和翻译直接请求 `api.deepseek.com`，没有项目维护者运营的后端。

### 发送到外部的数据

- 短 WAV 音频片段发送至 DeepSeek ASR。
- 识别文字及最多两段先前原文发送至 DeepSeek 聊天接口，用于翻译。
- DeepSeek API Key 通过这些请求的 Authorization 请求头发送。

DeepSeek 收到的数据适用其自身条款与数据政策；本项目无法控制或承诺服务商的数据保留、删除和计费行为。

### 本机数据

- 设置保存在 `chrome.storage.local`。
- Key 默认保存在 `chrome.storage.session`。浏览器后台进程可能在最后一个窗口关闭后仍继续运行。
- 勾选“记住 Key”后改存 `chrome.storage.local`，不作同步，也不由本扩展额外加密。
- 存储访问限制为受信任的扩展页面，网页内容脚本不会收到 Key。
- 不把录音或字幕历史写入磁盘。运行时在内存保存短音频、待处理片段及有限翻译上下文，当前字幕显示在网页上。
- 停止会清空处理队列并取消本地未完成请求，但已经提交的请求仍可能被 DeepSeek 处理和计费。通过浏览器正常卸载扩展会移除其扩展存储。

### 权限用途

`activeTab` 用于主动调用后的当前页访问，`scripting` 用于添加字幕浮层，`tabCapture` 用于标签页音频，`offscreen` 用于关闭面板后继续处理，`storage` 用于保存设置、Key 和运行状态。唯一长期主机权限为 `https://api.deepseek.com/*`。

不申请所有网站的长期访问权限，不自动上传截图或问题报告。
