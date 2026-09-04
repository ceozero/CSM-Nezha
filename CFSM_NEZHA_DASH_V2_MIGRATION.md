# nezha-dash-v2 移植到 CF-Server-Monitor 方案

## 目标

保留 `nezha-dash-v2` 的页面视觉、交互与 React 组件，将其 Nezha Dashboard 数据层替换为 CF-Server-Monitor（以下简称 CFSM）的公开主题 API，并通过 CFSM 后台的**主题 URL**直接应用。

本方案不部署 GitHub Pages。主题构建产物存放在 GitHub 仓库指定目录中，由 CFSM Worker 读取、缓存并代理给访问者。

```text
GitHub 仓库中的 theme/ 构建产物
        ↓
CFSM 后台填写 tree/<commit-sha>/theme URL
        ↓
CFSM Worker 代理 index.html 与 /assets/*
        ↓
主题同源访问 /api/* 与 /api/ws
```

## 主题 URL 与目录约定

CFSM 的主题 URL 指向 GitHub 仓库内**包含 `index.html` 的目录**。通用格式如下：

```text
https://github.com/<用户名>/<仓库名>/tree/<commit-sha>[/主题子目录]
```

本项目将构建产物固定在 `theme/`，因此实际填写：

```text
https://github.com/<用户名>/<仓库名>/tree/<commit-sha>/theme
```

建议使用固定的 commit SHA，而不是 `main` 分支。这样可保证已上线版本可复现，并能通过修改 URL 快速回滚。

### 首次发布：可直接执行的流程

以下是将本仓库发布为可由 CFSM 直接加载的主题的最短流程。这里的 GitHub 仓库可以是自己的公开仓库；不需要 GitHub Pages，也不需要将主题部署为独立网站。

```powershell
# 1. 安装依赖并构建；构建结果会写入 theme/
pnpm install --frozen-lockfile
pnpm build:theme

# 2. 检查发布目录。只能有 index.html 与 assets/ 这两类内容
Get-ChildItem theme

# 3. 将源码和构建产物一同提交、推送
git add src public theme package.json pnpm-lock.yaml vite.config.ts index.html README.md CFSM_NEZHA_DASH_V2_MIGRATION.md
git commit -m "release: CFSM nezha-dash-v2 theme"
git push origin main

# 4. 取得当前提交的完整 SHA
git rev-parse HEAD
```

假设 GitHub 用户名为 `alice`、仓库名为 `cfsm-nezha-theme`，第 4 步得到的 SHA 为 `<sha>`，则 CFSM 后台应填写的主题 URL 是：

```text
https://github.com/alice/cfsm-nezha-theme/tree/<sha>/theme
```

填写的是 **GitHub 网页的目录地址**，不是 `raw.githubusercontent.com` 文件地址，也不是构建出的 `index.html` 文件链接。

构建后的目录必须为：

```text
theme/
├── index.html
└── assets/
    ├── app-<hash>.js
    ├── app-<hash>.css
    └── 其他静态资源
```

不要填写以下地址：

- GitHub Pages 地址；
- `raw.githubusercontent.com` 地址；
- GitHub 仓库首页；
- 单个 `index.html` 文件地址。

### 后台应用与回滚操作

1. 在本地执行 `pnpm build:theme`，确认 `theme/index.html` 和 `theme/assets/` 已生成；
2. 将源码与 `theme/` 构建产物一同提交并推送到公开 GitHub 仓库；
3. 复制**包含 `theme/` 构建产物的那一次提交**的完整 commit SHA；
4. 在 CFSM 管理后台的外观/主题设置中填入 `https://github.com/<用户名>/<仓库名>/tree/<commit-sha>/theme` 并保存；保存时 CFSM 会验证远程 `index.html` 是否可读取；
5. 使用后台的“预览”打开该 URL，确认首页、详情页与资源都能加载后，再保存为正式主题。预览必须在已登录管理员会话中发起，预览授权约 10 分钟有效；
6. 出现问题时，将主题 URL 中的 commit SHA 改回上一个已验证版本并保存，即可回滚。

