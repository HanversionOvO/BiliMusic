import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CheckSquare, ListMusic, Music, Pencil, Play, Plus, Square, Trash2, X } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import AddToPlaylistButton from '@/components/AddToPlaylistButton'
import PlaylistDialog from '@/components/PlaylistDialog'
import { isMobilePlatform } from '@/hooks/useIsMobile'
import {
  EmptyLibrary,
  MusicHero,
  MusicPageShell,
  MusicSection,
  TrackList,
  TrackListRow,
} from '@/components/AppleMusicPage'
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  loadPlaylists,
  PLAYLISTS_CHANGED_EVENT,
  removeTracksFromPlaylist,
  updatePlaylist,
} from '@/utils/storage'
import type { Playlist } from '@/types'

export default function Playlists() {
  const { playlistId } = useParams()
  return playlistId ? <PlaylistDetail playlistId={playlistId} /> : <PlaylistOverview />
}

function PlaylistOverview() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists())
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const sync = () => setPlaylists(loadPlaylists())
    window.addEventListener(PLAYLISTS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PLAYLISTS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const heroImage = playlists.find(p => p.coverUrl)?.coverUrl
  const mobile = isMobilePlatform()

  const handleCreate = (input: { name: string; description?: string }) => {
    const playlist = createPlaylist(input)
    setCreating(false)
    navigate(`/playlists/${playlist.id}`)
  }

  const createAction = (
    <button className="am-action am-action--primary" onClick={() => setCreating(true)}>
      <Plus size={15} />
      新建歌单
    </button>
  )

  return (
    <MusicPageShell>
      {!mobile && (
        <MusicHero
          eyebrow="All Playlists"
          title="所有歌单"
          subtitle={playlists.length ? `你创建了 ${playlists.length} 个歌单。` : '点击右侧 +，创建第一个歌单。'}
          image={heroImage}
          tone="purple"
          action={createAction}
        />
      )}

      {playlists.length === 0 ? (
        <EmptyLibrary
          icon={<ListMusic size={40} />}
          title="还没有歌单"
          subtitle={mobile ? '点击右上角 +，创建第一个歌单。' : '新建歌单后，会立即显示在这里。'}
          action={mobile ? createAction : undefined}
        />
      ) : (
        <MusicSection title="我的歌单" icon={<ListMusic size={22} />} action={mobile ? createAction : undefined}>
          <div className="playlist-grid">
            {playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </MusicSection>
      )}

      <AnimatePresence>
        {creating && (
          <PlaylistDialog
            onClose={() => setCreating(false)}
            onSubmit={handleCreate}
          />
        )}
      </AnimatePresence>
    </MusicPageShell>
  )
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const cover = playlist.coverUrl || playlist.tracks[0]?.coverUrl
  return (
    <Link to={`/playlists/${playlist.id}`} className="playlist-card">
      <div className="playlist-card__cover">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <Music size={34} />}
      </div>
      <div className="playlist-card__body">
        <h3>{playlist.name}</h3>
        <p>{playlist.tracks.length} 首歌曲</p>
        {playlist.description && <span>{playlist.description}</span>}
      </div>
    </Link>
  )
}

