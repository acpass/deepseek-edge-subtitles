# Contributing / 参与贡献

## English

Bug reports, documentation corrections, and focused pull requests are welcome.

For a bug report, include your Edge version, extension version, page/player type, segment length, model name, relevant HTTP status code, and steps to reproduce. State whether it occurs in normal view, fullscreen, or picture-in-picture. Remove API keys, authorization headers, private URLs, and private speech before sharing logs or screenshots.

For code changes, run `npm ci`, `npm run check`, and `npm test`. For audio, popup, or overlay changes, also run `npm run test:browser` with Playwright installed and perform an appropriate manual browser check. Tests must not make paid API requests. Keep the Chinese and English READMEs consistent, and update privacy documentation when data handling or permissions change.

Use [Issues](https://github.com/acpass/deepseek-edge-subtitles/issues) for ordinary defects. Do not post secrets or exploitable security details publicly; use GitHub's private vulnerability reporting if the repository offers it. No dedicated security response SLA is provided.

## 简体中文

欢迎提交问题、修正文档或发起范围明确的 Pull Request。

反馈时请提供 Edge 版本、扩展版本、网页或播放器类型、分段长度、模型名、相关 HTTP 状态码和复现步骤，并说明发生在普通模式、全屏还是画中画。分享日志或截图前请移除 Key、Authorization 请求头、私人网址及私人语音内容。

修改代码后执行 `npm ci`、`npm run check` 和 `npm test`。涉及音频、面板或字幕浮层时，还应在安装 Playwright 后运行 `npm run test:browser`，并进行相应的浏览器人工检查。自动测试不得调用付费接口。请保持中英文 README 一致，涉及数据处理或权限变化时同步修改隐私说明。

普通问题请使用 [Issues](https://github.com/acpass/deepseek-edge-subtitles/issues)。不要公开发布密钥或可直接利用的安全细节；如果仓库提供 GitHub 私密漏洞报告入口，请使用该入口。本项目没有专门的安全响应时限承诺。
