import { Search, X, Loader2, Music, Video, Users, ArrowLeft } from 'lucide-react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { usePlayer } from '@/contexts/PlayerContext'
import TrackActions from '@/components/TrackActions'
import {
  searchVideo,
  searchUsers,
  getUserVideos,
  type SearchItem,
  type UserResult,
  type UpVideo,
} from '@/services/api'
import type { Track } from '@/types'

type SearchType = 'video' | 'user'
type SelectedUser = { mid: number; name: string; avatar: string }

function formatCount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}

function formatDuration(seconds: number): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parseDuration(d: string): number {
  if (!d) return 0
  const parts = d.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function searchItemToTrack(item: SearchItem): Track {
  return {
    id: item.bvid,
    title: item.title,
    artist: item.author,
    coverUrl: item.pic,
    duration: parseDuration(item.duration),
    videoUrl: `https://www.bilibili.com/video/${item.bvid}`,
    bvid: item.bvid,
    playCount: item.play,
    isLiked: false,
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('video')
  const [resultType, setResultType] = useState<SearchType>('video')
  const [isFocused, setIsFocused] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [results, setResults] = useState<SearchItem[]>([])
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalResults, setTotalResults] = useState(0)
  const pageRef = useRef(1)
  const totalPagesRef = useRef(0)
  const currentQueryRef = useRef('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(async (typeArg?: SearchType) => {
    if (!query.trim()) return
    const type = typeArg ?? searchType
    setLoading(true)
    setError(null)
    setSelectedUser(null)
    setResults([])
    setUserResults([])
    pageRef.current = 1
    currentQueryRef.current = query.trim()
    try {
      if (type === 'video') {
        const data = await searchVideo(query.trim(), 1)
        setResults(data.items)
        setTotalResults(data.totalResults)
        totalPagesRef.current = data.totalPages
      } else {
        const data = await searchUsers(query.trim(), 1)
        setUserResults(data.items)
        setTotalResults(data.totalResults)
        totalPagesRef.current = data.totalPages
      }
      setResultType(type)
      setHasSearched(true)
    } catch (e: any) {
      setError(e.message || '搜索失败')
    } finally {
      setLoading(false)
    }
  }, [query, searchType])

  const switchType = useCallback((type: SearchType) => {
    if (type === searchType) return
    setSearchType(type)
    setSelectedUser(null)
    setResults([])
    setUserResults([])
    if (query.trim()) {
      handleSearch(type)
    } else {
      setHasSearched(false)
    }
  }, [searchType, query, handleSearch])

  const loadMore = useCallback(async () => {
    if (loadingMore || pageRef.current >= totalPagesRef.current) return
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      if (resultType === 'video') {
        const data = await searchVideo(currentQueryRef.current, nextPage)
        pageRef.current = nextPage
        setResults(prev => [...prev, ...data.items])
      } else {
        const data = await searchUsers(currentQueryRef.current, nextPage)
        pageRef.current = nextPage
        setUserResults(prev => [...prev, ...data.items])
      }
    } catch {
      // 加载更多失败静默处理
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, resultType])

  // IntersectionObserver 触底加载（UP主空间视图有独立分页，故此处排除）
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasSearched || selectedUser) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasSearched, selectedUser, loadMore, results.length, userResults.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${isFocused ? 'var(--color-primary)' : 'var(--glass-border)'}`,
            boxShadow: isFocused ? '0 0 0 3px rgba(251,114,153,0.15)' : 'none',
            transition: 'border-color var(--duration-fast), box-shadow var(--duration-fast)',
          }}
        >
          {loading ? (
            <Loader2 size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
          ) : (
            <Search size={18} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
          )}
          <input
            type="text"
            placeholder={searchType === 'video' ? '搜索视频、音乐...' : '搜索 UP主...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 'var(--text-body)',
              color: 'var(--color-foreground)',
              fontFamily: 'var(--font-body)',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setHasSearched(false); setResults([]); setUserResults([]); setSelectedUser(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 2 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 搜索类型切换 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <TypeTab active={searchType === 'video'} icon={<Video size={15} />} label="视频" onClick={() => switchType('video')} />
        <TypeTab active={searchType === 'user'} icon={<Users size={15} />} label="UP主" onClick={() => switchType('user')} />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245,63,63,0.1)',
            color: 'var(--color-destructive)',
            fontSize: 'var(--text-body)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <X size={16} />
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-destructive)' }}>
            关闭
          </button>
        </div>
      )}

      {/* UP主 空间视图 */}
      {selectedUser ? (
        <UserSpaceView user={selectedUser} onBack={() => setSelectedUser(null)} />
      ) : hasSearched ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-body">
              搜索结果: "<span style={{ color: 'var(--color-primary)' }}>{currentQueryRef.current}</span>"
            </span>
            <span className="text-caption" style={{ color: 'var(--color-muted)' }}>
              {totalResults > 0 ? `共 ${totalResults.toLocaleString()} 条结果` : '无结果'}
            </span>
          </div>

          {resultType === 'user' ? (
            /* UP主 结果 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {userResults.map((user) => (
                <UserCard key={user.mid} user={user} onEnter={() => setSelectedUser({ mid: user.mid, name: user.name, avatar: user.avatar })} />
              ))}
            </div>
          ) : (
            /* 视频结果 — 音乐风列表 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {results.map((result) => (
                <VideoRow
                  key={result.bvid || result.aid}
                  track={searchItemToTrack(result)}
                  subtitle={`${result.author} · ${formatCount(result.play)}播放`}
                  durationText={result.duration}
                />
              ))}
            </div>
          )}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md)', color: 'var(--color-muted)' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          {pageRef.current >= totalPagesRef.current && (results.length > 0 || userResults.length > 0) && (
            <div className="text-caption" style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 'var(--space-md)' }}>
              — 已加载全部 {totalResults.toLocaleString()} 条结果 —
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-2xl)',
            color: 'var(--color-muted)',
          }}
        >
          <Search size={48} strokeWidth={1} style={{ marginBottom: 16 }} />
          <p className="text-h3">{searchType === 'video' ? '搜索 B站视频' : '搜索 UP主'}</p>
          <p className="text-caption" style={{ marginTop: 4 }}>
            {searchType === 'video' ? '输入关键词搜索，点击歌曲加入播放列表' : '搜索 UP主，进入主页选择其投稿'}
          </p>
        </div>
      )}
    </div>
  )
}

// ===== 搜索类型切换标签 =====
function TypeTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 16px',
        borderRadius: 'var(--radius-full)',
        background: active ? 'var(--color-primary)' : 'var(--glass-bg)',
        color: active ? 'var(--color-on-primary)' : 'var(--color-muted-foreground)',
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--glass-border)'}`,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        transition: 'all var(--duration-fast)',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ===== 音乐风曲目行（搜索结果 / UP主投稿共用）=====
function VideoRow({ track, subtitle, durationText }: {
  track: Track
  subtitle: string
  durationText?: string
}) {
  const player = usePlayer()
  const [hover, setHover] = useState(false)
  const isCurrent = player.currentTrack?.id === track.id
  return (
    <div
      onClick={() => player.playNow(track)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: '8px var(--space-md)',
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        background: hover || isCurrent ? 'var(--color-primary-light)' : 'transparent',
        transition: 'background var(--duration-fast)',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
        {track.coverUrl ? (
          <img src={track.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music size={18} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="text-body"
          style={{
            fontWeight: isCurrent ? 600 : 400,
            color: isCurrent ? 'var(--color-primary)' : 'var(--color-foreground)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {track.title}
        </div>
        <div className="text-caption" style={{ color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </div>
      </div>
      {durationText && (
        <span className="text-caption" style={{ color: 'var(--color-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {durationText}
        </span>
      )}
      <div style={{ opacity: hover ? 1 : 0.5, transition: 'opacity var(--duration-fast)', flexShrink: 0 }}>
        <TrackActions track={track} />
      </div>
    </div>
  )
}

// ===== UP主 结果行 =====
function UserCard({ user, onEnter }: { user: UserResult; onEnter: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onEnter}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: '10px var(--space-md)',
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        background: hover ? 'var(--color-primary-light)' : 'transparent',
        transition: 'background var(--duration-fast)',
      }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-full)', background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
        {user.avatar ? (
          <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-body" style={{ fontWeight: 600, color: 'var(--color-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </div>
        <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 1 }}>
          {formatCount(user.fans)}粉丝 · {user.videoCount}个视频
        </div>
        {user.sign && (
          <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.75 }}>
            {user.sign}
          </div>
        )}
      </div>
      <span className="text-caption" style={{ color: 'var(--color-primary)', flexShrink: 0 }}>进入主页 →</span>
    </div>
  )
}

// ===== UP主 空间（投稿视频列表）=====
function UserSpaceView({ user, onBack }: { user: SelectedUser; onBack: () => void }) {
  const [videos, setVideos] = useState<UpVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const pageRef = useRef(1)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const player = usePlayer()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    pageRef.current = 1
    try {
      const data = await getUserVideos(user.mid, 1, 30)
      setVideos(data.items)
      setTotal(data.total)
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [user.mid])

  useEffect(() => { load() }, [load])

  const loadMore = useCallback(async () => {
    if (loadingMore || videos.length === 0 || videos.length >= total) return
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      const data = await getUserVideos(user.mid, nextPage, 30)
      pageRef.current = nextPage
      setVideos(prev => [...prev, ...data.items])
    } catch {
      // 静默
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, videos.length, total, user.mid])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, videos.length])

  const toTrack = useCallback((v: UpVideo): Track => ({
    id: v.bvid,
    title: v.title,
    artist: user.name,
    coverUrl: v.coverUrl,
    duration: v.duration,
    videoUrl: `https://www.bilibili.com/video/${v.bvid}`,
    bvid: v.bvid,
    playCount: v.play,
    isLiked: false,
  }), [user.name])

  const playAll = useCallback(() => {
    if (videos.length === 0) return
    player.playAll(videos.map(toTrack))
  }, [videos, player, toTrack])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* UP主 资料头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <button
          onClick={onBack}
          title="返回"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 'var(--radius-full)',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            color: 'var(--color-foreground)', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-full)', background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
          {user.avatar ? (
            <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={22} style={{ color: 'var(--color-muted)' }} />
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="text-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
          {total > 0 && <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 2 }}>共 {total.toLocaleString()} 个投稿</div>}
        </div>
        {videos.length > 0 && (
          <button
            onClick={playAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary)', color: 'var(--color-on-primary)',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-body)', flexShrink: 0,
            }}
          >
            播放全部
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--color-muted)' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-muted)' }}>
          <p className="text-body">{error}</p>
          <button onClick={load} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>重试</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {videos.map((video) => (
              <VideoRow
                key={video.bvid}
                track={toTrack(video)}
                subtitle={`${formatCount(video.play)}播放`}
                durationText={formatDuration(video.duration)}
              />
            ))}
          </div>

          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md)', color: 'var(--color-muted)' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          {videos.length >= total && videos.length > 0 && (
            <div className="text-caption" style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 'var(--space-md)' }}>
              — 已加载全部 {total.toLocaleString()} 个投稿 —
            </div>
          )}
        </>
      )}
    </div>
  )
}
