/**
 * UTG (Universal Transaction Gateway) Terminal Adapter
 * Handles card-present transactions via Shift4 UTG
 *
 * NOTE: This implementation provides the structure and interface.
 * You'll need to verify exact UTG message formats from Shift4 UTG documentation.
 * The adapter is designed to be easily updated with actual UTG protocol details.
 */

import axios, { AxiosInstance, AxiosError } from 'axios'
import { nanoid } from 'nanoid'
import type {
  TerminalClient,
  StartPaymentRequest,
  PaymentResult,
  TransactionStatus,
  RefundRequest,
  RefundResult,
  TerminalInfo,
  UTGConfig,
  EntryMode,
} from '../types'
import {
  TerminalError,
  TerminalOfflineError,
  TerminalTimeoutError,
  NetworkError,
} from '../errors'
import { logger } from '../logger'

/**
 * UTG Transaction Types
 */
enum UTGTransactionType {
  SALE = 'Sale',
  AUTH = 'Auth',
  CAPTURE = 'Capture',
  VOID = 'Void',
  REFUND = 'Refund',
  STATUS = 'Status',
}

/**
 * UTG Response Codes
 * TODO: Verify these codes match your UTG configuration
 */
const UTG_APPROVED_CODE = '00'
const UTG_TIMEOUT_CODE = 'TO'
const UTG_CANCELLED_CODE = 'CA'

export class UTGAdapter implements TerminalClient {
  private client: AxiosInstance
  private config: UTGConfig
  private terminalId: string

  constructor(config: UTGConfig, terminalId: string) {
    this.config = config
    this.terminalId = terminalId

    // UTG typically uses HTTP/HTTPS for API calls
    const protocol = 'http' // Change to 'https' if UTG uses SSL
    const baseURL = `${protocol}://${config.host}:${config.port}`

    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 60000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    logger.info(
      {
        terminalId,
        host: config.host,
        port: config.port,
      },
      'UTG adapter initialized'
    )
  }

  /**
   * Start a payment transaction on the terminal
   */
  async startPayment(request: StartPaymentRequest): Promise<PaymentResult> {
    const transactionId = nanoid()

    try {
      logger.info(
        {
          terminalId: this.terminalId,
          transactionId,
          amount: request.amount,
        },
        'Starting UTG payment'
      )

      // Build UTG request
      // TODO: Adjust this payload structure to match your UTG API spec
      const utgRequest = {
        TransactionType: UTGTransactionType.SALE,
        ApiTerminalId: this.config.apiTerminalId,
        TransactionId: transactionId,
        Amount: this.formatAmount(request.amount),
        Currency: request.currency.toUpperCase(),
        // Tipping
        TipMode: request.tipMode === 'prompt' ? 'Prompt' : 'None',
        TipAmount: request.fixedTipAmount
          ? this.formatAmount(request.fixedTipAmount)
          : undefined,
        // Additional options
        PromptForSignature: request.promptForSignature ?? false,
        // Metadata
        InvoiceNumber: request.orderId,
        Metadata: request.metadata,
      }

      // Send transaction to UTG
      // TODO: Verify the exact UTG endpoint path
      const response = await this.client.post('/api/transaction', utgRequest)

      // Parse UTG response
      return this.parsePaymentResponse(response.data, transactionId)
    } catch (error) {
      logger.error(
        {
          error,
          terminalId: this.terminalId,
          transactionId,
        },
        'UTG payment failed'
      )

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          throw new TerminalOfflineError(this.terminalId)
        }
        if (error.code === 'ECONNABORTED') {
          throw new TerminalTimeoutError(this.terminalId)
        }
      }

