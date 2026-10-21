import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8080);
const DB_FILE = process.env.PUSH_DB_FILE || path.join(__dirname, 'data', 'push-subscriptions.json');
const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
let vapidReady = false;
if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
}
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
function loadDb() {
  try { const x = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); return Array.isArray(x) ? x : []; }
  catch { return []; }
}
function saveDb(rows) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(rows, null, 2)); fs.renameSync(tmp, DB_FILE);
}
app.get('/api/push/public-key', (req, res) => {
  if (!vapidReady) return res.status(503).json({ error: '服务端未配置 VAPID 密钥' });
  res.json({ publicKey });
});
app.post('/api/push/subscribe', (req, res) => {
  if (!vapidReady) return res.status(503).json({ error: '服务端未配置 VAPID 密钥' });
  const { subscription, time, timezone, enabled } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return res.status(400).json({ error: '推送订阅数据不完整' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) return res.status(400).json({ error: '提醒时间格式应为 HH:mm' });
  const tz = String(timezone || 'UTC');
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date()); } catch { return res.status(400).json({ error: '无效的时区' }); }
  const rows = loadDb();
  const idx = rows.findIndex(x => x.subscription.endpoint === subscription.endpoint);
  const prior = idx >= 0 ? rows[idx] : {};
  const row = { ...prior, id: prior.id || crypto.randomUUID(), subscription, time: String(time), timezone: tz, enabled: Boolean(enabled), lastSentDate: prior.lastSentDate || null, updatedAt: new Date().toISOString() };
  if (idx >= 0) rows[idx] = row; else rows.push(row);
  saveDb(rows); res.json({ ok: true, enabled: row.enabled });
});
app.post('/api/push/test', async (req, res) => {
  if (!vapidReady) return res.status(503).json({ error: '服务端未配置 VAPID 密钥' });
  const endpoint = req.body?.endpoint;
  const row = loadDb().find(x => x.subscription.endpoint === endpoint);
  if (!row) return res.status(404).json({ error: '找不到该订阅' });
  try { await webpush.sendNotification(row.subscription, JSON.stringify({ title: '软糖记账 · 测试通知', body: '推送已连接，手机通知通道工作正常。', url: '/' })); res.json({ ok: true }); }
  catch (e) { res.status(e.statusCode === 410 || e.statusCode === 404 ? 410 : 502).json({ error: '发送失败', detail: e.message }); }
});
app.get('/api/health', (req, res) => res.json({ ok: true, pushConfigured: vapidReady }));
app.use((req, res, next) => { if (/^\/(data|node_modules)(\/|$)/.test(req.path) || req.path === '/.env' || req.path === '/server.js' || req.path === '/generate-vapid.js') return res.sendStatus(404); next(); });
app.use(express.static(__dirname, { extensions: ['html'] }));

async function checkReminders() {
  if (!vapidReady) return;
  const rows = loadDb(); let changed = false; const now = new Date();
  for (const row of rows) {
    if (!row.enabled) continue;
    let parts;
    try { parts = new Intl.DateTimeFormat('en-CA', { timeZone: row.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).reduce((a, p) => (a[p.type] = p.value, a), {}); }
    catch { continue; }
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const time = `${parts.hour}:${parts.minute}`;
    if (time !== row.time || row.lastSentDate === date) continue;
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({ title: '软糖记账 · 每日提醒', body: '今天还没有记账吗？花一分钟记录一下今天的收支吧。', url: '/' }));
      row.lastSentDate = date; row.lastSentAt = now.toISOString(); changed = true;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { row.enabled = false; row.removedAt = now.toISOString(); changed = true; }
      else console.error('Web Push 发送失败:', e.statusCode, e.message);
    }
  }
  if (changed) saveDb(rows);
}
setInterval(() => checkReminders().catch(e => console.error('提醒任务异常', e)), 15_000);
app.listen(PORT, '0.0.0.0', () => console.log(`软糖记账服务运行于 http://localhost:${PORT}; Web Push ${vapidReady ? '已配置' : '未配置 VAPID'}`));
