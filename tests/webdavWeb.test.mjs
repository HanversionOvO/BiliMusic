import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const source = await fs.readFile(new URL('../src/utils/webdavWeb.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText

async function transport(request, { native = true, fetch } = {}) {
  const storage = new Map()
  const context = vm.createContext({
    TextEncoder, Response, AbortController, setTimeout, clearTimeout, btoa,
    window: {},
    fetch: fetch || (() => { throw new Error('Android must not use browser fetch') }),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  })
  const sdk = new vm.SyntheticModule(['Capacitor', 'registerPlugin'], function () {
    this.setExport('Capacitor', { isNativePlatform: () => native, getPlatform: () => native ? 'android' : 'web' })
    this.setExport('registerPlugin', name => {
      assert.equal(name, 'Webdav')
      return { request }
    })
  }, { context })
  const module = new vm.SourceTextModule(javascript, { context })
  await module.link(() => sdk)
  await module.evaluate()
  await module.namespace.webdavConfigure({ url: 'https://dav.example.test/dav/', username: '用户', password: '应用密码' })
  return module.namespace
}

test('Android test uses native PROPFIND without CORS and supports UTF-8 credentials', async () => {
  const api = await transport(async request => {
    assert.equal(request.method, 'PROPFIND')
    assert.equal(request.headers.Depth, '0')
    assert.equal(request.headers.Authorization, 'Basic ' + Buffer.from('用户:应用密码').toString('base64'))
    return { status: 207, headers: {}, body: '<d:multistatus/>' }
  })
  const result = await api.webdavTest()
  assert.equal(result.ok, true)
  assert.equal(result.message, '连接成功')
})

test('authentication, permission and server failures are reported as failures', async () => {
  for (const status of [401, 403, 404, 500]) {
    const api = await transport(async () => ({ status, headers: {}, body: '' }))
    const result = await api.webdavTest()
    assert.equal(result.ok, false, `HTTP ${status}`)
    assert.match(result.message, status === 401 ? /认证失败/ : status === 403 ? /访问被拒绝/ : new RegExp(String(status)))
  }
})

test('Android sync preserves directory creation, Unicode JSON, ETag and 412 conflict', async () => {
  const calls = []
  const content = '{"name":"安卓歌单 🎵"}'
  const api = await transport(async request => {
    calls.push(request)
    if (request.method === 'MKCOL') return { status: 405, headers: {}, body: '' }
    if (request.method === 'GET') return { status: 200, headers: { etag: '"v1"' }, body: content }
    return { status: request.headers['If-Match'] === '"stale"' ? 412 : 204, headers: { etag: '"v2"' }, body: '' }
  })
  const get = await api.webdavGet('sync.json')
  assert.equal(get.content, content)
  assert.equal(get.etag, '"v1"')
  const put = await api.webdavPut('sync.json', content, get.etag)
  assert.equal(put.ok, true)
  assert.equal(put.etag, '"v2"')
  assert.equal(calls[1].method, 'MKCOL')
  assert.equal(calls[1].url, 'https://dav.example.test/dav/bilimusic/')
  assert.equal(calls[2].headers['If-Match'], '"v1"')
  assert.equal(calls[2].body, content)
  const conflict = await api.webdavPut('sync.json', content, '"stale"')
  assert.equal(conflict.ok, false)
  assert.equal(conflict.status, 412)
})

test('ordinary browsers retain fetch and PROPFIND-unsupported servers can use GET', async () => {
  const methods = []
  const api = await transport(() => { throw new Error('Browser must not call native plugin') }, {
    native: false,
    fetch: async (_url, request) => {
      methods.push(request.method)
      return new Response('', { status: request.method === 'PROPFIND' ? 405 : 200 })
    },
  })
  assert.equal((await api.webdavTest()).ok, true)
  assert.deepEqual(methods, ['PROPFIND', 'GET'])
})

test('first sync recovers Jianguoyun GET 409 before a directory exists, then writes and reads data', async () => {
  let directory = false
  let remote = null
  const methods = []
  const api = await transport(async request => {
    methods.push(request.method)
    if (request.method === 'MKCOL') {
      const status = directory ? 405 : 201
      directory = true
      return { status, headers: {}, body: '' }
    }
    if (request.method === 'PUT') {
      assert.equal(directory, true)
      remote = request.body
      return { status: 201, headers: { etag: '"created"' }, body: '' }
    }
    return { status: !directory ? 409 : remote === null ? 404 : 200, headers: {}, body: remote || '' }
  })
  const initial = await api.webdavGet('sync.json')
  assert.equal(initial.ok, true)
  assert.equal(initial.status, 404)
  assert.deepEqual(methods, ['GET', 'MKCOL', 'GET'])
  const content = '{"favorites":[],"playlists":[{"name":"首次同步"}]}'
  assert.equal((await api.webdavPut('sync.json', content)).ok, true)
  assert.equal((await api.webdavGet('sync.json')).content, content)
})

test('directory creation errors preserve status and prevent reads or writes from continuing', async () => {
  for (const status of [401, 403, 409, 500]) {
    const calls = []
    const api = await transport(async request => {
      calls.push(request.method)
      return { status: request.method === 'GET' ? 409 : status, headers: {}, body: '' }
    })
    const get = await api.webdavGet('sync.json')
    assert.equal(get.ok, false)
    assert.equal(get.status, status)
    assert.deepEqual(calls, ['GET', 'MKCOL'])
    calls.length = 0
    const put = await api.webdavPut('sync.json', '{}')
    assert.equal(put.ok, false)
    assert.equal(put.status, status)
    assert.deepEqual(calls, ['MKCOL'])
  }
})

test('a persistent 409 is not treated as an empty cloud library', async () => {
  const calls = []
  const api = await transport(async request => {
    calls.push(request.method)
    return { status: request.method === 'MKCOL' ? 405 : 409, headers: {}, body: '' }
  })
  const result = await api.webdavGet('sync.json')
  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
  assert.deepEqual(calls, ['GET', 'MKCOL', 'GET'])
})
