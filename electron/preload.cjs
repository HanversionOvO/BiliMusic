const { contextBridge, ipcRenderer } = require('electron')

console.log('[preload] Electron preload script starting...')

const biliApi = {
  search: (keyword, page, pageSize) =>
    ipcRenderer.invoke('bili:search', keyword, page, pageSize),

  videoDetail: (bvid) =>
    ipcRenderer.invoke('bili:videoDetail', bvid),

  playUrl: (bvid, cid) =>
    ipcRenderer.invoke('bili:playUrl', bvid, cid),

  nav: () =>
    ipcRenderer.invoke('bili:nav'),

  popular: (ps, pn) =>
    ipcRenderer.invoke('bili:popular', ps, pn),

  recommend: (ps) =>
    ipcRenderer.invoke('bili:recommend', ps),

  musicRanking: () =>
    ipcRenderer.invoke('bili:musicRanking'),

  favorites: (mid) =>
    ipcRenderer.invoke('bili:favorites', mid),

  extractAudio: (bvid) =>
    ipcRenderer.invoke('bili:extractAudio', bvid),

  downloadAudio: (audioUrl, filename) =>
    ipcRenderer.invoke('bili:downloadAudio', audioUrl, filename),

  // 扫码登录
  qrGenerate: () =>
    ipcRenderer.invoke('bili:qrGenerate'),

  qrPoll: (qrcodeKey) =>
    ipcRenderer.invoke('bili:qrPoll', qrcodeKey),

  getCookies: () =>
    ipcRenderer.invoke('bili:getCookies'),

  logout: () =>
    ipcRenderer.invoke('bili:logout'),
}

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  platform: 'win32',
  biliApi,
})
