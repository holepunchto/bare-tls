const test = require('brittle')
const { Duplex } = require('bare-stream')
const fs = require('bare-fs')
const tls = require('.')

test('basic', async (t) => {
  t.plan(4)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

  server
    .on('data', (data) => {
      t.alike(data, Buffer.from('ping'), 'ping')
      server.end('pong')
    })
    .on('close', () => t.pass('server closed'))

  client
    .on('data', (data) => t.alike(data, Buffer.from('pong'), 'pong'))
    .on('close', () => t.pass('client closed'))
    .end('ping')
})

test('connect event', async (t) => {
  t.plan(4)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

  server
    .on('connect', () => t.pass('server handshake'))
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => t.pass('client handshake'))
    .on('close', () => t.pass('client closed'))
    .end()
})

function pipe () {
  const a = new Duplex({
    write (data, encoding, cb) {
      b.push(data)
      cb(null)
    }
  })

  const b = new Duplex({
    write (data, encoding, cb) {
      a.push(data)
      cb(null)
    }
  })

  return [a, b]
}
