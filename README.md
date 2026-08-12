# bare-tls

Transport Layer Security (TLS) streams for JavaScript, built on BoringSSL. Provides both a low-level `Socket` class that wraps any duplex stream with TLS and higher-level `createServer()` and `connect()` functions for TLS over TCP, similar to `node:tls`. Mozilla root certificates are bundled for out-of-the-box certificate verification.

```
npm i bare-tls
```

## Usage

```js
const tls = require('bare-tls')
const fs = require('bare-fs')

const server = tls.createServer(
  {
    cert: fs.readFileSync('cert.pem'),
    key: fs.readFileSync('key.pem')
  },
  (socket) => {
    socket.on('data', (data) => socket.end('pong')).on('close', () => server.close())
  }
)

server.listen(8443)

const client = tls.connect({ port: 8443, host: 'localhost' })

client.on('data', (data) => console.log(data)).end('ping')
```

## API

See the [full API reference](https://docs.pears.com/reference/bare/modules/bare-tls).

## License

Apache-2.0
