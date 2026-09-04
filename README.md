# CSM-Nezha

将 [nezha-dash-v2](https://github.com/hamster1963/nezha-dash-v2) 的完整视觉与组件布局适配为 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor) 第三方主题。

这不是哪吒监控的官方前端，也不连接 Nezha Dashboard API。主题直接通过 CFSM 的 `/api/*` 和 `/api/ws` 获取数据，并保留 nezha-dash-v2 的首页卡片、详情页、历史图表、深浅色外观及响应式布局。

## 使用主题

CFSM 只会读取主题目录中的 `index.html` 和 `assets/`。本仓库已提交可直接使用的构建产物，目录为 [`theme/`](./theme)。不需要 GitHub Pages、GitHub Actions 或额外部署。

在 CFSM 管理后台的「外观 / 主题」中填入下列格式的主题 URL 并保存：

```text
https://github.com/ceozero/CSM-Nezha/tree/<commit-sha>/theme
```

`<commit-sha>` 替换为包含所需主题版本的完整 Git commit SHA。可在 GitHub 的提交历史中复制；固定提交地址能锁定版本，也便于出现问题时回滚。

例如，当前仓库的 `main` 分支也可用于开发期跟随更新：

```text
https://github.com/ceozero/CSM-Nezha/tree/main/theme
```

但不建议把 `main` 用作正式站点地址：CFSM 对分支主题缓存最长约 1 小时，推送新版本后可能暂时仍显示旧构建。固定 commit 地址没有这个版本漂移问题。

> `?theme_url=...` 是管理员临时预览参数，不会保存为正式主题，并且预览授权约 10 分钟后失效。请在后台保存主题 URL 才会正式生效。

## 本地开发与发布

环境要求：Node.js 22+、pnpm 11+。

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

`pnpm build` 会执行类型检查并把发布文件写入 `theme/`。提交主题更新时，请同时提交源码和 `theme/` 目录：

```powershell
git add src public theme package.json pnpm-lock.yaml vite.config.ts
git commit -m "feat: update CFSM theme"
git push origin main
git rev-parse HEAD
```

将最后一条命令得到的完整 SHA 填入主题 URL，即可发布该版本。

## 功能与数据对应

- 首页与服务器详情页；Hash 路由：`/#/`、`/#/server/:id`。
- CFSM REST 数据与 WebSocket `batchUpdate` 实时合并。
- CPU、内存、存储、上下行速率、累计流量、历史图表、TCP/UDP 连接与进程数。
- 系统图标、国旗、IPv4/IPv6 与线路标签；仅显示 CFSM 实际返回的数据，不伪造套餐、价格或到期信息。
- 默认使用 nezha-dash-v2 的完整服务器卡片布局；主题作者可通过全局 `FixedTopServerName=false` 或 `ShowNetTransfer=false` 切回紧凑显示。

详细的接口适配和发布约定见：[CFSM_NEZHA_DASH_V2_MIGRATION.md](./CFSM_NEZHA_DASH_V2_MIGRATION.md)。CFSM 的公开主题 API 以[官方主题开发文档](https://github.com/huilang-me/CF-Server-Monitor/blob/main/theme-develop.md)为准。

## 反馈与许可

请在[本仓库 Issues](https://github.com/ceozero/CSM-Nezha/issues)反馈移植主题的问题，不要提交到已不适用的旧 fork 项目。

本项目基于 nezha-dash-v2 修改，保留其 [Apache-2.0 许可证](./LICENSE)及原项目的署名要求。
