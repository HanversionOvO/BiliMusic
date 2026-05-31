import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, Loader2, Music, Play, Search, Sparkles, UserRound, Users, Video, X } from 'lucide-react'
import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
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

const pageMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
}

const listMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.03 } },
}

const itemMotion = {
  initial: { opacity: 0, y: 12, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
}

function getScrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null
  while (node) {
    const style = window.getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(`${style.overflowY}${style.overflow}`)) return node
    node = node.parentElement
  }
  return null
}

function getScrollTargets(element: HTMLElement | null): Array<HTMLElement | Window | Document> {
  const targets: Array<HTMLElement | Window | Document> = [window, document]
  let node = element?.parentElement ?? null
  while (node) {
    const style = window.getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(`${style.overflowY}${style.overflow}`)) targets.push(node)
    node = node.parentElement
  }
  return [...new Set(targets)]
}

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
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [totalResults, setTotalResults] = useState(0)
  const pageRef = useRef(1)
  const totalPagesRef = useRef(0)
  const currentQueryRef = useRef('')
  const pageRootRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const clearSearch = useCallback(() => {
    setQuery('')
    setHasSearched(false)
    setResults([])
    setUserResults([])
    setSelectedUser(null)
    setError(null)
    setLoadMoreError(null)
    setReachedEnd(false)
    setTotalResults(0)
    pageRef.current = 1
    totalPagesRef.current = 0
    currentQueryRef.current = ''
  }, [])

  const executeSearch = useCallback(async (keyword: string, type: SearchType) => {
    if (!keyword.trim()) return
    const normalizedKeyword = keyword.trim()
    setLoading(true)
    setError(null)
    setLoadMoreError(null)
    setReachedEnd(false)
    setSelectedUser(null)
    setResults([])
    setUserResults([])
    pageRef.current = 1
    currentQueryRef.current = normalizedKeyword

    try {
      if (type === 'video') {
        const data = await searchVideo(normalizedKeyword, 1)
        setResults(data.items)
        setTotalResults(data.totalResults)
        totalPagesRef.current = data.totalPages
      } else {
        const data = await searchUsers(normalizedKeyword, 1)
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
  }, [])

  const handleSearch = useCallback(async (typeArg?: SearchType) => {
    const keyword = query.trim()
    if (!keyword) return
    await executeSearch(keyword, typeArg ?? searchType)
  }, [executeSearch, query, searchType])

  const switchType = useCallback((type: SearchType) => {
    if (type === searchType) return
    setSearchType(type)
    setSelectedUser(null)
    setResults([])
    setUserResults([])
    setError(null)
    if (query.trim()) {
      executeSearch(query.trim(), type)
    } else {
      setHasSearched(false)
    }
  }, [searchType, query, executeSearch])

  const loadMore = useCallback(async () => {
    const loadedCount = resultType === 'video' ? results.length : userResults.length
    const hasMore = !reachedEnd && (pageRef.current < totalPagesRef.current || loadedCount > 0 || (totalResults > 0 && loadedCount < totalResults))
    if (loading || loadingMore || loadingMoreRef.current || !currentQueryRef.current || !hasMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const nextPage = pageRef.current + 1
      if (resultType === 'video') {
        const data = await searchVideo(currentQueryRef.current, nextPage)
        pageRef.current = nextPage
        totalPagesRef.current = data.items.length === 0 ? nextPage : data.totalPages
        setTotalResults(data.totalResults)
        if (data.items.length === 0) setReachedEnd(true)
        setResults(prev => [...prev, ...data.items])
      } else {
        const data = await searchUsers(currentQueryRef.current, nextPage)
        pageRef.current = nextPage
        totalPagesRef.current = data.items.length === 0 ? nextPage : data.totalPages
        setTotalResults(data.totalResults)
        if (data.items.length === 0) setReachedEnd(true)
        setUserResults(prev => [...prev, ...data.items])
      }
    } catch (e: any) {
      setLoadMoreError(e?.message || '加载更多失败')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [loading, loadingMore, reachedEnd, resultType, results.length, totalResults, userResults.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const pageRoot = pageRootRef.current
    if (!sentinel || !hasSearched || selectedUser) return

    const scrollRoot = getScrollParent(sentinel)
    const loadedCount = resultType === 'video' ? results.length : userResults.length
    const canLoadMore = () => {
      const hasMore = !reachedEnd && (pageRef.current < totalPagesRef.current || loadedCount > 0 || (totalResults > 0 && loadedCount < totalResults))
      return hasMore && !loading && !loadingMore && !loadingMoreRef.current
    }
    const checkNearBottom = () => {
      if (!canLoadMore()) return
      if (pageRoot && scrollRoot) {
        const distance = pageRoot.getBoundingClientRect().bottom - scrollRoot.getBoundingClientRect().bottom
        if (distance < 720) loadMore()
        return
      }
      if (pageRoot) {
        const distance = pageRoot.getBoundingClientRect().bottom - window.innerHeight
        if (distance < 720) loadMore()
        return
      }
      const distance = sentinel.getBoundingClientRect().top - window.innerHeight
      if (distance < 720) loadMore()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && canLoadMore()) {
          loadMore()
        }
      },
      { root: scrollRoot, rootMargin: '520px 0px' },
    )
    observer.observe(sentinel)

    const scrollTargets = getScrollTargets(sentinel)
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        checkNearBottom()
      })
    }
    scrollTargets.forEach(target => target.addEventListener('scroll', onScroll, { passive: true, capture: true }))
    window.addEventListener('wheel', onScroll, { passive: true, capture: true })
    window.addEventListener('touchmove', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll, { passive: true })
    checkNearBottom()
    const interval = window.setInterval(checkNearBottom, 700)

    return () => {
      observer.disconnect()
      scrollTargets.forEach(target => target.removeEventListener('scroll', onScroll, { capture: true }))
      window.removeEventListener('wheel', onScroll, { capture: true })
      window.removeEventListener('touchmove', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      window.clearInterval(interval)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [hasSearched, selectedUser, loading, loadingMore, loadMore, reachedEnd, resultType, results.length, totalResults, userResults.length])

  const hasAnyResults = resultType === 'video' ? results.length > 0 : userResults.length > 0
  const loadedCount = resultType === 'video' ? results.length : userResults.length
  const hasMoreResults = hasAnyResults && !reachedEnd && (pageRef.current < totalPagesRef.current || (totalResults > 0 && loadedCount < totalResults))

  return (
    <motion.div ref={pageRootRef} className="apple-search-page" {...pageMotion}>
      <section className="apple-search-hero">
        <div className="apple-search-hero__shine" />
        <div className="apple-search-titlebar">
          <div>
            <p className="apple-search-eyebrow">Search</p>
            <h1>搜索</h1>
          </div>
          <div className="apple-search-signal" aria-hidden="true">
            <Sparkles size={16} />
            <span>Music</span>
          </div>
        </div>

        <div
          className={`apple-search-input-shell ${isFocused ? 'is-focused' : ''} ${loading ? 'is-loading' : ''}`}
        >
          <div className="apple-search-input-icon">
            {loading ? <Loader2 size={20} className="spin" /> : <Search size={20} />}
          </div>
          <input
            type="text"
            placeholder={searchType === 'video' ? '歌曲、艺人、视频' : 'UP 主、音乐人、频道'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 120)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <AnimatePresence>
            {query && (
              <motion.button
                key="clear"
                type="button"
                className="apple-search-clear"
                onClick={clearSearch}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.72 }}
                whileTap={{ scale: 0.9 }}
                title="清空"
              >
                <X size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <LayoutGroup>
          <div className="apple-search-segment" role="tablist" aria-label="搜索类型">
            <TypeTab active={searchType === 'video'} icon={<Video size={15} />} label="视频" onClick={() => switchType('video')} />
            <TypeTab active={searchType === 'user'} icon={<Users size={15} />} label="UP主" onClick={() => switchType('user')} />
          </div>
        </LayoutGroup>
      </section>

      <AnimatePresence>
        {error && (
          <motion.div
            className="apple-search-error"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
          >
            <X size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)}>关闭</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedUser ? (
          <motion.div key="user-space" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.28 }}>
            <UserSpaceView user={selectedUser} onBack={() => setSelectedUser(null)} />
          </motion.div>
        ) : loading ? (
          <motion.div key="loading" className="apple-search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ResultsHeader query={query.trim()} total={0} mutedText="正在搜索" />
            <LoadingRows type={searchType} />
          </motion.div>
        ) : hasSearched ? (
          <motion.section key={`${resultType}-${currentQueryRef.current}`} className="apple-search-results" {...listMotion}>
            <ResultsHeader query={currentQueryRef.current} total={totalResults} mutedText={hasAnyResults ? undefined : '无结果'} />

            {resultType === 'user' ? (
              <motion.div className="apple-search-list" variants={listMotion}>
                {userResults.map((user) => (
                  <UserCard
                    key={user.mid}
                    user={user}
                    onEnter={() => setSelectedUser({ mid: user.mid, name: user.name, avatar: user.avatar })}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div className="apple-search-list" variants={listMotion}>
                {results.map((result) => (
                  <VideoRow
                    key={result.bvid || result.aid}
                    track={searchItemToTrack(result)}
                    subtitle={`${result.author} · ${formatCount(result.play)}播放`}
                    durationText={result.duration}
                  />
                ))}
              </motion.div>
            )}

            {!hasAnyResults && (
              <EmptyState
                title="没有找到结果"
                caption="换一个关键词再试试"
                icon={resultType === 'video' ? <Music size={30} /> : <UserRound size={30} />}
              />
            )}

            <div ref={sentinelRef} style={{ height: 1 }} />
            {loadingMore ? (
              <div className="apple-search-more">
                <Loader2 size={22} className="spin" />
              </div>
            ) : loadMoreError && hasAnyResults ? (
              <div className="apple-search-end">
                <button type="button" className="apple-search-retry" onClick={loadMore}>
                  {loadMoreError}，点击重试
                </button>
              </div>
            ) : hasMoreResults ? (
              <div className="apple-search-end">
                <button type="button" className="apple-search-retry" onClick={loadMore}>
                  继续加载更多
                </button>
              </div>
            ) : hasAnyResults && (
              <div className="apple-search-end">已加载全部 {totalResults.toLocaleString()} 条结果</div>
            )}
          </motion.section>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            <EmptySearchMode searchType={searchType} onSearch={(keyword) => { setQuery(keyword); executeSearch(keyword, searchType) }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TypeTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`apple-search-tab ${active ? 'is-active' : ''}`}
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {active && <motion.span className="apple-search-tab__pill" layoutId="search-tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
      <span className="apple-search-tab__content">
        {icon}
        {label}
      </span>
    </button>
  )
}

function ResultsHeader({ query, total, mutedText }: { query: string; total: number; mutedText?: string }) {
  return (
    <motion.div className="apple-search-results-header" variants={itemMotion}>
      <div>
        <p>搜索结果</p>
        <h2>{query ? `"${query}"` : '关键词'}</h2>
      </div>
      <span>{mutedText || `共 ${total.toLocaleString()} 项`}</span>
    </motion.div>
  )
}

function VideoRow({ track, subtitle, durationText }: {
  track: Track
  subtitle: string
  durationText?: string
}) {
  const player = usePlayer()
  const isCurrent = player.currentTrack?.id === track.id

  return (
    <motion.div
      className={`apple-search-row video-row ${isCurrent ? 'is-current' : ''}`}
      onClick={() => player.playNow(track)}
      variants={itemMotion}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.18 }}
    >
      <div className="apple-search-cover">
        {track.coverUrl ? (
          <img src={track.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className="apple-search-cover__fallback"><Music size={20} /></div>
        )}
        <div className="apple-search-cover__play">
          <Play size={18} fill="currentColor" />
        </div>
      </div>

      <div className="apple-search-row__main">
        <div className="apple-search-row__title">{track.title}</div>
        <div className="apple-search-row__meta">{subtitle}</div>
      </div>

      {durationText && <span className="apple-search-duration">{durationText}</span>}
      <div className="apple-search-actions">
        <TrackActions track={track} />
      </div>
    </motion.div>
  )
}

function UserCard({ user, onEnter }: { user: UserResult; onEnter: () => void }) {
  return (
    <motion.div
      className="apple-search-row user-row"
      onClick={onEnter}
      variants={itemMotion}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.18 }}
    >
      <div className="apple-search-avatar">
        {user.avatar ? (
          <img src={user.avatar} alt="" loading="lazy" />
        ) : (
          <div className="apple-search-cover__fallback"><Users size={22} /></div>
        )}
      </div>
      <div className="apple-search-row__main">
        <div className="apple-search-row__title">{user.name}</div>
        <div className="apple-search-row__meta">{formatCount(user.fans)}粉丝 · {user.videoCount}个视频</div>
        {user.sign && <div className="apple-search-user-sign">{user.sign}</div>}
      </div>
      <div className="apple-search-enter">
        <span>进入主页</span>
        <ChevronRight size={16} />
      </div>
    </motion.div>
  )
}

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
      // 追加失败不影响已经加载的投稿。
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, videos.length, total, user.mid])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '240px' },
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
    <section className="apple-user-space">
      <motion.div className="apple-user-hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
        <button type="button" className="apple-user-back" onClick={onBack} title="返回">
          <ArrowLeft size={19} />
        </button>
        <div className="apple-user-avatar">
          {user.avatar ? <img src={user.avatar} alt="" /> : <Users size={28} />}
        </div>
        <div className="apple-user-info">
          <p>UP 主空间</p>
          <h2>{user.name}</h2>
          {total > 0 && <span>共 {total.toLocaleString()} 个投稿</span>}
        </div>
        {videos.length > 0 && (
          <motion.button
            type="button"
            className="apple-user-play"
            onClick={playAll}
            whileHover={{ scale: 1.025 }}
            whileTap={{ scale: 0.96 }}
          >
            <Play size={17} fill="currentColor" />
            播放全部
          </motion.button>
        )}
      </motion.div>

      {loading ? (
        <LoadingRows type="video" />
      ) : error ? (
        <EmptyState title={error} caption="稍后再试或重新加载" icon={<X size={30} />} action={<button onClick={load}>重试</button>} />
      ) : (
        <>
          <motion.div className="apple-search-list" variants={listMotion} initial="initial" animate="animate">
            {videos.map((video) => (
              <VideoRow
                key={video.bvid}
                track={toTrack(video)}
                subtitle={`${formatCount(video.play)}播放`}
                durationText={formatDuration(video.duration)}
              />
            ))}
          </motion.div>

          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div className="apple-search-more">
              <Loader2 size={22} className="spin" />
            </div>
          )}
          {videos.length >= total && videos.length > 0 && (
            <div className="apple-search-end">已加载全部 {total.toLocaleString()} 个投稿</div>
          )}
        </>
      )}
    </section>
  )
}

