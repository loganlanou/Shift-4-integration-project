/**
 * Custom error classes for payment processing
 */

export class PaymentError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly retryable: boolean

  constructor(
    message: string,
    code: string = 'PAYMENT_ERROR',
    statusCode: number = 500,
    retryable: boolean = false
  ) {
    super(message)
    this.name = 'PaymentError'
    this.code = code
    this.statusCode = statusCode
    this.retryable = retryable
    Object.setPrototypeOf(this, PaymentError.prototype)
  }
}

export class NetworkError extends PaymentError {
  constructor(message: string, retryable: boolean = true) {
    super(message, 'NETWORK_ERROR', 503, retryable)
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}

export class InvalidRequestError extends PaymentError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', 400, false)
    this.name = 'InvalidRequestError'
    Object.setPrototypeOf(this, InvalidRequestError.prototype)
  }
}

export class AuthenticationError extends PaymentError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, false)
    this.name = 'AuthenticationError'
    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }
}

export class CardError extends PaymentError {
  public readonly declineCode?: string

  constructor(message: string, declineCode?: string) {
    super(message, 'CARD_ERROR', 402, false)
    this.name = 'CardError'
    this.declineCode = declineCode
    Object.setPrototypeOf(this, CardError.prototype)
  }
}

export class TerminalError extends PaymentError {
  public readonly terminalId?: string

  constructor(message: string, terminalId?: string, retryable: boolean = false) {
    super(message, 'TERMINAL_ERROR', 500, retryable)
    this.name = 'TerminalError'
    this.terminalId = terminalId
    Object.setPrototypeOf(this, TerminalError.prototype)
  }
}

export class TerminalOfflineError extends TerminalError {
  constructor(terminalId: string) {
    super(`Terminal ${terminalId} is offline`, terminalId, true)
    this.name = 'TerminalOfflineError'
    this.code = 'TERMINAL_OFFLINE'
    Object.setPrototypeOf(this, TerminalOfflineError.prototype)
  }
}

export class TerminalTimeoutError extends TerminalError {
  constructor(terminalId: string) {
    super(`Terminal ${terminalId} timed out`, terminalId, true)
    this.name = 'TerminalTimeoutError'
    this.code = 'TERMINAL_TIMEOUT'
    Object.setPrototypeOf(this, TerminalTimeoutError.prototype)
  }
}

export class IdempotencyError extends PaymentError {
  constructor(message: string) {
    super(message, 'IDEMPOTENCY_ERROR', 409, false)
    this.name = 'IdempotencyError'
    Object.setPrototypeOf(this, IdempotencyError.prototype)
  }
}

export class RateLimitError extends PaymentError {
  public readonly retryAfter?: number

  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, true)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

/**
 * Utility to determine if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof PaymentError) {
    return error.retryable
  }

  // Network errors are generally retryable
  if (error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND')) {
    return true
  }

  return false
}

/**
 * Convert unknown errors to PaymentError
 */
export function toPaymentError(error: unknown): PaymentError {
  if (error instanceof PaymentError) {
    return error
  }

  if (error instanceof Error) {
    return new PaymentError(error.message, 'UNKNOWN_ERROR', 500, false)
  }

  return new PaymentError('An unknown error occurred', 'UNKNOWN_ERROR', 500, false)
}
