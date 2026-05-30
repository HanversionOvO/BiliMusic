import { app, BrowserWindow, Tray, ipcMain, nativeImage, net, protocol, screen, session, shell } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { registerBiliApiHandlers } from './biliApi'
import { registerLyricsApiHandlers } from './lyricsApi'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isHarmonyOS = (process.platform as string) === 'openharmony'

// 生产环境用自定义 app:// 协议加载渲染层：file:// 下 ESM(type=module) 脚本会被
// Chromium 的 CORS 策略拦截（file:// 为不透明源）导致页面空白。自定义标准安全协议
// 提供合法 origin，模块脚本与相对资源即可正常加载。须在 app ready 之前注册。
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Chrome MCP 远程调试（开发时使用）
app.commandLine.appendSwitch('remote-debugging-port', '17689')
app.commandLine.appendSwitch('remote-allow-origins', '*')

// B站请求头处理
//
// 注意：Electron 每个 session 的 webRequest 事件只允许注册一个监听器，
// 重复调用 onBeforeSendHeaders 会覆盖之前的。因此资源 CDN 与 API 的请求头
// 处理必须合并在同一个监听器内，否则后注册的会让前者失效（音频 CDN 拿不到
// Referer → 403）。
function setupBiliHeaders() {
  // 覆盖 B站所有资源/接口域名（图片、音频 CDN、API、登录）
  const biliUrls = [
    'https://*.hdslb.com/*',
    'https://*.bilivideo.com/*',
    'https://*.bilivideo.cn/*',
    'https://*.akamaized.net/*',
    'https://*.bilibili.com/*',
  ]

  // 记录每个 API 请求的渲染进程真实 Origin，供 onHeadersReceived 回显。
  // credentials:'include' 模式下浏览器要求 ACAO 必须是具体 origin，不能为 '*'，
  // 否则跨域响应被拦（dev 的 http://localhost:5173 会触发，file:// 不会）。
  const reqOrigin = new Map<number, string>()

  // 请求发出前：注入 Referer + Origin（改写到 bilibili.com 绕过反爬）。
  // 音频/图片 CDN（bilivideo/hdslb）缺少 Referer 会返回 403。
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: biliUrls }, (details, callback) => {
    const headers = details.requestHeaders
    const origin = headers['Origin'] || headers['origin']
    // 仅记录 API/passport 请求的真实 origin（这些请求才有对应的 onHeadersReceived 消费并清理）
    if (origin && /^(https?|app):\/\//.test(origin) && /\/\/(api|passport)\.bilibili\.com/.test(details.url)) {
      reqOrigin.set(details.id, origin)
    }
    headers['Referer'] = 'https://www.bilibili.com'
    headers['Origin'] = 'https://www.bilibili.com'
    callback({ requestHeaders: headers })
  })

  // API/passport 响应：写入 CORS 头，让渲染进程的浏览器 fetch 可跨域读取
  const apiUrls = { urls: ['https://api.bilibili.com/*', 'https://passport.bilibili.com/*'] }
  session.defaultSession.webRequest.onHeadersReceived(apiUrls, (details, callback) => {
    const respHeaders: Record<string, string[]> = {}
    if (details.responseHeaders) {
      for (const [key, value] of Object.entries(details.responseHeaders)) {
        if (!key.toLowerCase().startsWith('access-control-allow')) {
          respHeaders[key] = value as string[]
        }
      }
    }
    const origin = reqOrigin.get(details.id)
    reqOrigin.delete(details.id)
    // 回显渲染进程真实 origin（带 credentials 时不能用 '*'）；取不到时退回 '*'（file:// 场景）
    respHeaders['access-control-allow-origin'] = [origin || '*']
    respHeaders['access-control-allow-credentials'] = ['true']
    respHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS']
    respHeaders['access-control-allow-headers'] = ['*']
    callback({ responseHeaders: respHeaders })
  })
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayWindow: BrowserWindow | null = null
let trayWindowReady = false
let pendingTrayShow: { x: number; y: number } | null = null
let isQuitting = false

type TrayCommand = 'toggle-play' | 'next' | 'prev' | 'show-window' | 'quit'

interface TrayPlayerState {
  hasTrack: boolean
  title: string
  artist: string
  coverUrl: string
  isPlaying: boolean
  queueLength: number
}

let trayPlayerState: TrayPlayerState = {
  hasTrack: false,
  title: '未在播放',
  artist: '搜索并播放音乐',
  coverUrl: '',
  isPlaying: false,
  queueLength: 0,
}

