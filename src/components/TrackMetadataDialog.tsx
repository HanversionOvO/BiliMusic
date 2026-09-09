import { AnimatePresence, motion } from 'framer-motion'
import { Check, Image, Loader2, Music, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { FavoriteMetadataPatch } from '@/utils/storage'
import type { Track } from '@/types'
import { searchTrackMetadata, type MetadataCandidate } from '@/services/metadata'

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
  const [candidates, setCandidates] = useState<MetadataCandidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataError, setMetadataError] = useState('')
  const metadataRequestRef = useRef(0)

  useEffect(() => {
    if (!track) return
    setTitle(track.title)
    setArtist(track.artist)
    setAlbum(track.album || '')
    setCoverUrl(track.coverUrl)
    setPreviewCoverUrl(track.coverUrl)
    setCandidates([])
    setSelectedCandidateId('')
    setMetadataLoading(false)
    setMetadataError('')
    metadataRequestRef.current += 1
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
    if (!title.trim()) return
    onSave({ title, artist, album, coverUrl })
  }

  const applyCandidate = (candidate: MetadataCandidate) => {
    if (candidate.album) setAlbum(candidate.album)
    if (candidate.coverUrl) setCoverUrl(candidate.coverUrl)
    setSelectedCandidateId(candidate.sourceId)
    setMetadataError('')
  }

  const autoFillMetadata = async () => {
    const normalizedTitle = title.trim()
    const normalizedArtist = artist.trim()
    if (!normalizedTitle || !normalizedArtist || !track) {
      setMetadataError('请先填写歌曲名称和歌手')
      return
    }

    const requestId = ++metadataRequestRef.current
    setMetadataLoading(true)
    setMetadataError('')
    setCandidates([])
    setSelectedCandidateId('')
    try {
      const matches = await searchTrackMetadata(normalizedTitle, normalizedArtist, track.duration)
      if (requestId !== metadataRequestRef.current) return
      setCandidates(matches)
      if (matches.length > 0) {
        applyCandidate(matches[0])
      } else {
        setMetadataError('没有找到匹配的专辑信息')
      }
    } catch (error) {
      if (requestId !== metadataRequestRef.current) return
      setMetadataError(error instanceof Error ? error.message : '自动补全失败，请稍后重试')
    } finally {
      if (requestId === metadataRequestRef.current) setMetadataLoading(false)
    }
  }

  const updateTitle = (value: string) => {
    setTitle(value)
    setCandidates([])
    setSelectedCandidateId('')
    setMetadataError('')
  }

  const updateArtist = (value: string) => {
    setArtist(value)
    setCandidates([])
    setSelectedCandidateId('')
    setMetadataError('')
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
              <span><strong>{title || '歌曲名称'}</strong><small>{artist || '歌手未知'}{album ? ` · ${album}` : ''}</small></span>
            </div>

            <label className="playlist-field"><span>歌曲名称</span><input autoFocus value={title} onChange={e => updateTitle(e.target.value)} /></label>
            <label className="playlist-field"><span>歌手（可选）</span><input value={artist} onChange={e => updateArtist(e.target.value)} /></label>

            <button
              type="button"
              className="metadata-autofill-button"
              onClick={autoFillMetadata}
              disabled={metadataLoading || !title.trim() || !artist.trim()}
              title={!title.trim() || !artist.trim() ? '请先填写歌曲名称和歌手' : '搜索并补充专辑与封面'}
            >
              {metadataLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              {metadataLoading ? '正在匹配…' : '自动补充专辑与封面'}
            </button>

            {metadataError && <div className="metadata-autofill-error">{metadataError}</div>}

            {candidates.length > 0 && (
              <div className="metadata-candidates" aria-label="专辑匹配候选">
                {candidates.map(candidate => {
                  const selected = selectedCandidateId === candidate.sourceId
                  return (
                    <button
                      key={candidate.sourceId}
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      onClick={() => applyCandidate(candidate)}
                    >
                      <span className="metadata-candidate__cover">
                        {candidate.coverUrl ? <img src={candidate.coverUrl} alt="" loading="lazy" /> : <Music size={17} />}
                      </span>
                      <span className="metadata-candidate__info">
                        <strong>{candidate.album}</strong>
                        <small>{candidate.title} · {candidate.artist}</small>
                      </span>
                      <span className="metadata-candidate__score">
                        {selected ? <Check size={14} /> : `${Math.round(candidate.score * 100)}%`}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <label className="playlist-field"><span>专辑（可选）</span><input value={album} onChange={e => setAlbum(e.target.value)} /></label>
            <label className="playlist-field"><span>封面图片地址（可选）</span><input type="url" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." /></label>

            <div className="metadata-dialog__source"><Music size={13} />UP 主：{track.uploaderName || '未知'}；播放来源与分 P 定位信息不会被修改</div>
            <div className="playlist-dialog__actions">
              <button type="button" onClick={onClose}>取消</button>
              <button type="submit" disabled={!title.trim()}>保存修改</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
