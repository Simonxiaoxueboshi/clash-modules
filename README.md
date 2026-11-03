# clash-modules

Simonxiaoxueboshi 自己维护的 Loon 插件，给 Hako Clash（Mac / iPhone）使用。

## 结构

- `Tool/Loon/Lpx/*.lpx`：插件。
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
https://raw.githubusercontent.com/Simonxiaoxueboshi/clash-modules/main/Tool/Loon/Lpx/<插件名>.lpx
```

完整列表见 `导入链接.txt`。

## 说明

- `Bilibili_remove_ads.lpx`：`#!system` 加了 `macOS`，否则 Mac 版 Clash 拒收。
- 不收录 BoxJs：Hako Clash 专门不支持。
- 以下仍指向各自的开源项目：iRingo、Sub-Store、Script-Hub，Apple天气增强用到的 NSRingo 脚本，iptest、nodetcpcheck、dev-loopback 插件本身，以及 Script-Hub/Sub-Store 等少数图标（Koolson/Qure）。
- `#!author` 里保留了脚本原作者的署名。

## 维护

某个 App 又出现广告时，记下 App、界面，最好附抓包或截图，再改对应插件里的正则 / jq / 脚本。
YouTube（去广告、字幕翻译）、哔哩哔哩、网易云的脚本是编译后的打包文件，不能直接手改，接口变化时需要从开源源码重新编译。

raw.githubusercontent.com 有约 5 分钟缓存，推送后稍等再在 Clash 里更新模块。
