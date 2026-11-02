# clash-modules

自用的 Loon 插件快照，给 Hako Clash（Mac / iPhone）使用。2026-11-02 从 kelee.one 冻结，之后不再跟随原作者更新，由自己维护。

## 结构

目录沿用 kelee.one 的路径，方便对照上游：

- `Tool/Loon/Lpx/*.lpx`：插件。插件里引用的 `kelee.one/Resource/...` 已全部改成本仓库的 raw 地址。
- `Resource/JavaScript/`：脚本（明文快照，未加密）。
- `Resource/JQLang/`：jq 文件。

## 导入

在 Clash → 模块 → 添加模块 → 链接，填：

```
https://raw.githubusercontent.com/Simonxiaoxueboshi/clash-modules/main/Tool/Loon/Lpx/<插件名>.lpx
```

完整列表见 `导入链接.txt`。

## 和原版的差别

- `Bilibili_remove_ads.lpx`：`#!system` 加了 `macOS`，否则 Mac 版 Clash 拒收。
- 不收录 BoxJs：Hako Clash 专门不支持。
- 以下仍指向各自上游开源项目，没有冻结：iRingo、Sub-Store、Script-Hub、AppleWeatherEnhancer 的 NSRingo 脚本，以及 iptest、nodetcpcheck、dev-loopback 插件本身。图标仍引用 `luestr/IconResource`。

## 维护

某个 App 又出现广告时，记下 App、界面，最好附抓包或截图，再改对应插件里的正则 / jq / 脚本。
YouTube（去广告、字幕翻译）、哔哩哔哩、网易云的脚本是编译后的打包文件，不能直接手改，接口变化时需要从上游开源源码重新编译。

raw.githubusercontent.com 有约 5 分钟缓存，推送后稍等再在 Clash 里更新模块。
