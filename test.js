const test = require('brittle')
const { once } = require('bare-events')
const { Duplex } = require('bare-stream')
const fs = require('bare-fs')
const tls = require('.')

const cert = fs.readFileSync('test/fixtures/cert.crt')
const key = fs.readFileSync('test/fixtures/cert.key')

test('basic', async (t) => {
  t.plan(4)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

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
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  server
    .on('connect', () => t.pass('server handshake'))
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => t.pass('client handshake'))
    .on('close', () => t.pass('client closed'))
    .end()
})

test('destroy server socket on connect', async (t) => {
  t.plan(4)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  server
    .on('connect', () => {
      t.pass('server handshake')
      a.destroy(new Error('abort'))
    })
    .on('error', () => t.pass('server errored'))
    .on('close', () => t.pass('server closed'))
    .end()

  client.on('connect', () => t.pass('client handshake')).end()
})

test('destroy client socket on connect', async (t) => {
  t.plan(3)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  server.end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      b.destroy(new Error('abort'))
    })
    .on('error', () => t.pass('client errored'))
    .on('close', () => t.pass('client closed'))
    .end()
})

test('destroy client on data', async (t) => {
  t.plan(3)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  server.write('First')

  client
    .on('connect', () => {
      t.pass('client handshake')
    })
    .on('data', () => {
      client.destroy(new Error('abort'))
      server.write('Second')
    })
    .on('error', () => t.pass('client errored'))
    .on('close', () => t.pass('client closed'))
})

test('net server + client', async (t) => {
  t.plan(5)

  const server = tls.createServer(
    {
      cert,
      key
    },
    (socket) => {
      socket
        .on('data', (data) => {
          t.alike(data, Buffer.from('ping'), 'ping')
          socket.end('pong')
        })
        .on('close', () => t.pass('server closed'))
    }
  )

  server.listen()

  await once(server, 'listening')

  const client = tls.connect({ ...server.address(), ca: cert })

  client
    .on('data', (data) => t.alike(data, Buffer.from('pong'), 'pong'))
    .on('close', () => {
      t.pass('client closed')
      server.close(() => {
        t.pass('server stopped')
      })
    })
    .end('ping')
})

test('net connect to example.com', async (t) => {
  t.plan(2)

  const client = tls.connect({ port: 443, host: 'example.com' })

  client
    .on('connect', () => {
      t.pass('handshake succeeded')
      client.end()
    })
    .on('close', () => t.pass('client closed'))
})

test('underlying socket error before handshake', async (t) => {
  t.plan(2)

  const [a, b] = pipe()

  const client = new tls.Socket(b)

  client
    .on('error', (err) => t.is(err.message, 'connection failed'))
    .on('close', () => t.pass('client closed'))

  b.destroy(new Error('connection failed'))
})

test('underlying socket error before handshake, server', async (t) => {
  t.plan(2)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  server
    .on('error', (err) => t.is(err.message, 'connection failed'))
    .on('close', () => t.pass('server closed'))

  a.destroy(new Error('connection failed'))
})

test('alpn negotiation - h2', async (t) => {
  t.plan(6)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key,
    alpnProtocols: ['h2', 'http/1.1']
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2', 'http/1.1'],
    ca: cert
  })

  server
    .on('connect', () => {
      t.pass('server handshake')
      t.is(server.alpnProtocol, 'h2', 'server negotiated h2')
    })
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      t.is(client.alpnProtocol, 'h2', 'client negotiated h2')
    })
    .on('close', () => t.pass('client closed'))
    .end()
})

test('alpn negotiation - fallback to http/1.1', async (t) => {
  t.plan(6)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key,
    alpnProtocols: ['http/1.1']
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2', 'http/1.1'],
    ca: cert
  })

  server
    .on('connect', () => {
      t.pass('server handshake')
      t.is(server.alpnProtocol, 'http/1.1', 'server negotiated http/1.1')
    })
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      t.is(client.alpnProtocol, 'http/1.1', 'client negotiated http/1.1')
    })
    .on('close', () => t.pass('client closed'))
    .end()
})

test('alpn negotiation - no alpn configured', async (t) => {
  t.plan(6)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  server
    .on('connect', () => {
      t.pass('server handshake')
      t.is(server.alpnProtocol, null, 'server alpnProtocol is null')
    })
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      t.is(client.alpnProtocol, null, 'client alpnProtocol is null')
    })
    .on('close', () => t.pass('client closed'))
    .end()
})