      throw new TerminalError(
        `UTG payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.terminalId
      )
    }
  }

  /**
   * Get transaction status
   */
  async getStatus(transactionId: string): Promise<TransactionStatus> {
    try {
      // TODO: Implement status check endpoint
      const response = await this.client.post('/api/status', {
        TransactionType: UTGTransactionType.STATUS,
        ApiTerminalId: this.config.apiTerminalId,
        TransactionId: transactionId,
      })

      const data = response.data

      return {
        transactionId,
        status: this.mapStatus(data.ResponseCode),
        approved: data.ResponseCode === UTG_APPROVED_CODE,
        result: data.ResponseCode === UTG_APPROVED_CODE
          ? this.parsePaymentResponse(data, transactionId)
          : undefined,
      }
    } catch (error) {
      logger.error({ error, transactionId }, 'UTG status check failed')
      return {
        transactionId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Cancel a pending transaction
   */
  async cancel(transactionId: string): Promise<{ cancelled: boolean; error?: string }> {
    try {
      // TODO: Implement void/cancel endpoint
      const response = await this.client.post('/api/transaction', {
        TransactionType: UTGTransactionType.VOID,
        ApiTerminalId: this.config.apiTerminalId,
        TransactionId: transactionId,
      })

      const cancelled = response.data.ResponseCode === UTG_APPROVED_CODE

      if (cancelled) {
        logger.info({ transactionId }, 'UTG transaction cancelled')
      }

      return {
        cancelled,
        error: cancelled ? undefined : response.data.ResponseMessage,
      }
    } catch (error) {
      logger.error({ error, transactionId }, 'UTG cancel failed')
      return {
        cancelled: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Process a refund
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    const refundId = nanoid()

    try {
      // TODO: Implement refund endpoint
      const response = await this.client.post('/api/transaction', {
        TransactionType: UTGTransactionType.REFUND,
        ApiTerminalId: this.config.apiTerminalId,
        TransactionId: refundId,
        OriginalTransactionId: request.transactionId,
        Amount: this.formatAmount(request.amount),
        Currency: request.currency.toUpperCase(),
        Token: request.token,
      })

      const data = response.data
      const approved = data.ResponseCode === UTG_APPROVED_CODE

      logger.info(
        {
          refundId,
          approved,
          amount: request.amount,
        },
        'UTG refund processed'
      )

      return {
        refundId,
        approved,
        amount: request.amount,
        responseCode: data.ResponseCode,
        responseMessage: data.ResponseMessage,
        error: approved ? undefined : data.ResponseMessage,
      }
    } catch (error) {
      logger.error({ error, request }, 'UTG refund failed')
      throw new TerminalError(
        `UTG refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.terminalId
      )
    }
  }

  /**
   * Ping terminal to check connectivity
   */
  async ping(): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now()

    try {
      // TODO: Implement ping/health check endpoint
      await this.client.get('/api/health', { timeout: 5000 })

      const latencyMs = Date.now() - startTime

      logger.debug({ terminalId: this.terminalId, latencyMs }, 'UTG ping successful')

      return {
        online: true,
        latencyMs,
      }
    } catch (error) {
      logger.warn({ error, terminalId: this.terminalId }, 'UTG ping failed')
      return {
        online: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get terminal information and capabilities
   */
  async getTerminalInfo(): Promise<TerminalInfo> {
    try {
      // TODO: Implement terminal info endpoint
      const response = await this.client.get('/api/terminal-info', {
        params: {
          apiTerminalId: this.config.apiTerminalId,
        },
      })

      const data = response.data

      return {
        terminalId: this.terminalId,
        online: true,
        model: data.Model,
        serialNumber: data.SerialNumber,
        firmwareVersion: data.FirmwareVersion,
        supportsEMV: data.SupportsEMV ?? true,
        supportsNFC: data.SupportsNFC ?? false,
        supportsTipping: data.SupportsTipping ?? false,
        supportsSignature: data.SupportsSignature ?? false,
        safEnabled: data.SAFEnabled ?? false,
        safTransactionCount: data.SAFTransactionCount ?? 0,
      }
    } catch (error) {
      logger.warn({ error, terminalId: this.terminalId }, 'Failed to get terminal info')

      // Return default info if endpoint fails
      return {
        terminalId: this.terminalId,
        online: false,
        supportsEMV: true,
        supportsNFC: false,
        supportsTipping: false,
        supportsSignature: false,
      }
    }
  }

  /**
   * Parse UTG payment response into standard PaymentResult
   */
  private parsePaymentResponse(data: any, transactionId: string): PaymentResult {
    const approved = data.ResponseCode === UTG_APPROVED_CODE

    // TODO: Verify these field names match your UTG response format
    return {
      transactionId,
      approved,
      amount: this.parseAmount(data.Amount),
      tipAmount: data.TipAmount ? this.parseAmount(data.TipAmount) : undefined,
      totalAmount: this.parseAmount(data.TotalAmount || data.Amount),

      // Card details
      token: data.Token,
      cardBrand: data.CardBrand,
      cardLast4: data.Last4,

      // Authorization
      authCode: data.AuthCode,
      entryMode: this.mapEntryMode(data.EntryMode),

      // Response
      responseCode: data.ResponseCode,
      responseMessage: data.ResponseMessage,

      // EMV data
      emvData: data.EMVData,

      // Error (if not approved)
      error: approved ? undefined : data.ResponseMessage,
      errorCode: approved ? undefined : data.ResponseCode,
    }
  }

  /**
   * Map UTG status code to standard status
   */
  private mapStatus(
    responseCode: string
  ): 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout' | 'error' {
    if (responseCode === UTG_APPROVED_CODE) return 'approved'
    if (responseCode === UTG_CANCELLED_CODE) return 'cancelled'
    if (responseCode === UTG_TIMEOUT_CODE) return 'timeout'
    // TODO: Add more response code mappings
    return 'declined'
  }

  /**
   * Map UTG entry mode to standard EntryMode
   */
  private mapEntryMode(mode: string): EntryMode | undefined {
    const modeMap: Record<string, EntryMode> = {
      chip: 'chip',
      emv: 'chip',
      swipe: 'swipe',
      contactless: 'contactless',
      nfc: 'contactless',
      manual: 'keyed',
      keyed: 'keyed',
      fallback: 'fallback',
    }

    return modeMap[mode?.toLowerCase()] || undefined
  }

  /**
   * Format amount for UTG (typically in cents as string)
   */
  private formatAmount(amount: number): string {
    return amount.toString()
  }

  /**
   * Parse amount from UTG response
   */
  private parseAmount(amount: string | number): number {
    return typeof amount === 'string' ? parseInt(amount, 10) : amount
  }
}

/**
 * Create UTG adapter from configuration
 */
export function createUTGAdapter(terminalId: string): UTGAdapter {
  const config: UTGConfig = {
    enabled: process.env.UTG_ENABLED === 'true',
    host: process.env.UTG_HOST || 'localhost',
    port: parseInt(process.env.UTG_PORT || '8333', 10),
    apiTerminalId: process.env.UTG_API_TERMINAL_ID || '',
    timeout: parseInt(process.env.UTG_TIMEOUT_MS || '60000', 10),
    retryAttempts: parseInt(process.env.UTG_RETRY_ATTEMPTS || '2', 10),
    enableSAF: process.env.UTG_ENABLE_SAF === 'true',
  }

  if (!config.enabled) {
    throw new Error('UTG is not enabled. Set UTG_ENABLED=true')
  }

  if (!config.apiTerminalId) {
    throw new Error('UTG_API_TERMINAL_ID must be set')
  }

  return new UTGAdapter(config, terminalId)
}
