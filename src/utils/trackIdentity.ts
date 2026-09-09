import type { Track } from '@/types'

type TrackIdentityFields = Pick<Track, 'id' | 'bvid' | 'aid' | 'cid' | 'page' | 'sourceType'>

/**
 * A track's identity must only depend on immutable Bilibili source fields.
 * Video tracks use BVID + page so an unresolved search result and its resolved
 * P1 audio source keep the same identity. Music-center tracks use AID + CID.
 */
export function getTrackId(track: TrackIdentityFields): string {
  if (track.sourceType === 'music' && track.aid && track.cid) {
    return `bilibili:music:${track.aid}:${track.cid}`
  }

  if (track.bvid) {
    return `bilibili:video:${track.bvid}:p${track.page || 1}`
  }

  if (track.aid && track.cid) {
    return `bilibili:source:${track.aid}:${track.cid}`
  }

  return track.id
}

export function withTrackIdentity(track: Track): Track {
  const id = getTrackId(track)
  return id === track.id ? track : { ...track, id }
}

export function isSameTrack(
  left: TrackIdentityFields | null | undefined,
  right: TrackIdentityFields | null | undefined,
): boolean {
  return Boolean(left && right && getTrackId(left) === getTrackId(right))
}

export function includesTrack(tracks: Track[], target: TrackIdentityFields): boolean {
  return tracks.some(track => isSameTrack(track, target))
}

export function uniqueTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>()
  return tracks.reduce<Track[]>((result, item) => {
    const track = withTrackIdentity(item)
    if (seen.has(track.id)) return result
    seen.add(track.id)
    result.push(track)
    return result
  }, [])
}