test('alpn negotiation - no overlap', async (t) => {
  t.plan(6)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key,
    alpnProtocols: ['http/1.1']
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2'],
    ca: cert
  })

  server
    .on('connect', () => {
      t.pass('server handshake')
      t.is(server.alpnProtocol, null, 'server alpnProtocol is null on no overlap')
    })
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      t.is(client.alpnProtocol, null, 'client alpnProtocol is null on no overlap')
    })
    .on('close', () => t.pass('client closed'))
    .end()
})

test('alpn negotiation - client only', async (t) => {
  t.plan(6)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2', 'http/1.1'],
    ca: cert
  })

  server
    .on('connect', () => {
      t.pass('server handshake')
      t.is(server.alpnProtocol, null, 'server alpnProtocol is null')
    })
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      t.is(client.alpnProtocol, null, 'client alpnProtocol is null')
    })
    .on('close', () => t.pass('client closed'))
    .end()
})

test('alpn negotiation - server only', async (t) => {
  t.plan(6)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key,
    alpnProtocols: ['h2', 'http/1.1']
  })

  const client = new tls.Socket(b, { ca: cert })

  server
    .on('connect', () => {
      t.pass('server handshake')
      t.is(server.alpnProtocol, null, 'server alpnProtocol is null')
    })
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      t.is(client.alpnProtocol, null, 'client alpnProtocol is null')
    })
    .on('close', () => t.pass('client closed'))
    .end()
})

test('destroying tls socket destroys underlying socket', async (t) => {
  t.plan(2)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  b.on('close', () => t.pass('underlying socket closed'))

  client.on('connect', () => client.destroy()).on('close', () => t.pass('client closed'))

  server.end()
})

test('destroying tls socket waits for underlying socket to close', async (t) => {
  t.plan(2)

  const a = new Duplex({
    write(data, encoding, cb) {
      b.push(data)
      cb(null)
    }
  })

  const b = new Duplex({
    write(data, encoding, cb) {
      a.push(data)
      cb(null)
    },
    destroy(err, cb) {
      setTimeout(cb, 50, err)
    }
  })

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  b.on('close', () => {
    t.pass('underlying socket closed')
  })

  client
    .on('connect', () => client.destroy())
    .on('close', () => {
      t.pass('client closed')
    })

  server.end()
})

test('tls socket forwards errors from underlying socket during destroy', async (t) => {
  t.plan(2)

  const a = new Duplex({
    write(data, encoding, cb) {
      b.push(data)
      cb(null)
    },
    final(cb) {
      b.push(null)
      cb(null)
    }
  })

  const b = new Duplex({
    write(data, encoding, cb) {
      a.push(data)
      cb(null)
    },
    final(cb) {
      a.push(null)
      cb(null)
    },
    destroy(err, cb) {
      setTimeout(cb, 10, new Error('boom'))
    }
  })

  const server = new tls.Socket(a, {
    isServer: true,
    cert,
    key
  })

  const client = new tls.Socket(b, { ca: cert })

  client
    .on('error', (err) => t.is(err.message, 'boom', 'underlying error forwarded'))
    .on('close', () => t.pass('client closed'))
    .end()

  server.end()
})

test('invalid key should not crash the process', async (t) => {
  t.plan(1)

  const [a, b] = pipe()

  const socket = new tls.Socket(a, {
    isServer: true,
    cert,
    key: Buffer.from('not a valid PEM key')
  })

  socket.on('error', (err) => {
    t.pass(err.message)
  })

  a.destroy()
  b.destroy()
})

test('invalid cert should not crash the process', async (t) => {
  t.plan(1)

  const [a, b] = pipe()

  const socket = new tls.Socket(a, {
    isServer: true,
    cert: Buffer.from('not a valid PEM cert'),
    key
  })

  socket.on('error', (err) => {
    t.pass(err.message)
  })

  a.destroy()
  b.destroy()
})

function pipe() {
  const a = new Duplex({
    write(data, encoding, cb) {
      b.push(data)
      cb(null)
    },
    final(cb) {
      b.push(null)
      cb(null)
    }
  })

  const b = new Duplex({
    write(data, encoding, cb) {
      a.push(data)
      cb(null)
    },
    final(cb) {
      a.push(null)
      cb(null)
    }
  })

  return [a, b]
}
