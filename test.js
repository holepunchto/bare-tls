const test = require('brittle')
const { Duplex } = require('streamx')
const fs = require('bare-fs')
const tls = require('.')

test('server + client', async (t) => {
  const serverSocket = new Duplex({
    write (data, cb) {
      clientSocket.push(data)
      cb(null)
    }
  })

  const clientSocket = new Duplex({
    write (data, cb) {
      serverSocket.push(data)
      cb(null)
    }
  })

  const server = new tls.Socket(serverSocket, {
    cert: fs.readFileSync('test/fixtures/cert.crt'),
    key: fs.readFileSync('test/fixtures/cert.key')
  })

  server.accept()

  const client = new tls.Socket(clientSocket)

  client.connect()

  const l = t.test('write + read')
  l.plan(1)

  server.on('data', (data) => l.alike(data, Buffer.from('hello')))

  client.write('hello')

  await l

  server.destroy()
  client.destroy()
})
