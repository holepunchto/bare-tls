import { Duplex, DuplexEvents } from 'bare-stream'
import constants from './lib/constants'
import errors from './lib/errors'

interface TLSSocketEvents extends DuplexEvents {
  connect: []
}

interface TLSSocketOptions {
  allowHalfOpen?: boolean
  cert?: ArrayBufferView
  eagerOpen?: boolean
  host?: string
  isServer?: boolean
  key?: ArrayBufferView
}

interface TLSSocket<M extends TLSSocketEvents> extends Duplex<M> {
  readonly socket: Duplex
  readonly encrypted: true
}

declare class TLSSocket<M extends TLSSocketEvents> extends Duplex<M> {
  constructor(socket: Duplex, opts?: TLSSocketOptions)
}

export {
  type TLSSocketEvents,
  type TLSSocketOptions,
  TLSSocket as Socket,
  TLSSocket as TLSSocket,
  errors,
  constants
}
