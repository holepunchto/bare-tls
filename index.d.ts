import { Duplex, DuplexEvents } from 'bare-stream'

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

declare class TLSError extends Error {
  static from(err: Error): TLSError
}

declare const constants: { state: { HANDSHAKE: number } }

export {
  TLSSocket as Socket,
  TLSSocket as TLSSocket,
  TLSError as errors,
  constants
}