function EmptySearchMode({ searchType, onSearch }: { searchType: SearchType; onSearch: (keyword: string) => void }) {
  const suggestions = searchType === 'video'
    ? ['周杰伦', '新歌', 'Lo-fi', 'Live']
    : ['音乐区官方', '钢琴', '翻唱', '电音']

  return (
    <section className="apple-search-empty">
      <motion.div
        className="apple-search-empty__icon"
        animate={{ y: [0, -7, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {searchType === 'video' ? <Music size={38} /> : <Users size={38} />}
      </motion.div>
      <h2>{searchType === 'video' ? '今天想听什么？' : '发现创作者'}</h2>
      <div className="apple-search-suggestions">
        {suggestions.map((item) => (
          <motion.button
            key={item}
            type="button"
            onClick={() => onSearch(item)}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
          >
            {item}
          </motion.button>
        ))}
      </div>
    </section>
  )
}

function EmptyState({ title, caption, icon, action }: { title: string; caption: string; icon: ReactNode; action?: ReactNode }) {
  return (
    <motion.div className="apple-search-state" variants={itemMotion}>
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{caption}</p>
      {action}
    </motion.div>
  )
}

function LoadingRows({ type }: { type: SearchType }) {
  return (
    <div className="apple-search-list">
      {Array.from({ length: 7 }).map((_, index) => (
        <div className="apple-search-row apple-search-row--skeleton" key={index}>
          <div className={type === 'user' ? 'apple-search-avatar skeleton' : 'apple-search-cover skeleton'} />
          <div className="apple-search-row__main">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-meta" />
          </div>
          <div className="skeleton skeleton-time" />
        </div>
      ))}
    </div>
  )
}
