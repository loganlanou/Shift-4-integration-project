/**
 * Payment-specific logger with structured logging
 */

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  serializers: {
    // Redact sensitive information
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'token',
      'card.number',
      'card.cvc',
      'password',
      'secret',
      'authorization',
      'cookie',
      '*.token',
      '*.password',
      '*.secret',
      '*.apiKey',
      '*.card.number',
      '*.card.cvc',
    ],
    remove: true,
  },
})

export type Logger = typeof logger

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, any>): Logger {
  return logger.child(context)
}

/**
 * Log payment-related events with automatic PII redaction
 */
export const paymentLogger = {
  chargeCreated: (chargeId: string, amount: number, currency: string) => {
    logger.info({ chargeId, amount, currency }, 'Charge created')
  },

  chargeCaptured: (chargeId: string, amount: number) => {
    logger.info({ chargeId, amount }, 'Charge captured')
  },

  chargeFailed: (chargeId: string, error: string, code?: string) => {
    logger.error({ chargeId, error, code }, 'Charge failed')
  },

  refundCreated: (refundId: string, chargeId: string, amount: number) => {
    logger.info({ refundId, chargeId, amount }, 'Refund created')
  },

  terminalPaymentStarted: (terminalId: string, amount: number, transactionId: string) => {
    logger.info({ terminalId, amount, transactionId }, 'Terminal payment started')
  },

  terminalPaymentCompleted: (terminalId: string, transactionId: string, approved: boolean) => {
    logger.info({ terminalId, transactionId, approved }, 'Terminal payment completed')
  },

  terminalError: (terminalId: string, error: string) => {
    logger.error({ terminalId, error }, 'Terminal error')
  },

  webhookReceived: (eventId: string, eventType: string) => {
    logger.info({ eventId, eventType }, 'Webhook received')
  },

  webhookProcessed: (eventId: string, eventType: string) => {
    logger.info({ eventId, eventType }, 'Webhook processed')
  },

  webhookFailed: (eventId: string, eventType: string, error: string) => {
    logger.error({ eventId, eventType, error }, 'Webhook processing failed')
  },
}
