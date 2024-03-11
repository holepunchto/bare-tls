module.exports = class TLSError extends Error {
  constructor (msg, code, fn = TLSError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name () {
    return 'TLSError'
  }

  static ALREADY_CONNECTED (msg) {
    return new TLSError(msg, 'ALREADY_CONNECTED', TLSError.ALREADY_CONNECTED)
  }

  static ALREADY_ACCEPTED (msg) {
    return new TLSError(msg, 'ALREADY_ACCEPTED', TLSError.ALREADY_ACCEPTED)
  }
}