主题 URL 只能指向公开 GitHub 仓库中已经存在的目录。虽然 CFSM 也接受分支名，但正式发布应使用 commit SHA；每次修改主题后生成新的 commit，可避免分支更新与 Worker 缓存造成版本漂移。

## 项目结构

建议将源码和构建产物分开管理：

```text
CSM-Nezha/
├── src/                           # React 源码
│   ├── components/                # 复用/改造 nezha-dash-v2 视觉组件
│   ├── pages/                     # 首页和服务器详情页
│   ├── lib/
│   │   ├── cfsm-api.ts            # CFSM HTTP 请求封装
│   │   ├── cfsm-adapter.ts        # CFSM 数据到主题模型的转换
│   │   └── cfsm-websocket.ts      # WebSocket 增量合并逻辑
│   └── types/
│       └── cfsm.ts                # CFSM API 类型
├── public/                        # 源静态资源
├── theme/                         # 提交至 Git 的构建产物
├── vite.config.ts
└── package.json
```

Vite 输出设置：

```ts
export default defineConfig({
  base: './',
  build: {
    outDir: 'theme',
    emptyOutDir: true,
  },
});
```

构建出的资源路径必须是 `assets/...` 或 `/assets/...`。CFSM 会将主题的资源请求代理到 GitHub 对应目录。

## 路由

使用 Hash 路由，符合 CFSM 主题约定：

```text
首页：     /#/
详情页：   /#/server/:id
管理后台： /admin#admin
```

将原主题的 `BrowserRouter` 改为 `HashRouter`。详情跳转保持：

```ts
navigate(`/server/${server.id}`);
```

最终会生成：

```text
https://status.example.com/#/server/<server-id>
```

第三方主题不实现 CFSM 管理后台；任何管理入口都只能跳转到 `/admin#admin`。

## 数据层改造

### 删除 Nezha 专用接口

以下接口和相关登录、刷新 Token、服务监控逻辑不适用于 CFSM：

```text
/api/v1/server-group
/api/v1/server/:id/metrics
/api/v1/server/:id/service
/api/v1/service
/api/v1/profile
/api/v1/refresh-token
```

### 使用 CFSM 同源接口

主题由 CFSM Worker 同源提供，HTTP 和 WebSocket 均应使用相对路径：

```text
GET  /api/config
GET  /api/servers
GET  /api/server?id=<uuid>
GET  /api/history/all?id=<uuid>&hours=<hours>
GET  /api/ws?subscribe=<all|server-id>
```

主题 URL 模式不需要配置独立 `apiBase`，通常也不需要额外配置 CORS。

管理员登录后，CFSM 会把 JWT 保存为 `localStorage.jwt_token`。主题的同源请求必须将它转发为 `Authorization: Bearer <token>`，否则后端会拒绝超过 24 小时的历史数据；不要用 `document.cookie` 判断登录状态，JWT 并不在 Cookie 中。未登录时，主题会把需要该权限的 3 天和 7 天选项置灰并禁止点击。

`/api/config` 返回的 `theme_options` 是第三方主题的运行时配置。本主题第一版只读取它，不保存主题专属选项；如后续需要保存专属选项，只能使用公开的 `POST /api/theme_options`，不得调用 `save_settings` 等管理接口。站点级外观设置仍应跳转 CFSM 内置后台 `/admin#admin`。

### 类型与字段适配

不要让页面组件直接使用 CFSM API 原始数据。由 `cfsm-adapter.ts` 统一转换为主题内部模型，避免页面逻辑与后端字段耦合。

