/**
 * WebView 环境的 WebDAV 传输层。
 *
 * 与 Electron 主进程 webdav.ts 同构：带 Basic 认证的 GET/PUT/MKCOL + 配置存储。
 * Android 经原生插件请求，支持不开放浏览器 CORS 的 WebDAV 服务。
 * 普通浏览器保留 fetch；配置存 localStorage。
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

const nativeWebdav = registerPlugin<{
  request(options: { url: string; method: string; headers: Record<string, string>; body?: string }): Promise<{
    status: number; headers: Record<string, string>; body: string
  }>
}>('Webdav')

const CONFIG_KEY = 'bilimusic_webdav_config'
const SYNC_DIR = 'bilimusic'

export interface WebdavResult {
  ok: boolean
  status: number
  etag: string | null
  content: string | null
  message?: string
}

interface WebdavConfig {
  url: string
  username: string
  password: string
}

export function isWebdavAvailable(): boolean {
  return typeof window !== 'undefined' && !window.electronAPI
}

function loadConfig(): WebdavConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw) as WebdavConfig
    if (!cfg.url || !cfg.username) return null
    return cfg
  } catch {
    return null
  }
}

function saveConfig(cfg: WebdavConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

function authHeader(cfg: WebdavConfig): string {
  const bytes = new TextEncoder().encode(`${cfg.username}:${cfg.password}`)
  return `Basic ${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`
}

function joinUrl(base: string, ...parts: string[]): string {
  const head = base.replace(/\/+$/, '')
  return [head, ...parts.map((p) => p.replace(/^\/+|\/+$/g, ''))].join('/')
}

async function davFetch(cfg: WebdavConfig, url: string, init: { method: string; headers?: Record<string, string>; body?: string }): Promise<Response> {
  const headers = { Authorization: authHeader(cfg), ...(init.headers || {}) }
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const response = await nativeWebdav.request({ url, ...init, headers })
    return new Response([204, 205, 304].includes(response.status) ? null : response.body, {
      status: response.status,
      headers: response.headers,
    })
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    return await fetch(url, {
      method: init.method,
      headers,
      body: init.body,
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function webdavConfigure(input: { url: string; username: string; password?: string }): Promise<{ ok: boolean }> {
  const prev = loadConfig()
  // 密码留空表示沿用已保存的密码（与桌面端「修改请重新输入」逻辑一致）
  const password = input.password || prev?.password || ''
  saveConfig({ url: input.url.trim(), username: input.username, password })
  return { ok: true }
}

export function webdavGetConfig(): { url: string; username: string; configured: boolean } {
  const cfg = loadConfig()
  return cfg
    ? { url: cfg.url, username: cfg.username, configured: true }
    : { url: '', username: '', configured: false }
}

export async function webdavTest(): Promise<{ ok: boolean; message: string }> {
  const cfg = loadConfig()
  if (!cfg) return { ok: false, message: '未配置' }
  try {
    let res = await davFetch(cfg, cfg.url, {
      method: 'PROPFIND',
      headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
      body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
    })
    // 少数服务未实现 PROPFIND，回退到原有的目录 GET 探测。
    if (res.status === 405 || res.status === 501) res = await davFetch(cfg, cfg.url, { method: 'GET' })
    if (res.status === 401) return { ok: false, message: '认证失败：账号或密码错误' }
    if (res.status === 403) return { ok: false, message: '访问被拒绝：请检查 WebDAV 应用权限' }
    return res.ok ? { ok: true, message: '连接成功' } : { ok: false, message: `连接失败：HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

async function ensureDir(cfg: WebdavConfig): Promise<WebdavResult | null> {
  const res = await davFetch(cfg, `${joinUrl(cfg.url, SYNC_DIR)}/`, { method: 'MKCOL' })
  // 201 为新建成功，405 为集合已存在。其他状态必须保留，不能继续上传。
  if (res.ok || res.status === 405) return null
  return {
    ok: false, status: res.status, etag: null, content: null,
    message: res.status === 401 ? '认证失败' : `创建同步目录失败：HTTP ${res.status}`,
  }
}

export async function webdavGet(relPath: string): Promise<WebdavResult> {
  const cfg = loadConfig()
  if (!cfg) return { ok: false, status: 0, etag: null, content: null, message: '未配置' }
  try {
    const url = joinUrl(cfg.url, SYNC_DIR, relPath)
    let res = await davFetch(cfg, url, { method: 'GET' })
    // 坚果云在父集合不存在时返回 409。先创建集合再重读，不能把所有 409 当作空数据。
    if (res.status === 409) {
      const failure = await ensureDir(cfg)
      if (failure) return failure
      res = await davFetch(cfg, url, { method: 'GET' })
    }
    if (res.status === 404) return { ok: true, status: 404, etag: null, content: null }
    if (res.status === 401) return { ok: false, status: 401, etag: null, content: null, message: '认证失败' }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, etag: res.headers.get('etag'), content: await res.text() }
    }
    return { ok: false, status: res.status, etag: null, content: null, message: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, status: 0, etag: null, content: null, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function webdavPut(relPath: string, content: string, etag?: string): Promise<WebdavResult> {
  const cfg = loadConfig()
  if (!cfg) return { ok: false, status: 0, etag: null, content: null, message: '未配置' }
  try {
    const failure = await ensureDir(cfg)
    if (failure) return failure
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (etag) headers['If-Match'] = etag
    const res = await davFetch(cfg, joinUrl(cfg.url, SYNC_DIR, relPath), { method: 'PUT', headers, body: content })
    if (res.status === 412) return { ok: false, status: 412, etag: null, content: null, message: '远端已变更，需重新合并' }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, etag: res.headers.get('etag'), content: null }
    }
    return { ok: false, status: res.status, etag: null, content: null, message: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, status: 0, etag: null, content: null, message: err instanceof Error ? err.message : String(err) }
  }
}
