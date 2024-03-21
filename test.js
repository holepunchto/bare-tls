const test = require('brittle')
const { Duplex } = require('streamx')
const fs = require('bare-fs')
const tls = require('.')

test('basic', async (t) => {
  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

  const l = t.test('write + read')
  l.plan(2)

  server
    .on('data', (data) => l.alike(data, Buffer.from('hello')))
    .on('close', () => l.pass('closed'))
    .end()

  client.end('hello')

  await l

  server.destroy()
  client.destroy()
})

test('connect event', async (t) => {
  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

  const l = t.test('handshake')
  l.plan(2)

  server.on('connect', () => l.pass('server handshake'))
  client.on('connect', () => l.pass('client handshake'))

  await l

  server.destroy()
  client.destroy()
})

function pipe () {
  const a = new Duplex({
    write (data, cb) {
      b.push(data)
      cb(null)
    }
  })

  const b = new Duplex({
    write (data, cb) {
      a.push(data)
      cb(null)
    }
  })

  return [a, b]
}
