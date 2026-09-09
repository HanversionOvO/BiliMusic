import type { Track } from '@/types'
import type { VideoInfo, VideoPageInfo } from '@/services/api'
import { inferArtistFromTitle } from '@/utils/trackMetadata'

export function createBiliTrackId(bvid: string): string {
  return `bilibili:video:${bvid}:p1`
}

export function createBiliVideoTrackId(bvid: string, page = 1): string {
  return `bilibili:video:${bvid}:p${page}`
}

export function createBiliMusicTrackId(aid: string | number, cid: string | number): string {
  return `bilibili:music:${aid}:${cid}`
}

export function videoPageToTrack(video: VideoInfo, page: VideoPageInfo): Track {
  return {
    id: createBiliVideoTrackId(video.bvid, page.page),
    title: page.title || `${video.title} P${page.page}`,
    artist: inferArtistFromTitle(page.title || video.title),
    uploaderName: video.ownerName,
    uploaderMid: video.ownerMid,
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
    id: createBiliTrackId(video.bvid),
    title: video.title,
    artist: inferArtistFromTitle(video.title),
    uploaderName: video.ownerName,
    uploaderMid: video.ownerMid,
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
