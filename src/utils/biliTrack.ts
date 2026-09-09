import type { Track } from '@/types'
import type { VideoInfo, VideoPageInfo } from '@/services/api'

export function createBiliTrackId(bvid: string, cid?: string | number): string {
  return cid ? `bilibili:${bvid}:${cid}` : bvid
}

export function videoPageToTrack(video: VideoInfo, page: VideoPageInfo): Track {
  return {
    id: createBiliTrackId(video.bvid, page.cid),
    title: page.title || `${video.title} P${page.page}`,
    artist: video.ownerName,
    coverUrl: video.pic,
    duration: page.duration,
    videoUrl: `https://www.bilibili.com/video/${video.bvid}?p=${page.page}`,
    bvid: video.bvid,
    aid: video.aid,
    cid: page.cid,
    page: page.page,
    parentTitle: video.title,
    sourceType: 'video-part',
    playCount: video.stat?.view || 0,
    isLiked: false,
  }
}

export function videoInfoToTrack(video: VideoInfo): Track {
  const firstPage = video.pages?.[0]
  if (firstPage) return videoPageToTrack(video, firstPage)
  return {
    id: createBiliTrackId(video.bvid, video.cid),
    title: video.title,
    artist: video.ownerName,
    coverUrl: video.pic,
    duration: video.duration,
    videoUrl: `https://www.bilibili.com/video/${video.bvid}`,
    bvid: video.bvid,
    aid: video.aid,
    cid: video.cid || undefined,
    sourceType: 'video',
    playCount: video.stat?.view || 0,
    isLiked: false,
  }
}