| nezha-dash-v2 字段 | CFSM 字段 | 说明 |
| --- | --- | --- |
| `id: number` | `id: string` | 全项目改为字符串 ID |
| `host.mem_total` | `ram_total` | 内存总量 |
| `state.mem_used` | `ram_used` | 已用内存 |
| `host.disk_total` | `disk_total` | 磁盘总量 |
| `state.disk_used` | `disk_used` | 已用磁盘 |
| `state.net_in_speed` | `net_in_speed` | 下载速率 |
| `state.net_out_speed` | `net_out_speed` | 上传速率 |
| `state.net_in_transfer` | `net_rx` | 累计下载流量 |
| `state.net_out_transfer` | `net_tx` | 累计上传流量 |
| `state.cpu` | `cpu` | CPU 使用率 |
| `state.process_count` | `processes` | 进程数 |
| `state.tcp_conn_count` | `tcp_conn` | TCP 连接数 |
| `state.udp_conn_count` | `udp_conn` | UDP 连接数 |
| `host.platform` | `os` | 操作系统 |
| `host.platform_version` | `kernel_version` | 内核版本 |
| `host.cpu` | `cpu_info` | CPU 描述 |
| `host.gpu` | `gpu_info` | 可能是 JSON 字符串，需容错解析 |
| `public_note` | `tags` / `server_group` | 可作为标签或说明文本 |
| `country_code` | `region` | 需自行映射；未知区域时隐藏旗帜 |

在线状态优先使用 `is_online`。若后端没有返回该字段，才用 `last_updated` 是否在 5 分钟内作为回退判断。

## 实时 WebSocket 改造

原主题期望 WebSocket 推送完整的 `{ now, servers: [...] }` 快照；CFSM 推送 `batchUpdate` 增量数据，不能直接复用原 WebSocket Provider。

### 首页

```text
1. GET /api/servers，获得完整服务器列表
2. 以 id 为 key 保存为服务器 Map
3. 连接 /api/ws?subscribe=all
4. 连接成功后发送所有服务器 ID 的 subscribe 消息
5. 收到 batchUpdate 后，将每个 sample 合并进 Map 中已有服务器
6. 根据合并结果刷新列表与实时图表缓存
```

```ts
const ws = new WebSocket('/api/ws?subscribe=all');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    scope: 'all',
    ids: servers.map(server => server.id),
  }));
};

ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.type !== 'batchUpdate') return;

  for (const update of message.updates ?? []) {
    for (const sample of update.samples ?? []) {
      const delta = sample.data ?? sample.payload ?? sample.metrics ?? {};
      mergeServer(update.serverId, { ...delta, timestamp: sample.ts });
    }
  }
};
```

浏览器中 WebSocket URL 应通过当前页面地址构造并将协议替换为 `ws:` / `wss:`，不能将相对 URL 直接传给 `new WebSocket()`：

```ts
const wsUrl = new URL('/api/ws', window.location.origin);
wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
wsUrl.searchParams.set('subscribe', 'all');
const ws = new WebSocket(wsUrl);
```

### 详情页

```text
1. GET /api/server?id=<server-id>
2. 连接 /api/ws?subscribe=<server-id>
3. 仅合并该服务器的增量字段
```

详情页不能拉取全部 `/api/servers` 或订阅 `subscribe=all` 后再过滤。

### 增量合并原则

CFSM 高频样本通常仅含 CPU、内存、Swap、上下行速率与时间；磁盘容量、GPU、进程、连接数等字段不会每次出现。因此必须基于旧记录合并：

```ts
function mergeServer(id: string, delta: Partial<CfsmServer>) {
  const current = serversById.get(id);
  if (!current) return;
  serversById.set(id, { ...current, ...delta });
}
```

不能把增量对象直接当完整服务器状态写入，否则未推送字段会被清空。

还应实现：

- 页面进入后台时主动关闭 WebSocket；重新可见时先补 REST 请求，再恢复订阅；
- 读取 `/api/config` 的 `frontend_ws_timeout_minutes`；达到时提示用户是否重新连接；
- 私有站点同源运行时复用 CFSM 登录 Cookie，不实现 Nezha 登录页。

## 历史图表与功能边界

### 历史图表

将原有按单指标请求的 Nezha 接口改为：

```text
/api/history/all?id=<uuid>&hours=0.167|0.5|1|6|12|24|48|96|168
```

一个历史响应包含多个指标。前端应从同一份历史数组提取 CPU、内存、磁盘、网络、连接数等图表数据，而非为每个图表单独请求。

