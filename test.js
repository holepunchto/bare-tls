const test = require('brittle')
const { once } = require('bare-events')
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

test('destroy server socket on connect', async (t) => {
  t.plan(4)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

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
      cert: fs.readFileSync('test/fixtures/cert.crt'),
      key: fs.readFileSync('test/fixtures/cert.key')
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

  const client = tls.connect(server.address())

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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key'),
    alpnProtocols: ['h2', 'http/1.1']
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2', 'http/1.1']
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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key'),
    alpnProtocols: ['http/1.1']
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2', 'http/1.1']
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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b)

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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key'),
    alpnProtocols: ['http/1.1']
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2']
  })

  server
    .on('connect', () => {
      t.pass('server handshake')
      t.is(
        server.alpnProtocol,
        null,
        'server alpnProtocol is null on no overlap'
      )
    })
    .on('close', () => t.pass('server closed'))
    .end()

  client
    .on('connect', () => {
      t.pass('client handshake')
      t.is(
        client.alpnProtocol,
        null,
        'client alpnProtocol is null on no overlap'
      )
    })
    .on('close', () => t.pass('client closed'))
    .end()
})

test('alpn negotiation - client only', async (t) => {
  t.plan(6)

  const [a, b] = pipe()

  const server = new tls.Socket(a, {
    isServer: true,
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  const client = new tls.Socket(b, {
    alpnProtocols: ['h2', 'http/1.1']
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
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key'),
    alpnProtocols: ['h2', 'http/1.1']
  })

  const client = new tls.Socket(b)

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

function pipe() {
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
    }
  })

  return [a, b]
}
