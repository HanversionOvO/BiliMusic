import assert from 'node:assert/strict'
import test from 'node:test'
import { locatePlaybackPosition, timelineDuration } from '../src/utils/playbackTimeline.ts'

// BV1q4FTeBEMj 的前三个分 P。合集时间不能直接作为单个音频的 currentTime。
const parts = [
  { cid: 28139389900, duration: 228 },
  { cid: 28139390958, duration: 270 },
  { cid: 28139392587, duration: 224 },
]

test('合集跳转超过第一首时，定位到下一首的局部时间', () => {
  assert.equal(timelineDuration(parts), 722)
  assert.deepEqual(locatePlaybackPosition(parts, 350), { partIndex: 1, offset: 228, partProgress: 122 })
})

test('分 P 边界从下一首的开头播放', () => {
  assert.deepEqual(locatePlaybackPosition(parts, 228), { partIndex: 1, offset: 228, partProgress: 0 })
  assert.deepEqual(locatePlaybackPosition(parts, 498), { partIndex: 2, offset: 498, partProgress: 0 })
})

test('合集首尾与单音轨的时间不会越界', () => {
  assert.deepEqual(locatePlaybackPosition(parts, -10), { partIndex: 0, offset: 0, partProgress: 0 })
  assert.deepEqual(locatePlaybackPosition(parts, 900), { partIndex: 2, offset: 498, partProgress: 224 })
  assert.deepEqual(locatePlaybackPosition([parts[0]], 121), { partIndex: 0, offset: 0, partProgress: 121 })
})