// 应用图标：dev 时从 electron 源目录加载，打包后从 dist-electron 同级加载（由 copy 脚本随构建复制）
function loadAppIcon(fileName = 'icon.png') {
  const iconPath = process.env.VITE_DEV_SERVER_URL
    ? path.join(__dirname, '../electron', fileName)
    : path.join(__dirname, fileName)
  return nativeImage.createFromPath(iconPath)
}

function createTrayIcon() {
  const trayIcon = isHarmonyOS ? loadAppIcon('tray.png') : loadAppIcon()
  // 托盘图标尺寸较小，缩放到 32px 以兼顾标准与高 DPI 显示
  return trayIcon.resize({ width: 32, height: 32 })
}

function showMainWindow() {
  if (!mainWindow) createWindow()
  if (process.platform === 'darwin') app.dock?.show()
  mainWindow?.show()
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.focus()
}

function updateTrayState() {
  tray?.setToolTip(trayPlayerState.hasTrack
    ? `${trayPlayerState.isPlaying ? '正在播放' : '已暂停'}: ${trayPlayerState.title}`
    : 'BiliMusic')
  trayWindow?.webContents.send('tray:state', trayPlayerState)
}

function getTrayHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; user-select: none; }
    body {
      width: 330px;
      height: 292px;
      margin: 0;
      overflow: hidden;
      color: #f7f7f8;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: transparent;
    }
    .menu {
      width: 100%;
      height: 100%;
      padding: 14px;
      border-radius: 22px;
      background:
        linear-gradient(180deg, rgba(38, 38, 42, .94), rgba(18, 18, 20, .96)),
        rgba(24, 24, 26, .96);
      border: 1px solid rgba(255, 255, 255, .12);
      box-shadow: 0 28px 80px rgba(0, 0, 0, .44), inset 0 1px rgba(255, 255, 255, .12);
      backdrop-filter: blur(30px) saturate(160%);
    }
    .now {
      display: flex;
      gap: 12px;
      align-items: center;
      min-height: 76px;
      padding: 10px;
      border-radius: 16px;
      background: rgba(255, 255, 255, .075);
      border: 1px solid rgba(255, 255, 255, .08);
    }
    .cover {
      width: 56px;
      height: 56px;
      display: grid;
      place-items: center;
      overflow: hidden;
      flex: 0 0 auto;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(255,55,95,.42), rgba(255,255,255,.08));
      box-shadow: 0 12px 30px rgba(0,0,0,.22);
    }
    .cover img { width: 100%; height: 100%; object-fit: cover; display: none; }
    .cover span { color: rgba(255,255,255,.62); font-size: 22px; }
    .meta { min-width: 0; flex: 1; }
    .meta strong, .meta small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta strong { font-size: 14px; line-height: 1.2; font-weight: 760; }
    .meta small { margin-top: 5px; color: rgba(255,255,255,.48); font-size: 12px; font-weight: 560; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 12px 2px 10px;
      color: rgba(255,255,255,.44);
      font-size: 11px;
      font-weight: 680;
    }
    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #8e8e93;
      box-shadow: 0 0 0 transparent;
    }
    .status.is-playing .dot {
      background: #30d158;
      box-shadow: 0 0 14px rgba(48,209,88,.65);
    }
    .controls {
      display: grid;
      grid-template-columns: 1fr 1.25fr 1fr;
      gap: 10px;
      padding: 0 4px 12px;
    }
    button {
      height: 42px;
      border: 0;
      border-radius: 999px;
      color: #fff;
      background: rgba(255,255,255,.1);
      cursor: pointer;
      font: 780 13px/1 system-ui, sans-serif;
      transition: transform .16s ease, background .16s ease, opacity .16s ease;
    }
    button:hover { background: rgba(255,255,255,.16); transform: translateY(-1px); }
    button:active { transform: scale(.96); }
    button:disabled { opacity: .42; cursor: default; transform: none; }
    .play {
      background: #ff375f;
      box-shadow: 0 14px 30px rgba(255,55,95,.26);
      font-size: 16px;
    }
    .actions {
      display: grid;
      gap: 8px;
      border-top: 1px solid rgba(255,255,255,.1);
      padding-top: 12px;
    }
    .row {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 13px;
      text-align: left;
      border-radius: 12px;
      background: transparent;
      color: rgba(255,255,255,.82);
    }
    .row:hover { background: rgba(255,255,255,.1); }
    .row.danger { color: #ff6961; }
    .count { color: rgba(255,255,255,.38); font-size: 12px; }
  </style>
</head>
<body>
  <div class="menu">
    <div class="now">
      <div class="cover"><img id="cover" /><span id="fallback">♪</span></div>
      <div class="meta">
        <strong id="title">未在播放</strong>
        <small id="artist">搜索并播放音乐</small>
      </div>
    </div>
    <div id="status" class="status"><span class="dot"></span><span id="statusText">空闲</span></div>
    <div class="controls">
      <button id="prev" title="上一首">⏮</button>
      <button id="play" class="play" title="播放/暂停">▶</button>
      <button id="next" title="下一首">⏭</button>
    </div>
    <div class="actions">
      <button class="row" id="show"><span>显示 BiliMusic</span><span class="count" id="queue">0 首</span></button>
      <button class="row danger" id="quit"><span>退出应用</span><span>⌘Q</span></button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron')
    const $ = (id) => document.getElementById(id)
    let state = { hasTrack: false, title: '未在播放', artist: '搜索并播放音乐', coverUrl: '', isPlaying: false, queueLength: 0 }
    function render(next) {
      state = next || state
      $('title').textContent = state.title || '未在播放'
      $('artist').textContent = state.artist || '搜索并播放音乐'
      $('status').className = 'status' + (state.isPlaying ? ' is-playing' : '')
      $('statusText').textContent = state.hasTrack ? (state.isPlaying ? '正在播放' : '已暂停') : '空闲'
      $('play').textContent = state.isPlaying ? '⏸' : '▶'
      $('queue').textContent = (state.queueLength || 0) + ' 首'
      $('prev').disabled = $('play').disabled = $('next').disabled = !state.hasTrack
      if (state.coverUrl) {
        $('cover').src = state.coverUrl
        $('cover').style.display = 'block'
        $('fallback').style.display = 'none'
      } else {
        $('cover').removeAttribute('src')
        $('cover').style.display = 'none'
        $('fallback').style.display = 'block'
      }
    }
    ipcRenderer.on('tray:state', (_event, next) => render(next))
    ipcRenderer.invoke('tray:get-state').then(render)
    $('prev').onclick = () => ipcRenderer.send('tray:command', 'prev')
    $('play').onclick = () => ipcRenderer.send('tray:command', 'toggle-play')
    $('next').onclick = () => ipcRenderer.send('tray:command', 'next')
    $('show').onclick = () => ipcRenderer.send('tray:command', 'show-window')
    $('quit').onclick = () => ipcRenderer.send('tray:command', 'quit')
  </script>
</body>
</html>`
}

function createTrayWindow() {
  if (isHarmonyOS) return null
  if (trayWindow) return trayWindow
  trayWindowReady = false
  trayWindow = new BrowserWindow({
    width: 330,
    height: 292,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    opacity: 0,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  trayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getTrayHtml())}`)
  trayWindow.once('ready-to-show', () => {
    trayWindowReady = true
    if (pendingTrayShow) {
      const pos = pendingTrayShow
      pendingTrayShow = null
      showTrayWindowAt(pos.x, pos.y)
    }
  })
  trayWindow.on('blur', () => {
    trayWindow?.setOpacity(0)
    trayWindow?.hide()
  })
  trayWindow.on('closed', () => {
    trayWindow = null
    trayWindowReady = false
    pendingTrayShow = null
  })
  return trayWindow
}

