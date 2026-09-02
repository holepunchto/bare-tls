import { Duplex, DuplexEvents } from 'bare-stream'
import EventEmitter from 'bare-events'
import constants from './lib/constants'
import TLSError from './lib/errors'

export { constants, TLSError as errors }

/** Events emitted by a `TLSSocket`. */
export interface TLSSocketEvents extends DuplexEvents {
  /** Emitted when the TLS handshake completes. */
  connect: []
}

/** Options for a `TLSSocket`. */
export interface TLSSocketOptions {
  /**
   * Whether the socket acts as a TLS server or client; if `true`, `cert` and `key` must be
   * provided. Defaults to `false`.
   */
  isServer?: boolean
  /** A `Buffer` containing PEM-encoded certificate data. Defaults to `null`. */
  cert?: ArrayBufferView
  /** A `Buffer` containing PEM-encoded private key data. Defaults to `null`. */
  key?: ArrayBufferView
  /**
   * The hostname to verify the server certificate against; DNS names are also sent as the SNI
   * extension, while IP literals are matched against the certificate's IP SANs with SNI suppressed.
   * Required for client sockets unless `rejectUnauthorized` is `false`.
   */
  host?: string
  /**
   * Whether the client rejects connections when certificate verification fails. Defaults to `true`.
   */
  rejectUnauthorized?: boolean
  /**
   * A `Buffer` of one or more PEM-encoded CA certificates; when provided, only these CAs are used
   * for verification instead of the bundled Mozilla root certificates. Defaults to `null`.
   */
  ca?: ArrayBufferView
  /** An array of ALPN protocol name strings, ordered by preference. Defaults to `null`. */
  alpnProtocols?: string[]
  /** Whether to open the stream eagerly. Defaults to `true`. */
  eagerOpen?: boolean
  /** Whether to allow half-open connections. Defaults to `true`. */
  allowHalfOpen?: boolean
  /** The size in bytes of the read buffer. Defaults to `65536`. */
  readBufferSize?: number
}

export interface TLSSocket<M extends TLSSocketEvents = TLSSocketEvents> extends Duplex<M> {
  /** The underlying duplex stream. */
  readonly socket: Duplex
  /** Always `true`. */
  readonly encrypted: true
  /** The negotiated ALPN protocol as a string, or `null` if no protocol was negotiated. */
  readonly alpnProtocol: string | null
}

export class TLSSocket {
  /** Wrap the duplex stream `socket` with TLS. */
  constructor(socket: Duplex, opts?: TLSSocketOptions)
}

export { TLSSocket as Socket }

/** Events emitted by a TLS server. */
export interface TLSNetServerEvents {
  /** Emitted when the server starts listening. */
  listening: []
  /** Emitted when a new TLS connection is established. */
  connection: [socket: TLSSocket]
  /** Emitted on server error. */
  error: [err: Error]
  /** Emitted when the server closes. */
  close: []
}

/**
 * A TLS server over TCP; incoming connections are wrapped with TLS and emitted as `'connection'`
 * events.
 */
export interface TLSNetServer extends EventEmitter<TLSNetServerEvents> {
  /** Whether or not the server is listening. */
  readonly listening: boolean
}

/**
 * Creates a TLS server that listens for TCP connections and wraps them with TLS. Incoming
 * connections are emitted as `'connection'` events with a `tls.Socket` instance. Options are the
 * same as `tls.Socket`, plus any options supported by <https://github.com/holepunchto/bare-net>.
 * @param opts - Options applied to each incoming socket; the same as `TLSSocket`, plus any options
 * supported by `bare-net`.
 * @param onconnection - Called on each `'connection'` event.
 */
export function createServer(
  opts?: TLSSocketOptions,
  onconnection?: (socket: TLSSocket) => void
): TLSNetServer

/**
 * Creates a TCP connection and wraps it with TLS. `opts` are passed to both the underlying TCP
 * socket and `TLSSocket`. At minimum, `port` must be specified.
 * @param opts - Options passed to both the underlying TCP socket and `TLSSocket`; `port` is
 * required and `host` defaults to `'localhost'`.
 * @param onconnect - Called when the connection is established.
 */
export function createConnection(
  opts: TLSSocketOptions & { port: number; host?: string },
  onconnect?: () => void
): TLSSocket

export function createConnection(port: number, host?: string, onconnect?: () => void): TLSSocket

export { createConnection as connect }
