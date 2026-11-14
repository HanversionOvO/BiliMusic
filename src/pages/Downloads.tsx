import { Download, Music } from 'lucide-react'
import { isMobilePlatform } from '@/hooks/useIsMobile'
import {
  ActionButton,
  EmptyLibrary,
  MusicHero,
  MusicPageShell,
  MusicSection,
} from '@/components/AppleMusicPage'

export default function Downloads() {
  return (
    <MusicPageShell>
      {!isMobilePlatform() && (
        <MusicHero
          eyebrow="Downloads"
          title="本地下载"
          subtitle="离线音乐会整齐地收在这里，像 Apple Music 资料库一样干净。"
          tone="blue"
          action={(
            <ActionButton tone="subtle">
              打开目录
            </ActionButton>
          )}
        />
      )}

      <MusicSection title="下载列表" icon={<Music size={22} />}>
        <div className="download-empty-shell">
          <EmptyLibrary
            icon={<Download size={40} />}
            title="还没有本地音乐"
            subtitle="完成下载后，歌曲会显示在这里。"
          />
        </div>
      </MusicSection>
    </MusicPageShell>
  )
}
