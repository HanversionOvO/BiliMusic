export interface MetadataCandidate {
  source: 'itunes'
  sourceId: string
  title: string
  artist: string
  album: string
  coverUrl: string
  duration: number
  releaseDate: string
  genre: string
  score: number
}

export async function searchTrackMetadata(
  title: string,
  artist: string,
  duration = 0,
): Promise<MetadataCandidate[]> {
  const api = window.electronAPI?.metadataApi
  if (!api) throw new Error('当前环境不支持自动补全')
  return api.search(title.trim(), artist.trim(), duration)
}