function showTrayWindowAt(x: number, y: number) {
  const win = createTrayWindow()
  if (!win) return
  if (!trayWindowReady) {
    pendingTrayShow = { x, y }
    return
  }
  win.setPosition(x, y, false)
  updateTrayState()
  win.setOpacity(0)
  win.showInactive()
  setTimeout(() => {
    if (!trayWindow?.isVisible()) return
    trayWindow.setOpacity(1)
    trayWindow.focus()
  }, 20)
}

function toggleTrayWindow() {
  if (isHarmonyOS) return
  if (!tray) return
  const win = createTrayWindow()
  if (!win) return
  if (win.isVisible()) {
    win.setOpacity(0)
    win.hide()
    return
  }

  const bounds = tray.getBounds()
  const { workArea } = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
  const width = 330
  const height = 292
  const x = Math.round(Math.min(Math.max(bounds.x + bounds.width / 2 - width / 2, workArea.x + 8), workArea.x + workArea.width - width - 8))
  const aboveY = bounds.y - height - 10
  const belowY = bounds.y + bounds.height + 10
  const y = aboveY >= workArea.y ? aboveY : Math.min(belowY, workArea.y + workArea.height - height - 8)

  showTrayWindowAt(x, Math.round(y))
}

function createTray() {
  if (tray) return
  tray = new Tray(createTrayIcon())
  tray.setToolTip('BiliMusic')
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  if (!isHarmonyOS) {
    tray.on('right-click', toggleTrayWindow)
    createTrayWindow()
  }
}

