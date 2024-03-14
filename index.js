/* global Bare */
const { Duplex } = require('streamx')
const binding = require('./binding')
const errors = require('./lib/errors')

const DEFAULT_READ_BUFFER = 65536

const constants = exports.constants = require('./lib/constants')

const context = binding.initContext()

exports.Socket = class TLSSocket extends Duplex {
  constructor (socket, opts = {}) {
    const {
      cert = null,
      key = null,
      allowHalfOpen = true,
      readBufferSize = DEFAULT_READ_BUFFER
    } = opts

    super({ mapWritable })

    this._pendingOpen = null

    this._state = 0
    this._buffer = Buffer.alloc(readBufferSize)
    this._reading = null

    this._socket = socket
    this._key = key
    this._cert = cert
    this._allowHalfOpen = allowHalfOpen

    this._handle = binding.init(context, this, this._onread, this._onwrite)

    if (cert) binding.useCertificate(this._handle, cert)
    if (key) binding.useKey(this._handle, key)
  }

  get socket () {
    return this._socket
  }

  connect () {
    if (this._state & constants.state.ACCEPT) {
      throw errors.ALREADY_ACCEPTED('Socket is already accepting connections')
    }

    if (this._state & constants.state.CONNECT) {
      throw errors.ALREADY_ACCEPTED('Socket is already connected')
    }

    binding.connect(this._handle)

    this._state |= constants.state.CONNECT
  }

  accept () {
    if (this._state & constants.state.ACCEPT) {
      throw errors.ALREADY_ACCEPTED('Socket is already accepting connections')
    }

    if (this._state & constants.state.CONNECT) {
      throw errors.ALREADY_ACCEPTED('Socket is already connected')
    }

    binding.accept(this._handle)

    this._state |= constants.state.ACCEPT
  }

  _continueOpen () {
    const done = binding.handshake(this._handle)

    if (done) {
      this._state |= constants.state.HANDSHAKE

      const cb = this._pendingOpen
      this._pendingOpen = null
      cb(null)
    }

    return done
  }

  _open (cb) {
    this._pendingOpen = cb

    this._socket.on('data', (data) => this._ondata(data))

    this._continueOpen()
  }

  _write (data, cb) {
    binding.write(this._handle, data)

    cb(null)
  }

  _final (cb) {
    binding.shutdown(this._handle)

    cb(null)
  }

  _destroy (cb) {
    binding.destroy(this._handle)

    cb(null)
  }

  _ondata (data) {
    this._reading = data

    if (this._state & constants.state.HANDSHAKE) {
      const length = binding.read(this._handle, this._buffer)

      if (length === 0) {
        this.push(null)
        if (this._allowHalfOpen === false) this.end()
        return
      }

      this.push(this._buffer.subarray(0, length))
    } else {
      this._continueOpen()
    }
  }

  _onread (data) {
    let buffer = this._reading

    if (buffer === null) return 0

    if (buffer.byteLength > data.byteLength) {
      const rest = buffer.subarray(data.byteLength)

      buffer = buffer.subarray(0, data.byteLength)

      this._reading = rest
    } else {
      this._reading = null
    }

    data.set(buffer)

    return buffer.byteLength
  }

  _onwrite (data) {
    this._socket.write(Buffer.from(data))

    return data.byteLength
  }
}

function mapWritable (data) {
  return typeof data === 'string' ? Buffer.from(data) : data
}

Bare.on('exit', () => binding.destroyContext(context))
