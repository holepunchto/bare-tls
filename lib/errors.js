module.exports = class TLSError extends Error {
  constructor(msg, code, fn = TLSError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'TLSError'
  }

  static CONNECTION_RESET(msg) {
    return new TLSError(msg, 'ECONNRESET', TLSError.CONNECTION_RESET)
  }

  static from(err) {
    return new TLSError(err.message, err.code, TLSError.from)
  }
}
