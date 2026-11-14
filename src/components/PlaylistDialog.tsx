import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * 歌单新建/编辑弹窗。
 * mode = 'create' 时创建；mode = 'edit' 时预填并保存修改。
 */
export default function PlaylistDialog({
  mode = 'create',
  initialName = '',
  initialDescription = '',
  onClose,
  onSubmit,
}: {
  mode?: 'create' | 'edit'
  initialName?: string
  initialDescription?: string
  onClose: () => void
  onSubmit: (input: { name: string; description?: string }) => void
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const trimmedName = name.trim()
  const isEdit = mode === 'edit'

  const submit = () => {
    if (!trimmedName) return
    onSubmit({ name: trimmedName, description: description.trim() || undefined })
  }

  return (
    <motion.div
      className="playlist-dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={onClose}
    >
      <motion.div
        className="playlist-dialog"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="playlist-dialog__head">
          <div>
            <p>{isEdit ? 'Edit Playlist' : 'New Playlist'}</p>
            <h2>{isEdit ? '编辑歌单' : '新建歌单'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <label className="playlist-field">
          <span>歌单名</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="例如：深夜循环"
            autoFocus
          />
        </label>

        <label className="playlist-field">
          <span>描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="可选，写一点这个歌单的氛围"
            rows={3}
          />
        </label>

        <div className="playlist-dialog__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" onClick={submit} disabled={!trimmedName}>
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
