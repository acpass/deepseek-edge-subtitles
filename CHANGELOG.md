# Changelog / 更新记录

## 1.1.0 — 2026-11-15

### English

- Fix abrupt 3/4/6-second cuts: the setting now controls refresh frequency, while each snapshot keeps the full growing utterance. A roughly 700 ms pause finalizes it.
- Re-translate the entire current utterance when later words arrive, using up to four prior original/translated pairs. Update the two subtitle lines together.
- Limit very long utterances to 18-second windows, retaining 1.2 seconds of audio across rollovers with best-effort text deduplication.
- Coalesce pending revisions of the same utterance and reset context when queued utterances are skipped.
- Add regression coverage for cumulative audio, revision identity, pause finalization, rollover, queue coalescing, and bilingual context. Twelve unit tests and Edge browser smoke checks pass with mocked API responses.

Repeated recognition increases uploaded audio and ASR charges. There is still no semantic sentence-boundary guarantee, and live DeepSeek translation quality has not been benchmarked.

### 简体中文

- 修复到 3/4/6 秒就强行切句的问题：设置改为刷新频率，当前话语音频持续累积，约 700 毫秒停顿后定稿。
- 后文到达时重新翻译整段当前话语，并参考最多四段前文原文与译文；双语字幕同时更新。
- 超长连续话语使用 18 秒窗口，换窗保留 1.2 秒音频重叠，并尽可能去除重复识别文字。
- 同一句的待处理版本合并为最新版本；跳过积压话语时重置上下文。
- 增加累积音频、字幕修订、停顿定稿、换窗、队列合并及双语上下文回归验证；12 项单元测试和 Edge 模拟浏览器检查通过。

重复识别会增加上传音频及 ASR 计费量。仍不能保证语义上准确断句，尚未测评真实 DeepSeek 翻译质量。

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
