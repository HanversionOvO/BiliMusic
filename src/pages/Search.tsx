import { Search, X, Loader2, Plus, Heart, Music } from 'lucide-react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { usePlayer } from '@/contexts/PlayerContext'
import { searchVideo, extractAudio, type SearchItem } from '@/services/api'
import type { Track } from '@/types'

function searchItemToTrack(item: SearchItem): Track {
  return {
    id: item.bvid || String(item.aid),
    title: item.title?.replace(/<[^>]+>/g, ''),
    artist: item.author,
    coverUrl: item.pic?.startsWith('http') ? item.pic : `https://i0.hdslb.com${item.pic || ''}`,
    duration: parseDuration(item.duration),
    videoUrl: `https://www.bilibili.com/video/${item.bvid}`,
    bvid: item.bvid,
    playCount: item.play,
    isLiked: false,
  }
}

function parseDuration(d: string): number {
  if (!d) return 0
  const parts = d.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [results, setResults] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [totalResults, setTotalResults] = useState(0)
  const pageRef = useRef(1)
  const totalPagesRef = useRef(0)
  const currentQueryRef = useRef('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const player = usePlayer()

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    pageRef.current = 1
    currentQueryRef.current = query.trim()
    try {
      const data = await searchVideo(query.trim(), 1)
      setResults(data.items)
      setTotalResults(data.totalResults)
      totalPagesRef.current = data.totalPages
      setHasSearched(true)
    } catch (e: any) {
      setError(e.message || '搜索失败')
    } finally {
      setLoading(false)
    }
  }, [query])

  const loadMore = useCallback(async () => {
    if (loadingMore || pageRef.current >= totalPagesRef.current) return
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      const data = await searchVideo(currentQueryRef.current, nextPage)
      pageRef.current = nextPage
      setResults(prev => [...prev, ...data.items])
    } catch {
      // 加载更多失败静默处理
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore])

  // IntersectionObserver 触底加载
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasSearched) return

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
  }, [hasSearched, loadMore, results.length])

  const handleAddToQueue = useCallback(async (bvid: string) => {
    if (!bvid) return
    setExtractingId(bvid)
    try {
      const trackSource = await extractAudio(bvid)
      const track: Track = {
        id: trackSource.bvid,
        title: trackSource.title,
        artist: trackSource.artist,
        coverUrl: trackSource.coverUrl,
        duration: trackSource.duration,
        videoUrl: `https://www.bilibili.com/video/${trackSource.bvid}`,
        bvid: trackSource.bvid,
        playCount: 0,
        isLiked: false,
      }
      player.addToQueue(track)
      if (!player.currentTrack) {
        player.play(track)
      }
    } catch (e: any) {
      setError(e.message || '提取音频失败')
    } finally {
      setExtractingId(null)
    }
  }, [player])

  const handlePlayNow = useCallback(async (item: SearchItem) => {
    if (!item.bvid) return
    setExtractingId(item.bvid)
    try {
      const trackSource = await extractAudio(item.bvid)
      const track: Track = {
        id: trackSource.bvid,
        title: trackSource.title,
        artist: trackSource.artist,
        coverUrl: trackSource.coverUrl,
        duration: trackSource.duration,
        videoUrl: `https://www.bilibili.com/video/${trackSource.bvid}`,
        bvid: trackSource.bvid,
        playCount: 0,
        isLiked: false,
      }
      player.play(track)
    } catch (e: any) {
      setError(e.message || '提取音频失败')
    } finally {
      setExtractingId(null)
    }
  }, [player])

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
            placeholder="搜索视频、音乐、UP主..."
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
              onClick={() => { setQuery(''); setHasSearched(false); setResults([]) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 2 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
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

      {/* Search Results */}
      {hasSearched ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-body">
              搜索结果: "<span style={{ color: 'var(--color-primary)' }}>{currentQueryRef.current}</span>"
            </span>
            <span className="text-caption" style={{ color: 'var(--color-muted)' }}>
              {totalResults > 0 ? `共 ${totalResults.toLocaleString()} 条结果` : '无结果'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {results.map((result) => {
              const isExtracting = extractingId === result.bvid
              const isCurrent = player.currentTrack?.id === result.bvid
              return (
                <div
                  key={result.bvid || result.aid}
                  className="glass-panel"
                  style={{
                    display: 'flex',
                    gap: 'var(--space-md)',
                    padding: 'var(--space-md)',
                    cursor: 'pointer',
                    borderLeft: isCurrent ? '3px solid var(--color-accent)' : undefined,
                    transition: 'transform var(--duration-normal), box-shadow var(--duration-normal)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                  }}
                  onClick={() => handlePlayNow(result)}
                >
                  {/* Cover */}
                  <div
                    style={{
                      width: 120,
                      height: 90,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-border)',
                      flexShrink: 0,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {result.pic ? (
                      <img src={result.pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    ) : (
                      <Music size={24} style={{ color: 'var(--color-muted)' }} />
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 11,
                      }}
                    >
                      {result.duration}
                    </span>
                    {isCurrent && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,174,236,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Music size={20} style={{ color: '#fff' }} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="text-body"
                      style={{
                        fontWeight: 500,
                        color: isCurrent ? 'var(--color-accent)' : 'var(--color-foreground)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {result.title}
                    </div>
                    <div className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 4 }}>
                      UP主: {result.author} · {result.play > 10000 ? `${(result.play / 10000).toFixed(1)}万` : result.play}播放
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddToQueue(result.bvid) }}
                        disabled={isExtracting}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-primary)',
                          color: 'var(--color-on-primary)',
                          border: 'none',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isExtracting ? 'wait' : 'pointer',
                          fontFamily: 'var(--font-body)',
                          opacity: isExtracting ? 0.6 : 1,
                          transition: 'opacity var(--duration-fast)',
                        }}
                      >
                        {isExtracting ? '提取中...' : '+ 添加到播放列表'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation() }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--glass-bg)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--color-foreground)',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Heart size={12} />
                        收藏
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md)', color: 'var(--color-muted)' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          {pageRef.current >= totalPagesRef.current && results.length > 0 && (
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
          <p className="text-h3">搜索B站视频</p>
          <p className="text-caption" style={{ marginTop: 4 }}>
            输入关键词搜索，将视频转换为音乐
          </p>
        </div>
      )}
    </div>
  )
}