function hideToTray() {
  mainWindow?.hide()
  if (process.platform === 'darwin') app.dock?.hide()
}

function sendTrayCommand(command: TrayCommand) {
  if (command === 'show-window') {
    showMainWindow()
    trayWindow?.hide()
    return
  }
  if (command === 'quit') {
    isQuitting = true
    trayWindow?.close()
    mainWindow?.destroy()
    app.quit()
    return
  }
  mainWindow?.webContents.send('tray:player-command', command)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'BiliMusic',
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    minimizable: true,
    maximizable: true,
    closable: true,
    ...(!isHarmonyOS ? { titleBarStyle: 'hidden' as const } : {}),
    backgroundColor: '#F6F7F9',
    icon: loadAppIcon(),
    webPreferences: {
      preload: process.env.VITE_DEV_SERVER_URL
        ? path.join(__dirname, '../electron/preload.cjs')
        : path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL('app://local/index.html')
  }

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    hideToTray()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const sendMaximizeState = () => {
    mainWindow?.webContents.send('window:maximized-change', Boolean(mainWindow?.isMaximized() || mainWindow?.isFullScreen()))
  }
  const sendFullscreenState = () => {
    mainWindow?.webContents.send('window:fullscreen-change', Boolean(mainWindow?.isFullScreen()))
  }
  mainWindow.on('maximize', sendMaximizeState)
  mainWindow.on('unmaximize', sendMaximizeState)
  mainWindow.on('enter-full-screen', () => {
    sendMaximizeState()
    sendFullscreenState()
  })
  mainWindow.on('leave-full-screen', () => {
    sendMaximizeState()
    sendFullscreenState()
  })
}

// 窗口控制 IPC
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', hideToTray)
ipcMain.handle('window:isMaximized', () => Boolean(mainWindow?.isMaximized() || mainWindow?.isFullScreen()))
ipcMain.on('window:toggle-fullscreen', () => {
  if (!mainWindow) return
  const next = !mainWindow.isFullScreen()
  mainWindow.setFullScreen(next)
  mainWindow.webContents.send('window:fullscreen-change', next)
  mainWindow.webContents.send('window:maximized-change', Boolean(mainWindow.isMaximized() || next))
})
ipcMain.on('window:set-button-visibility', (_event, visible: boolean) => {
  if (!isHarmonyOS) return
  const setWindowButtonVisibility = (mainWindow as unknown as {
    setWindowButtonVisibility?: (visible: boolean) => void
  } | null)?.setWindowButtonVisibility
  if (typeof setWindowButtonVisibility === 'function') {
    setWindowButtonVisibility.call(mainWindow, Boolean(visible))
  }
})
ipcMain.handle('window:isFullscreen', () => Boolean(mainWindow?.isFullScreen()))
ipcMain.on('tray:player-state', (_event, state: TrayPlayerState) => {
  trayPlayerState = {
    hasTrack: Boolean(state?.hasTrack),
    title: String(state?.title || '未在播放'),
    artist: String(state?.artist || '搜索并播放音乐'),
    coverUrl: String(state?.coverUrl || ''),
    isPlaying: Boolean(state?.isPlaying),
    queueLength: Number(state?.queueLength || 0),
  }
  updateTrayState()
})
ipcMain.on('tray:command', (_event, command: TrayCommand) => sendTrayCommand(command))
ipcMain.handle('tray:get-state', () => trayPlayerState)
// 用系统默认浏览器打开外部链接（仅放行 http/https，避免任意协议执行）
ipcMain.handle('shell:open-external', (_event, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url)
})

app.whenReady().then(() => {
  // 生产环境注册 app:// 协议，映射到打包后的 dist 目录（asar 内 file:// 读取透明支持）
  if (!process.env.VITE_DEV_SERVER_URL) {
    protocol.handle('app', (request) => {
      const { pathname } = new URL(request.url)
      const filePath = path.join(__dirname, '../dist', decodeURIComponent(pathname))
      return net.fetch(pathToFileURL(filePath).toString())
    })
  }
  setupBiliHeaders()
  registerBiliApiHandlers()
  registerLyricsApiHandlers()
  if (isHarmonyOS) {
    // OpenHarmony 上窗口显示/隐藏与托盘强相关，需先创建托盘再创建主窗口。
    createTray()
    createWindow()
  } else {
    createWindow()
    createTray()
  }
})

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
  else showMainWindow()
})
