import { app, ipcMain, net, safeStorage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// WebDAV 哑传输层：仅负责带 Basic 认证的 GET/PUT/MKCOL + 凭据加密存储。
// 合并/冲突逻辑全在渲染层（owns localStorage 数据），主进程不碰业务数据结构。
interface WebdavConfig {
  url: string // dav 根，如 https://dav.jianguoyun.com/dav/
  username: string
  password: string // 内存明文；落盘时经 safeStorage 加密
}

const SYNC_DIR = 'bilimusic' // dav 根下的集合目录
let config: WebdavConfig | null = null

function configFile(): string {
  return path.join(app.getPath('userData'), 'webdav.json')
}

function loadConfig(): void {
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), 'utf8')) as {
      url: string
      username: string
      password: string
    }
    let password = ''
    if (raw.password?.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
      password = safeStorage.decryptString(Buffer.from(raw.password.slice(4), 'base64'))
    } else if (raw.password?.startsWith('plain:')) {
      password = Buffer.from(raw.password.slice(6), 'base64').toString('utf8')
    }
    config = { url: raw.url, username: raw.username, password }
  } catch {
    config = null
  }
}

function persistConfig(cfg: WebdavConfig): void {
  let stored: string
  try {
    if (safeStorage.isEncryptionAvailable()) {
      stored = `enc:${safeStorage.encryptString(cfg.password).toString('base64')}`
    } else {
      stored = `plain:${Buffer.from(cfg.password, 'utf8').toString('base64')}`
    }
  } catch {
    stored = `plain:${Buffer.from(cfg.password, 'utf8').toString('base64')}`
  }
  fs.writeFileSync(configFile(), JSON.stringify({ url: cfg.url, username: cfg.username, password: stored }, null, 2))
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${config!.username}:${config!.password}`).toString('base64')}`
}

function joinUrl(base: string, ...parts: string[]): string {
  const head = base.replace(/\/+$/, '')
  return [head, ...parts.map((p) => p.replace(/^\/+|\/+$/g, ''))].join('/')
}

function davFetch(url: string, init: { method: string; headers?: Record<string, string>; body?: string }): Promise<Response> {
  return net.fetch(url, {
    method: init.method,
    headers: { Authorization: authHeader(), ...(init.headers || {}) },
    body: init.body,
  })
}

// PUT 不会自动创建父集合（WebDAV 返回 409），故先 MKCOL；已存在(405)/已建(201) 均视为成功
async function ensureDir(): Promise<WebdavResult | null> {
  const dirUrl = `${joinUrl(config!.url, SYNC_DIR)}/`
  const res = await davFetch(dirUrl, { method: 'MKCOL' })
  if (res.ok || res.status === 405) return null
  return {
    ok: false, status: res.status, etag: null, content: null,
    message: res.status === 401 ? '认证失败' : `创建同步目录失败：HTTP ${res.status}`,
  }
}

interface WebdavResult {
  ok: boolean
  status: number
  etag: string | null
  content: string | null
  message?: string
}

async function testConnection(): Promise<{ ok: boolean; message: string }> {
  if (!config?.url || !config?.username) return { ok: false, message: '未配置' }
  try {
    const res = await davFetch(config.url, { method: 'GET' })
    if (res.status === 401) return { ok: false, message: '认证失败：账号或密码错误' }
    return { ok: true, message: '连接成功' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

async function get(relPath: string): Promise<WebdavResult> {
  if (!config) return { ok: false, status: 0, etag: null, content: null, message: '未配置' }
  try {
    const url = joinUrl(config.url, SYNC_DIR, relPath)
    let res = await davFetch(url, { method: 'GET' })
    if (res.status === 409) {
      const failure = await ensureDir()
      if (failure) return failure
      res = await davFetch(url, { method: 'GET' })
    }
    if (res.status === 404) return { ok: true, status: 404, etag: null, content: null } // 远端尚无文件
    if (res.status === 401) return { ok: false, status: 401, etag: null, content: null, message: '认证失败' }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, etag: res.headers.get('etag'), content: await res.text() }
    }
    return { ok: false, status: res.status, etag: null, content: null, message: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, status: 0, etag: null, content: null, message: err instanceof Error ? err.message : String(err) }
  }
}

async function put(relPath: string, content: string, etag?: string): Promise<WebdavResult> {
  if (!config) return { ok: false, status: 0, etag: null, content: null, message: '未配置' }
  try {
    const failure = await ensureDir()
    if (failure) return failure
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (etag) headers['If-Match'] = etag // 乐观并发：远端被他端改过则 412
    const res = await davFetch(joinUrl(config.url, SYNC_DIR, relPath), { method: 'PUT', headers, body: content })
    if (res.status === 412) return { ok: false, status: 412, etag: null, content: null, message: '远端已变更，需重新合并' }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, etag: res.headers.get('etag'), content: null }
    }
    return { ok: false, status: res.status, etag: null, content: null, message: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, status: 0, etag: null, content: null, message: err instanceof Error ? err.message : String(err) }
  }
}

export function registerWebdavHandlers(): void {
  loadConfig()

  ipcMain.handle('webdav:configure', (_e, cfg: WebdavConfig) => {
    // 密码留空表示沿用已保存的密码（前端「修改请重新输入」的配套逻辑）
    const password = String(cfg.password || '') || config?.password || ''
    config = { url: String(cfg.url || '').trim(), username: String(cfg.username || ''), password }
    persistConfig(config)
    return { ok: true }
  })
  // 不回传密码：仅告知是否已配置
  ipcMain.handle('webdav:get-config', () =>
    config?.url
      ? { url: config.url, username: config.username, configured: true }
      : { url: '', username: '', configured: false },
  )
  ipcMain.handle('webdav:test', () => testConnection())
  ipcMain.handle('webdav:get', (_e, relPath: string) => get(relPath))
  ipcMain.handle('webdav:put', (_e, relPath: string, content: string, etag?: string) => put(relPath, content, etag || undefined))
  ipcMain.handle('webdav:clear', () => {
    config = null
    try {
      fs.rmSync(configFile(), { force: true })
    } catch {
      /* ignore */
    }
    return { ok: true }
  })
}
