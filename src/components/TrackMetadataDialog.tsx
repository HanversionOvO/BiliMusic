import { AnimatePresence, motion } from 'framer-motion'
import { Image, Music, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { FavoriteMetadataPatch } from '@/utils/storage'
import type { Track } from '@/types'

export default function TrackMetadataDialog({ track, onClose, onSave }: {
  track: Track | null
  onClose: () => void
  onSave: (patch: FavoriteMetadataPatch) => void
}) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [previewCoverUrl, setPreviewCoverUrl] = useState('')

  useEffect(() => {
    if (!track) return
    setTitle(track.title)
    setArtist(track.artist)
    setAlbum(track.album || '')
    setCoverUrl(track.coverUrl)
    setPreviewCoverUrl(track.coverUrl)
  }, [track])

  // 避免编辑 URL 时每个按键都触发一次图片请求和解码。
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewCoverUrl(coverUrl.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [coverUrl])

  useEffect(() => {
    if (!track) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, track])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !artist.trim()) return
    onSave({ title, artist, album, coverUrl })
  }

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          className="playlist-dialog-backdrop metadata-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: 'linear' }}
          onMouseDown={onClose}
        >
          <motion.form
            className="playlist-dialog metadata-dialog"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            onSubmit={submit}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="playlist-dialog__head">
              <div><p>Metadata</p><h2>编辑歌曲信息</h2></div>
              <button type="button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
            </div>

            <div className="metadata-dialog__preview">
              <div>{previewCoverUrl ? <img src={previewCoverUrl} alt="封面预览" /> : <Image size={26} />}</div>
              <span><strong>{title || '歌曲名称'}</strong><small>{artist || '歌手'}{album ? ` · ${album}` : ''}</small></span>
            </div>

            <label className="playlist-field"><span>歌曲名称</span><input autoFocus value={title} onChange={e => setTitle(e.target.value)} /></label>
            <label className="playlist-field"><span>歌手</span><input value={artist} onChange={e => setArtist(e.target.value)} /></label>
            <label className="playlist-field"><span>专辑（可选）</span><input value={album} onChange={e => setAlbum(e.target.value)} /></label>
            <label className="playlist-field"><span>封面图片地址（可选）</span><input type="url" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." /></label>

            <div className="metadata-dialog__source"><Music size={13} />播放来源与分 P 定位信息不会被修改</div>
            <div className="playlist-dialog__actions">
              <button type="button" onClick={onClose}>取消</button>
              <button type="submit" disabled={!title.trim() || !artist.trim()}>保存修改</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
