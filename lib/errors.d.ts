/** An error produced by a failed TLS operation; `code` identifies the failure. */
declare class TLSError extends Error {
  readonly code: string

  /** The underlying socket disconnected before the TLS handshake completed. */
  static CONNECTION_RESET(msg: string): TLSError

  /**
   * Create a `TLSError` from `err`, copying its message and code.
   * @param err - The error to convert.
   */
  static from(err: Error): TLSError
}

export = TLSError