function PlaylistDetail({ playlistId }: { playlistId: string }) {
  const [playlist, setPlaylist] = useState<Playlist | null>(() => getPlaylist(playlistId))
  const [editing, setEditing] = useState(false)
  const [metaEditing, setMetaEditing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const player = usePlayer()
  const navigate = useNavigate()

  useEffect(() => {
    const sync = () => setPlaylist(getPlaylist(playlistId))
    sync()
    window.addEventListener(PLAYLISTS_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PLAYLISTS_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [playlistId])

  const tracks = playlist?.tracks || []
  const heroImage = playlist?.coverUrl || tracks[0]?.coverUrl
  const mobile = isMobilePlatform()
  const updatedText = useMemo(() => {
    if (!playlist?.updatedAt) return ''
    return new Date(playlist.updatedAt).toLocaleDateString()
  }, [playlist?.updatedAt])

  if (!playlist) {
    return (
      <MusicPageShell>
        <EmptyLibrary icon={<ListMusic size={40} />} title="歌单不存在" subtitle="这个歌单可能已经被删除。" />
      </MusicPageShell>
    )
  }

  const handleDelete = () => {
    deletePlaylist(playlist.id)
    navigate('/playlists')
  }

  const handleSaveMeta = (input: { name: string; description?: string }) => {
    const updated = { ...playlist, name: input.name, description: input.description, updatedAt: new Date().toISOString() }
    updatePlaylist(updated)
    setPlaylist(updated)
    setMetaEditing(false)
  }

  const removeSelected = () => {
    if (selectedIds.size === 0) return
    const updated = removeTracksFromPlaylist(playlist.id, [...selectedIds])
    setPlaylist(updated)
    setSelectedIds(new Set())
    setEditing(false)
  }

  const removeOne = (trackId: string) => {
    const updated = removeTracksFromPlaylist(playlist.id, [trackId])
    setPlaylist(updated)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(trackId)
      return next
    })
  }

  const toggleSelected = (trackId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })
  }

  const allSelected = tracks.length > 0 && selectedIds.size === tracks.length
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(tracks.map(track => track.id)))
  }

  const toggleEditing = () => {
    setEditing(prev => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
  }

  const playAllAction = tracks.length > 0 && (
    <button className="am-action am-action--primary" onClick={() => player.playAll(tracks)}>
      <Play size={15} fill="currentColor" />
      播放全部
    </button>
  )

  return (
    <MusicPageShell>
      {!mobile && (
        <MusicHero
          eyebrow="Playlist"
          title={playlist.name}
          subtitle={playlist.description || `${tracks.length} 首歌曲${updatedText ? ` · 更新于 ${updatedText}` : ''}`}
          image={heroImage}
          tone="purple"
          action={(
            <>
              {playAllAction}
              <button className="am-action am-action--subtle" onClick={() => setMetaEditing(true)}>
                <Pencil size={16} />
                编辑歌单
              </button>
              <button className="am-action am-action--subtle" onClick={handleDelete}>
                <Trash2 size={16} />
                删除歌单
              </button>
            </>
          )}
        />
      )}

      {mobile && (
        <div className="playlist-detail-head">
          <h1>{playlist.name}</h1>
          <button type="button" className="playlist-detail-head__icon" onClick={() => setMetaEditing(true)} title="编辑歌单">
            <Pencil size={17} />
          </button>
          <button type="button" className="playlist-detail-head__icon playlist-detail-head__icon--danger" onClick={handleDelete} title="删除歌单">
            <Trash2 size={17} />
          </button>
        </div>
      )}

      {tracks.length === 0 ? (
        <EmptyLibrary icon={<Music size={40} />} title="歌单是空的" subtitle="歌单已经创建并持久化保存，后续可以把歌曲加入到这里。" />
      ) : (
        <MusicSection title="歌曲" icon={<Music size={22} />} action={mobile ? playAllAction : undefined}>
          <div className={`playlist-editbar ${editing ? 'is-editing' : ''}`}>
            <div>
              <span>{editing ? `已选择 ${selectedIds.size} 首` : `${tracks.length} 首歌曲`}</span>
            </div>
            {editing && (
              <button type="button" onClick={toggleAll}>
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                {allSelected ? '取消全选' : '全选'}
              </button>
            )}
            {editing && selectedIds.size > 0 && (
              <button type="button" className="playlist-editbar__danger" onClick={removeSelected}>
                <Trash2 size={16} />
                移出歌单
              </button>
            )}
            <button type="button" className="playlist-editbar__primary" onClick={toggleEditing}>
              {editing ? '完成' : '选择'}
            </button>
          </div>
          <TrackList>
            {tracks.map((track, index) => (
              <TrackListRow
                key={track.id + String(index)}
                track={track}
                index={index + 1}
                isCurrent={player.currentTrack?.id === track.id}
                isPlaying={player.isPlaying}
                onPlay={() => editing ? toggleSelected(track.id) : player.playNow(track)}
                leading={editing ? (
                  <button
                    type="button"
                    className={`playlist-select-button ${selectedIds.has(track.id) ? 'is-selected' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleSelected(track.id) }}
                    title={selectedIds.has(track.id) ? '取消选择' : '选择'}
                  >
                    {selectedIds.has(track.id) ? <CheckSquare size={17} /> : <Square size={17} />}
                  </button>
                ) : undefined}
                extra={(
                  <div className="am-extra-actions">
                    <AddToPlaylistButton track={track} size={15} />
                    {!editing && (
                      <button className="am-icon-danger" onClick={(e) => { e.stopPropagation(); removeOne(track.id) }} title="移出歌单">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
              />
            ))}
          </TrackList>
        </MusicSection>
      )}

      <AnimatePresence>
        {metaEditing && (
          <PlaylistDialog
            mode="edit"
            initialName={playlist.name}
            initialDescription={playlist.description || ''}
            onClose={() => setMetaEditing(false)}
            onSubmit={handleSaveMeta}
          />
        )}
      </AnimatePresence>
    </MusicPageShell>
  )
}
