# 软糖记账 · 聊天式 PWA + 手机 Web Push

纯 HTML/CSS/JavaScript 记账 PWA，附带 Node.js Web Push 后端。账单数据仍保存在用户自己的浏览器 `localStorage`；后端只保存推送订阅、每日提醒时间、时区和发送状态，不会上传账单。

## 本地启动（前端与后端）

需要 Node.js 18 或更高版本。

```bash
npm install
npm run generate-vapid
```

VAPID_PUBLIC_KEY=BGM0tILcfKFN0y9BiklNGniv90V3K9LWwQF6gcUWXUeOoRk1KZynzc7xcwaCmyMLSmr9OFAdJ4ZzflxUxGSqRII
VAPID_PRIVATE_KEY=WJjQ3KCLI_0cfJ9gJEYDHx1Y1gFKqhFbYs64M8-Qkdk
VAPID_SUBJECT=mailto:your-real-admin-email@example.com

把命令输出的三个变量设置为环境变量（`VAPID_PRIVATE_KEY` 只放服务器环境，绝不要放进网页代码或提交到仓库），然后：

```bash
npm start
```

浏览器访问 `http://localhost:8080`。localhost 可用于开发；要在手机真实测试，需把应用和后端部署到 **HTTPS 公网域名**，并设置相同的 VAPID 环境变量。服务端 `/api/health` 可检查服务状态。

## 手机安装与开启推送

1. 将项目部署到 HTTPS，并确认服务进程持续运行、数据目录持久化。
2. 在手机浏览器打开站点并安装/添加到主屏幕。iPhone/iPad 需要 iOS/iPadOS 16.4 或更新版本，并从主屏幕启动 Web App。
3. 在聊天界面点输入区的「＋」→「记账提醒」，设置时间并勾选开启。
4. 点击保存时，浏览器会请求通知权限并注册 Push Subscription。允许后，后端按设备时区每 15 秒检查一次，到达设定分钟时发送每日推送。
5. 在「记账提醒」面板点击「发送测试通知」，服务器返回成功后检查手机通知中心；这验证服务器向该订阅提交了推送，但最终展示仍需在真实手机确认。
6. 可以从手机系统通知设置中管理权限。网络、系统省电策略、推送服务及部署可用性都会影响送达。

## 部署要求与注意事项

- Web Push 需要 HTTPS（localhost 仅适合开发）。静态托管本身不够，必须部署可持续运行的 Node 服务。
- 配置 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`；不要将私钥提交到代码仓库。
- `data/push-subscriptions.json` 保存订阅。生产环境请挂载持久化磁盘并限制文件访问；多实例部署时应换成共享数据库和独立定时任务。
- 当前是轻量单进程 MVP：没有账号系统、用户登录、订阅管理后台或多实例分布式锁。订阅由设备端点识别；卸载/撤销权限后，过期订阅会在发送失败时停用。
- 提醒设置保存失败时，页面会显示服务端未配置/未连接提示；不会假装推送成功。旧的“页面打开时提醒”保留作兼容，但真正后台推送由服务器负责。
- 浏览器/操作系统是否即时展示通知由其推送服务与用户权限决定；请先在真实 HTTPS 域名上用设备验证。

## 验收清单（部署后执行）

- [ ] `https://你的域名/api/health` 返回 `ok: true` 且 `pushConfigured: true`
- [ ] 手机打开 HTTPS 域名并安装/添加到主屏幕（iPhone 必须从主屏幕启动）
- [ ] 授权通知并保存每日提醒，服务端订阅成功
- [ ] 点击「发送测试通知」，手机通知中心出现「软糖记账 · 测试通知」
- [ ] 锁屏并退出网页后，仍收到测试推送
- [ ] 将提醒时间设为未来 2–3 分钟，确认到点收到每日提醒
- [ ] 重启服务后订阅数据仍存在（需配置持久化磁盘）

注意：未在你的真实手机和公网 HTTPS 域名上执行上述清单之前，不应将项目标记为「真实手机端到端测试通过」。当前交付是带测试入口的可部署源码，不代表已部署或已实机验收。

## 常用命令

```bash
npm run build       # 基础语法检查
npm run generate-vapid
npm start
```

## 公网 HTTPS 预览部署（Render）

项目根目录已附带 `render.yaml`，可用于 Render Blueprint 部署。需要你本人登录托管平台并授权仓库；本项目没有代替你登录或发布。

1. 将本目录中的项目提交到你自己的 GitHub 仓库（不要提交 `.env`、`data/` 或真实密钥）。
2. 登录 Render，选择 **New → Blueprint**，连接该仓库并选择包含 `render.yaml` 的分支。
3. 确认服务名 `soft-candy-ledger-preview`，执行部署。Render 会提供一个 `https://...onrender.com` 公网地址。
4. 打开公网地址后点击右下角「页面诊断」，点击「重新检测」。`/api/health` 正常即可证明网页能够访问后端健康接口；它不代表推送已配置。
5. 免费实例可能休眠，首次打开可能需要等待启动。免费实例的本地文件系统不适合持久保存推送订阅数据。

### 启用真实 Web Push（可选，预览版默认未配置）

- 在本地运行 `npm run generate-vapid` 生成 VAPID 密钥；将公钥、私钥和真实的 `mailto:` 联系地址作为 Render 环境变量 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT` 设置。不要将私钥提交到仓库或写进前端。
- 若要长期使用推送，需要配置持久化存储（`PUSH_DB_FILE` 指向持久磁盘），并使用不会休眠的持续运行实例；否则重启/重新部署可能丢失订阅。
- 部署后在支持 Web Push 的真实设备上允许通知，打开「＋」→ 每日提醒→保存并开启手机推送，再点「发送测试通知」。需要实际收到设备通知才能算端到端通过。

## 页面诊断面板

点击页面右下角「🩺 页面诊断」可检查 HTTPS/安全上下文、通知权限、Service Worker 注册、`/api/health` 后端状态和样式链接，并捕获 JavaScript 异常、未处理的 Promise 异常及资源加载失败。可以复制或下载诊断 JSON。日志保存在当前页面内存中，最多 100 条；诊断报告会包含页面地址、浏览器 UA 和错误消息，分享前请检查是否包含不想公开的信息。诊断面板不会上传账单内容。
