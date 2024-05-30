/* global Bare */
const { Duplex } = require('bare-stream')
const binding = require('./binding')
const constants = require('./lib/constants')
const errors = require('./lib/errors')

const defaultReadBufferSize = 65536

const context = binding.initContext()

exports.Socket = class TLSSocket extends Duplex {
  constructor (socket, opts = {}) {
    const {
      isServer = false,
      cert = null,
      key = null,
      eagerOpen = true,
      allowHalfOpen = true,
      readBufferSize = defaultReadBufferSize
    } = opts

    super({ mapWritable, eagerOpen })

    this._state = 0

    this._socket = socket
    this._key = key
    this._cert = cert
    this._allowHalfOpen = allowHalfOpen

    this._pendingRead = null
    this._pendingOpen = null
    this._pendingWrite = null

    this._buffer = Buffer.alloc(readBufferSize)

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
    this._pendingRead = data

    if (this._state & constants.state.HANDSHAKE) {
      const length = binding.read(this._handle, this._buffer)

      if (length === 0) {
        this.push(null)
        if (this._allowHalfOpen === false) this.end()
        return
      }

      this.push(this._buffer.subarray(0, length))
    } else if (binding.handshake(this._handle)) {
      this._onconnect()
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
    let buffer = this._pendingRead
    if (buffer === null) return 0

    if (buffer.byteLength > data.byteLength) {
      const rest = buffer.subarray(data.byteLength)
      buffer = buffer.subarray(0, data.byteLength)
      this._pendingRead = rest
    } else {
      this._pendingRead = null
    }

    data.set(buffer)

    return buffer.byteLength
  }

  _onwrite (data) {
    if (this._socket.write(Buffer.from(data))) {
      this._pendingWrite = null
    }

    return data.byteLength
  }

  _open (cb) {
    this._socket
      .on('data', this._ondata.bind(this))
      .on('drain', this._ondrain.bind(this))
      .on('end', this._onend.bind(this))
      .on('close', this._onclose.bind(this))
    this._pendingOpen = cb
    if (binding.handshake(this._handle)) this._onconnect()
  }

  _write (data, cb) {
    this._pendingWrite = cb
    binding.write(this._handle, data)
    if (this._pendingWrite) return
    cb(null)
  }

  _final (cb) {
    binding.shutdown(this._handle)
    this._socket.end()
    cb(null)
  }

  _predestroy () {
    binding.destroy(this._handle)
    this._handle = null
    TLSSocket._sockets.delete(this)
  }

  _destroy (cb) {
    if (this._handle) {
      binding.destroy(this._handle)
      this._handle = null
      TLSSocket._sockets.delete(this)
    }
    cb(null)
  }

  static _sockets = new Set()
}

exports.TLSSocket = exports.Socket // For Node.js compatibility

exports.constants = constants
exports.errors = errors

function mapWritable (data) {
  return typeof data === 'string' ? Buffer.from(data) : data
}

Bare.on('exit', () => {
  for (const socket of exports.Socket._sockets) {
    socket.destroy()
  }

  binding.destroyContext(context)
})
