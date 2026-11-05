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
- YouTube 首播：抓包确认广告 `initplayback` 为 POST，原生 `reject_video` 和请求脚本空 200 均已实际命中，但广告仍出现，因此已移除无效的初始化回退方案。新候选只修改 `player` / `get_watch` 请求中的广告参数与 `is_inline_playback_no_ad` 标志；首播与界面卡片仍须手机验证，不能由离线过滤结果推定。
- 手机抓到的两份含广告首页响应，经修复后分别保留 22 条普通卡片、删除 1 条广告，以及删除单独 1 条广告；两份不含广告的响应保持字节不变。抓包含个人内容，只保存在本地，不进入仓库。
- 回归覆盖共享类型的普通卡片与广告、非首个未知字段、紧凑广告命令、相邻普通卡片，以及延迟列表的完整响应处理与未知字段保留。
- 播放页 `next` 的赞助卡片位于 `15 → 361588638 → 2`，补齐消息结构后，两份手机响应都能移除广告内容并保留面板元数据。合计 9 项回归，另覆盖播放器请求中视频标识、未知字段、请求头的保留，以及重复标志和畸形输入。
- YouTube 模块固定脚本的 Git 提交版本，避免手机缓存旧代码；后续修改脚本后，需同步更新模块中的对应提交号。

### 2026-11-06：片头广告定位到 Onesie 加密信封

- 片头广告的配置不在明文 `player` / `get_watch` 响应里：手机抓到的 `get_watch` 中 `adPlacements` 与 `adSlots` 均为 0，广告参数在 `initplayback` 请求体的 Onesie 信封内（`3 → 2 密文 / 5 密钥 / 6 IV / 7 HMAC`）。
- 实测外层标志 `3 → 13 = false` 无效：抓包显示改写确实生效（7628 → 7630 字节，只多这 2 字节，密文、密钥、IV、HMAC 全部未变），片头广告仍照常播放。因此该标志保留但不作为修复手段。
- 新方案：用响应脚本已保存的 `clientKey` 校验 `HMAC-SHA256(clientKey[16..32], 密文‖IV)`，通过后 AES-CTR 解密、必要时 `$utils.ungzip`、去掉内层 `field 3` 请求体里的广告参数（`context.9`、`content.12/25`，并置 `content.50 = 1`），再重新加密、重算 HMAC、按原字段顺序重建信封。任何一步失败（无密钥、密钥过期、HMAC 不匹配、结构异常）都原样放行，不会破坏播放。
- 密码学原语（SHA-256、HMAC、AES-CTR）取自 teaoea/shell 的 `YouTubeConfig.js`，MIT 许可，版权归「可莉唯一的狗」，已在脚本注释中标注。测试用 Node 的 `crypto` 独立实现生成信封，交叉验证脚本的加解密与 HMAC，覆盖明文内层、gzip 内层、错误密钥、篡改密文、无广告参数五类情况；合计 18 项回归。
- 打开插件设置里的「启用调试模式」后，每次片头广告请求会弹一条本地通知，说明结果是「已改写加密信封」「未取到密钥」「密钥校验失败」还是「信封内无广告参数」，便于在手机上判断失效原因；关闭调试则不弹。
- 模块新增 `initplayback` 的请求脚本规则，并把 `YouTube播放请求` 指向新的脚本提交号。
- 临时抓包脚本和诊断模块已从仓库删除，只留在本地；仓库不保存任何抓包正文。
- 仍待手机实测：片头广告是否消失，以及首页赞助卡片的界面确认。

### 2026-11-06：片头广告真正来源是 `next` 里的广告浮层

- 手机抓到的 `next`（115610 字节）把片头广告的完整地址直接下发：顶层 `field 42`（77196 字节）内是广告浮层，`42 → 357104971 → 2 → 361256913 → 1 → 138681066`，其中 `2` 是 `engagement_header.eml`（我的广告中心 / 关闭广告面板 / 赞助商广告），`3` 是广告视频面板，`10` 是 `engagement_footer.eml`（立即申请），`3` 里含 `initplayback?...&oad=5500&oaad=11000...`。客户端是被 `next` 告知广告地址的，所以只拦 `initplayback` 请求永远无效。
- 该字段只在有片头广告时出现：无广告的 `next`（30890、34782 字节）没有 `field 42`，也没有 `oad=5500`；去掉它之后其余顶层字段（`1`、`13`、`14`、`15`、`26`、`47`、`777`）逐字节不变。
- 首页 `browse` 是另一条通道：每条视频自带片头广告配置，197296 字节里有 16 个 `initplayback...&oad=` 地址，都是**叶子字段**（`\n` + 长度 + URL）。因此按「整块丢弃」处理会连首页一起删掉（实测 197296 → 5807 字节），必须只删 URL 叶子字段。
- 现行实现：响应脚本里加 `$dropOverlay` 递归清理，只沿含 `initplayback` 的子树重建，其他分支原样拷贝；叶子字段只有「内容以 `https://` 开头且含 `&oad=`」才删除；顶层含 `engagement_header.eml` 的整块浮层才整块删除。清理结果通过原有 `$done` 通路发出，避免库函数无其他改动时 `$exit()` 把改动吞掉。
- 结构比对（独立实现逐层对比）：`browse` 清理后与原文的差异**只有** 16 个广告 URL 叶子字段，其余节点字节完全一致；`next` 只少了 `field 42`。

#### 验证记录

- 赞助卡片（真实抓包，手机产生的响应）：`browse` 197296 → 149440 字节（其中 16 个广告 URL 叶子字段被删），`yt-ads-web-view-id` 出现 7 次 → 0 次；`next` 30890 → 15603、34782 → 17231 字节，`skip_ad_on_block` 1 → 0；旁路普通卡片全部保留。
- 片头广告浮层（真实抓包）：`next` 115610 → 21563 字节，`立即申請` 4 次 → 0 次，`oad=5500` 1 次 → 0 次；无广告的 `next` 32031 字节原样不变。
- 赞助卡片（离线样本重放）：319717 字节的首页 23 张卡片 → 22 张；181875 字节 1 张广告 → 0 张；1011680 与 9438 字节的样本逐字节不变。
- 片头广告请求：真实 7628 字节请求在无密钥时输出 7630 字节（只翻转外层标志），广告仍播放，据此判定外层标志无效。
- 回归：`node --test tests/youtube-ads.test.cjs`，22 项全部通过。

