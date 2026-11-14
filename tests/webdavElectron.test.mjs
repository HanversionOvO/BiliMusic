import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const source = await fs.readFile(new URL('../electron/webdav.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText

async function desktop(fetch) {
  const handlers = new Map()
  const context = vm.createContext({ Buffer, Response })
  const config = { url: 'https://dav.example.test/dav/', username: 'test', password: 'plain:' + Buffer.from('test').toString('base64') }
  const dependencies = {
    electron: {
      app: { getPath: () => '/test' },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      net: { fetch }, safeStorage: { isEncryptionAvailable: () => false },
    },
    'node:path': { default: path },
    'node:fs': { default: { readFileSync: () => JSON.stringify(config) } },
  }
  const module = new vm.SourceTextModule(javascript, { context })
  await module.link(name => new vm.SyntheticModule(Object.keys(dependencies[name]), function () {
    for (const [key, value] of Object.entries(dependencies[name])) this.setExport(key, value)
  }, { context }))
  await module.evaluate()
  module.namespace.registerWebdavHandlers()
  return { get: () => handlers.get('webdav:get')(null, 'sync.json'), put: content => handlers.get('webdav:put')(null, 'sync.json', content) }
}

test('desktop first sync also recovers missing parent 409 before creating sync.json', async () => {
  let directory = false
  let remote = null
  const methods = []
  const api = await desktop(async (_url, request) => {
    methods.push(request.method)
    if (request.method === 'MKCOL') {
      const status = directory ? 405 : 201
      directory = true
      return new Response('', { status })
    }
    if (request.method === 'PUT') { remote = request.body; return new Response('', { status: 201 }) }
    return new Response(remote || '', { status: !directory ? 409 : remote === null ? 404 : 200 })
  })
  const initial = await api.get()
  assert.equal(initial.ok, true)
  assert.equal(initial.status, 404)
  assert.deepEqual(methods, ['GET', 'MKCOL', 'GET'])
  assert.equal((await api.put('{"playlists":[]}')).ok, true)
  assert.equal((await api.get()).content, '{"playlists":[]}')
})

test('desktop directory errors stop upload and keep the original status', async () => {
  const methods = []
  const api = await desktop(async (_url, request) => {
    methods.push(request.method)
    return new Response('', { status: 403 })
  })
  const result = await api.put('{}')
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
  assert.deepEqual(methods, ['MKCOL'])
})
