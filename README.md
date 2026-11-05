# clash-modules

Simonxiaoxueboshi 自己维护的 Loon 插件，给 Hako Clash（Mac / iPhone）使用。

## 结构

- `Tool/Clash/*.lpx`：插件。
- `Resource/JavaScript/`、`Resource/Script/`：脚本和脚本用到的文件。
- `Resource/JQLang/`：jq 文件。
- `Icon/`：插件图标。
- `Docs/`：插件说明页。

插件引用的脚本、jq、图标、说明页都放在本仓库，不依赖外部服务器。

## 导入

最简单：在 Mac 或 iPhone 上打开 https://simonxiaoxueboshi.github.io/clash-modules/ ，点插件名会拉起 Clash 并填好链接，再点「添加」。

原理是 `hako://install-module?url=<URL 编码后的模块链接>`，也可以自己拼。

手动方式：

在 Clash → 模块 → 添加模块 → 链接，填：

```
https://raw.githubusercontent.com/Simonxiaoxueboshi/clash-modules/main/Tool/Clash/<插件名>.lpx
```

完整列表见 `导入链接.txt`。

## 说明

- `Bilibili_remove_ads.lpx`：`#!system` 加了 `macOS`，否则 Mac 版 Clash 拒收。
- 不收录 BoxJs：Hako Clash 专门不支持。
- 以下仍指向各自的开源项目：iRingo、Sub-Store、Script-Hub，Apple天气增强用到的 NSRingo 脚本，iptest、nodetcpcheck、dev-loopback 插件本身，以及 Script-Hub/Sub-Store 等少数图标（Koolson/Qure）。
- `#!author` 里保留了脚本原作者的署名。

## 维护

某个 App 又出现广告时，记下 App、界面，最好附抓包或截图，再改对应插件里的正则 / jq / 脚本。
YouTube（去广告、字幕翻译）、哔哩哔哩、网易云的脚本是编译后的打包文件。优先从开源源码重新编译；本仓库对 YouTube 响应包的局部修改使用 AST 替换，并用 `node --test tests/youtube-ads.test.cjs` 验证过滤行为和 protobuf 字段保留。

raw.githubusercontent.com 有约 5 分钟缓存，推送后稍等再在 Clash 里更新模块。

### 2026-11-05：Loon iPhone 广告修复

- Loon 的「脚本」总开关必须开启；仅启用插件、重写和 HTTPS 解密不足以运行脚本。手机排查时发现该开关关闭，已开启。
- 高德：覆盖 `m5.amap.com` 的 `valueadded` / `aos` 开屏接口，以及 `amap-aos-info-nogw.amap.com` 的 `splash_screen_rt` 接口。一次冷启动未出现开屏广告，地点搜索和路线规划正常；未开始实际导航。
- YouTube：首页延迟列表新增 protobuf 路径 `SectionListRenderer.32 → 1 → 6 → SectionListRenderer`；过滤器逐条检查内容，不再按字段编号永久缓存白名单，并检查每个未知字段。
- YouTube 首播抓到官方 App `21.42.4` 发出的 GET `initplayback`，原 POST 条件无法匹配。当前候选让准确的 `googlevideo.com/initplayback` 返回空 200，采用上游请求脚本已有的回退方式，改走可过滤的 `youtubei/v1/player`；普通 `videoplayback` 媒体不匹配。实际首播结果仍以手机验证为准。
- 手机抓到的两份含广告首页响应，经修复后分别保留 22 条普通卡片、删除 1 条广告，以及删除单独 1 条广告；两份不含广告的响应保持字节不变。抓包含个人内容，只保存在本地，不进入仓库。
- 回归覆盖共享类型的普通卡片与广告、非首个未知字段、紧凑广告命令、相邻普通卡片，以及延迟列表的完整响应处理与未知字段保留。
- 播放页 `next` 的赞助卡片位于 `15 → 361588638 → 2`，补齐消息结构后，两份手机响应都能移除广告内容并保留面板元数据。新增完整响应回归，合计 6 项测试。