本主题的时间范围固定为“实时、10 分、30 分、1 小时、6 小时、1 天、3 天、7 天”。其中 3 天会请求后端支持的 96 小时窗口后仅展示最近 72 小时；不要请求 `hours=72`，该参数不是 CFSM 的有效档位。主题以 `localStorage.jwt_token` 判断登录态：未登录时 3 天和 7 天显示为灰色且不可点击，登录后可用；后端仍会对每次长历史请求校验 JWT。

支持保留的第一版功能：

- 服务器列表、搜索、排序与分组；
- 服务器详情；
- CPU、内存、Swap、磁盘占用；
- 网络实时速率与累计流量；
- 历史图表；
- 进程数、TCP/UDP 连接数；
- 标签、系统与硬件信息。

应移除或隐藏的功能：

- `ServiceTracker`；
- `CycleTransferStats`；
- Nezha 服务监控；
- Nezha 用户资料、登录和刷新 Token；
- Nezha `public_note` 中的套餐、账单等专用格式解析。

CFSM 公开主题接口未提供的数据不可伪造。

## Turnstile、静态资源与页脚

启动时请求 `/api/config`：

- 若启用 Turnstile，加载验证组件并缓存 `turnstile_verified`；后续 API 请求携带对应 Header；
- 私有站点的 HTTP API 请求需处理 JWT，WebSocket 在同源运行时使用 CFSM Cookie；
- 旗帜使用 `/flags/<code>.svg`；
- 操作系统图标使用 `/os-icons/<filename>`；
- 站点标题、背景图和注入的 head/script 均由 CFSM 外观设置控制，主题不应写死。

页脚必须保留：

```html
Powered by CF-Server-Monitor
```

并链接到 `https://github.com/huilang-me/CF-Server-Monitor/`；可同时显示 `/api/config` 返回的 `version`。

## 实施顺序

1. Fork `hamster1963/nezha-dash-v2`，保留 Apache-2.0 许可证和版权说明。
2. 将路由切换为 HashRouter，并使首页和详情页路由符合 CFSM 约定。
3. 新建 CFSM 类型、HTTP API 封装和数据适配器。
4. 替换服务器列表和详情页的初始 REST 请求。
5. 重写 WebSocket Provider，完成 `batchUpdate` 增量合并。
6. 将历史图表改为 `/api/history/all`。
7. 隐藏 CFSM 无对应数据的 Nezha 专属组件。
8. 加入 Turnstile、可见性管理与 WebSocket 超时处理。
9. 设置 Vite 输出目录为 `theme/` 并构建。
10. 提交构建产物，后台预览后再应用固定 commit SHA 的主题 URL。

## 验收清单

- [ ] 首页地址为 `/#/`，详情地址为 `/#/server/<id>`。
- [ ] 浏览器网络请求中不存在 `/api/v1/`。
- [ ] 所有主题资源从 `/assets/...` 正常加载。
- [ ] 首页先请求 `/api/servers`，再订阅对应服务器 ID。
- [ ] 详情页只请求和订阅当前服务器。
- [ ] `batchUpdate` 到达后指标更新，未变化字段不会丢失。
- [ ] 页面隐藏后 WebSocket 关闭；返回页面后恢复。
- [ ] 公共站点、私有站点和 Turnstile 启用场景均可访问。
- [ ] 页脚包含 CF-Server-Monitor 归属链接与版本信息。
- [ ] 后台使用 GitHub `tree/<commit-sha>/theme` URL 可成功预览和应用。
- [ ] 仓库保留 nezha-dash-v2 的 Apache-2.0 许可证、版权及修改说明。

## 参考

- [CF-Server-Monitor 第三方主题开发 API](https://github.com/huilang-me/CF-Server-Monitor/blob/main/theme-develop.md)
- [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)
- [nezha-dash-v2](https://github.com/hamster1963/nezha-dash-v2)
- [nezha-dash-v2 Apache-2.0 许可证](https://github.com/hamster1963/nezha-dash-v2/blob/main/LICENSE)
