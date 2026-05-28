import { Download } from 'lucide-react'

export default function Downloads() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2xl)',
        gap: 'var(--space-md)',
        color: 'var(--color-muted)',
      }}
    >
      <Download size={48} strokeWidth={1} />
      <h2 className="text-h2">本地下载</h2>
      <p className="text-caption">下载到本地的音乐文件</p>
    </div>
  )
}