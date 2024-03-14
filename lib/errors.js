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
}
