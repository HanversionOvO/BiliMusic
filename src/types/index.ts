export interface Track {
  id: string
  title: string
  artist: string
  // Bilibili 投稿者与音乐歌手是不同概念；只有 uploader 字段用于跳转 UP 主空间。
  uploaderName?: string
  uploaderMid?: string | number
  album?: string
  coverUrl: string
  duration: number
  videoUrl: string
  bvid: string
  // 音乐中心曲目的顶层 avid+cid：当 bvid 稿件不存在（-404）时回退直取音乐流
  aid?: string | number
  cid?: string | number
  // 分P视频中的页码及所属视频标题；旧数据缺省时仍按普通视频/P1处理
  page?: number
  parentTitle?: string
  sourceType?: 'video' | 'video-part' | 'music'
  playCount: number
  isLiked: boolean
  likedAt?: string // 收藏时间，供云同步按 like/unlike 时间合并
  metadataUpdatedAt?: string // 用户编辑收藏元数据的时间，供云同步处理版本冲突
}

export interface Playlist {
  id: string
  name: string
  description?: string
  coverUrl: string
  tracks: Track[]
  createdAt: string
  updatedAt: string
}

// 删除墓碑：双向同步时区分「在此端删除」与「此端从未有过」，避免删除项被对端复活
export interface Tombstone {
  id: string
  deletedAt: string
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type RepeatMode = 'none' | 'one' | 'all'
export type SidebarState = 'expanded' | 'collapsed' | 'auto'

export interface AppSettings {
  sidebarState: SidebarState
  playQuality: '标准' | '高品质' | '无损'
  downloadQuality: '标准' | '高品质' | '无损'
  downloadDir: string
  autoPlay: boolean
  showLyrics: boolean
}

export type NavItem = {
  icon: string
  label: string
  path: string
}

export interface UserInfo {
  isLogin: boolean
  mid: number
  uname: string
  face: string
  vipType: number
  vipStatus: number
}
