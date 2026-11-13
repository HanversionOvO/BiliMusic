export interface PlaybackPart {
  cid: number
  duration: number
}

export function timelineDuration(parts: readonly PlaybackPart[]): number {
  return parts.reduce((total, part) => total + part.duration, 0)
}

/** 把合集的全局时间换算成对应分 P 及分 P 内的时间。边界属于下一分 P。 */
export function locatePlaybackPosition(parts: readonly PlaybackPart[], progress: number) {
  const target = Math.min(Math.max(progress, 0), timelineDuration(parts))
  let offset = 0
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex]
    if (target < offset + part.duration || partIndex === parts.length - 1) {
      return { partIndex, offset, partProgress: target - offset }
    }
    offset += part.duration
  }
  return { partIndex: 0, offset: 0, partProgress: 0 }
}
