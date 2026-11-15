# Changelog / 更新记录

## 1.0.0 — 2026-11-15

### English

Initial open-source release of the Edge extension.

- Tab audio capture with AudioWorklet-based mono PCM WAV encoding.
- DeepSeek ASR and DeepSeek chat translation into Simplified Chinese.
- Original/translated subtitle overlay with dragging, font controls, and webpage fullscreen support.
- 3/4/6-second segmentation, pause splitting, quiet-audio filtering, bounded queue, and request cancellation.
- Session-only API key storage by default, optional local storage, and automatic stop on relevant tab events/errors.
- English and Chinese documentation, privacy notes, MIT license, tests, and reproducible release packaging.

Validation uses synthetic audio and mocked API responses. Real DeepSeek quality, billing, and latency are not benchmarked in this release. Captions are segment-based rather than streaming.

### 简体中文

Edge 扩展首个开源版本。

- 捕获标签页音频，使用 AudioWorklet 编码单声道 PCM WAV。
- DeepSeek 语音识别与 DeepSeek 简体中文翻译。
- 原文/中文双语浮层，支持拖动、字号调整和网页全屏。
- 3/4/6 秒分段、停顿断句、安静音频过滤、有限队列及请求取消。
- 默认会话内保存 Key，可选本机保存，并在相关标签页事件或错误时自动停止。
- 中英文文档、隐私说明、MIT 许可证、测试与可复现的发布打包流程。

验证使用人工音频和模拟 API 响应，未测评真实 DeepSeek 识别翻译质量、费用或延迟。字幕为分段更新，不是流式逐字字幕。
