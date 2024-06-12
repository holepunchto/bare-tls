/* global Bare */
const { Duplex } = require('bare-stream')
const binding = require('./binding')
const constants = require('./lib/constants')
const errors = require('./lib/errors')

const readBufferSize = 65536

const context = binding.initContext()

exports.Socket = class TLSSocket extends Duplex {
  static _buffer = Buffer.alloc(readBufferSize)

  constructor (socket, opts = {}) {
    const {
      isServer = false,
      cert = null,
      key = null,
      eagerOpen = true,
      allowHalfOpen = true
    } = opts

    super({ eagerOpen })

    this._state = 0

    this._socket = socket
    this._key = key
    this._cert = cert
    this._allowHalfOpen = allowHalfOpen

    this._pendingOpen = null
    this._pendingWrite = null

    this._buffer = null

    this._handle = binding.init(context, isServer, cert, key, this,
      this._onread,
      this._onwrite
    )

    TLSSocket._sockets.add(this)
  }

  get socket () {
    return this._socket
  }

  get encrypted () {
    return true
  }

  _onconnect () {
    this._state |= constants.state.HANDSHAKE

    this.emit('connect')

    const cb = this._pendingOpen
    this._pendingOpen = null
    cb(null)
  }

  _ondata (data) {
    if (this._buffer !== null) {
      this._buffer = Buffer.concat([this._buffer, data])
    } else {
      this._buffer = data
    }

    while (this._buffer !== null) {
      if (this._state & constants.state.HANDSHAKE) {
        let read
        try {
          read = binding.read(this._handle, TLSSocket._buffer)
        } catch (err) {
          return this.destroy(errors.from(err))
        }

        if (read < 0) break

        if (read === 0) {
          this.push(null)
          if (this._allowHalfOpen === false) this.end()
          return
        }

        const copy = Buffer.allocUnsafe(read)
        copy.set(TLSSocket._buffer.subarray(0, read))

        this.push(copy)
      } else {
        try {
          if (binding.handshake(this._handle)) this._onconnect()
          else break
        } catch (err) {
          err = errors.from(err)
          if (this._pendingOpen) this._pendingOpen(err)
          else this.destroy(err)
          return
        }
      }
    }
  }

  _ondrain () {
    const cb = this._pendingWrite
    this._pendingWrite = null
    if (cb) cb(null)
  }

  _onend () {
    this.push(null)
  }

  _onclose () {
    this.destroy()
  }

  _onread (data) {
    let buffer = this._buffer
    if (buffer === null) return 0

    if (buffer.byteLength > data.byteLength) {
      const rest = buffer.subarray(data.byteLength)
      buffer = buffer.subarray(0, data.byteLength)
      this._buffer = rest
    } else {
      this._buffer = null
    }

    data.set(buffer)

    return buffer.byteLength
  }

  _onwrite (data) {
    data = Buffer.from(data)

    if (this._socket.write(data)) this._pendingWrite = null

    return data.byteLength
  }

  _open (cb) {
    this._pendingOpen = cb

    this._socket
      .on('data', this._ondata.bind(this))
      .on('drain', this._ondrain.bind(this))
      .on('end', this._onend.bind(this))
      .on('close', this._onclose.bind(this))

    try {
      if (binding.handshake(this._handle)) this._onconnect()
    } catch (err) {
      this._pendingOpen = null

      cb(errors.from(err))
    }
  }

  _write (data, encoding, cb) {
    this._pendingWrite = cb

    try {
      binding.write(this._handle, data)

      if (this._pendingWrite !== null) return

      cb(null)
    } catch (err) {
      this._pendingWrite = null

      cb(errors.from(err))
    }
  }

  _final (cb) {
    try {
      binding.shutdown(this._handle)

      cb(null)
    } catch (err) {
      cb(err)
    }

    this._socket.end()
  }

  _predestroy () {
    binding.destroy(this._handle)
    this._handle = null
    TLSSocket._sockets.delete(this)
  }

  _destroy (err, cb) {
    if (this._handle) {
      binding.destroy(this._handle)
      this._handle = null
      TLSSocket._sockets.delete(this)
    }
    cb(err)
  }

  static _sockets = new Set()
}

exports.TLSSocket = exports.Socket // For Node.js compatibility

exports.constants = constants
exports.errors = errors

Bare.on('exit', () => {
  for (const socket of exports.Socket._sockets) {
    socket.destroy()
  }

  binding.destroyContext(context)
})
