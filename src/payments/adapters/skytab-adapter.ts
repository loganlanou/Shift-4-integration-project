/**
 * SkyTab Terminal Adapter
 * Handles card-present transactions via SkyTab devices
 *
 * NOTE: This implementation provides the structure and interface.
 * You'll need to verify exact SkyTab API formats from documentation.
 * Reference: https://skytab.docs.apiary.io
 */

import axios, { AxiosInstance } from 'axios'
import { nanoid } from 'nanoid'
import type {
  TerminalClient,
  StartPaymentRequest,
  PaymentResult,
  TransactionStatus,
  RefundRequest,
  RefundResult,
  TerminalInfo,
  SkyTabConfig,
  EntryMode,
} from '../types'
import {
  TerminalError,
  TerminalOfflineError,
  TerminalTimeoutError,
} from '../errors'
import { logger } from '../logger'

/**
 * SkyTab Transaction Types
 */
enum SkyTabTransactionType {
  SALE = 'sale',
  AUTH = 'auth',
  CAPTURE = 'capture',
  VOID = 'void',
  REFUND = 'refund',
}

/**
 * SkyTab Transaction Status
 */
enum SkyTabStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

export class SkyTabAdapter implements TerminalClient {
  private client: AxiosInstance
  private config: SkyTabConfig
  private terminalId: string
  private deviceId: string

  constructor(config: SkyTabConfig, terminalId: string, deviceId: string) {
    this.config = config
    this.terminalId = terminalId
    this.deviceId = deviceId

    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 60000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Merchant-Id': config.merchantId,
      },
    })

    logger.info(
      {
        terminalId,
        deviceId,
        apiUrl: config.apiUrl,
      },
      'SkyTab adapter initialized'
    )
  }

  /**
   * Start a payment transaction on the SkyTab device
   */
  async startPayment(request: StartPaymentRequest): Promise<PaymentResult> {
    const transactionId = nanoid()

    try {
      logger.info(
        {
          terminalId: this.terminalId,
          deviceId: this.deviceId,
          transactionId,
          amount: request.amount,
        },
        'Starting SkyTab payment'
      )

      // Build SkyTab request
      // TODO: Verify this structure against SkyTab API documentation
      const skyTabRequest = {
        device_id: this.deviceId,
        transaction_type: SkyTabTransactionType.SALE,
        reference_id: transactionId,
        amount: request.amount,
        currency: request.currency.toUpperCase(),
        // Tipping configuration
        tip_enabled: request.tipMode === 'prompt',
        tip_amount: request.fixedTipAmount,
        // Signature
        signature_required: request.promptForSignature ?? false,
        // Metadata
        metadata: {
          order_id: request.orderId,
          ...request.metadata,
        },
      }

      // Initiate transaction on device
      const response = await this.client.post(
        '/api/v1/transactions',
        skyTabRequest
      )

      const transactionData = response.data

      // Poll for transaction result
      // SkyTab typically requires polling until the transaction completes
      const result = await this.pollTransactionStatus(
        transactionData.transaction_id || transactionId,
        request.amount
      )

      return result
    } catch (error) {
      logger.error(
        {
          error,
          terminalId: this.terminalId,
          deviceId: this.deviceId,
          transactionId,
        },
        'SkyTab payment failed'
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
        `SkyTab payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.terminalId
      )
    }
  }

  /**
   * Get transaction status
   */
  async getStatus(transactionId: string): Promise<TransactionStatus> {
    try {
      const response = await this.client.get(
        `/api/v1/transactions/${transactionId}`
      )

      const data = response.data

      return {
        transactionId,
        status: this.mapStatus(data.status),
        approved: data.status === SkyTabStatus.APPROVED,
        result:
          data.status === SkyTabStatus.APPROVED
            ? this.parseTransactionData(data, transactionId)
            : undefined,
      }
    } catch (error) {
      logger.error({ error, transactionId }, 'SkyTab status check failed')
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
  async cancel(
    transactionId: string
  ): Promise<{ cancelled: boolean; error?: string }> {
    try {
      const response = await this.client.post(
        `/api/v1/transactions/${transactionId}/cancel`
      )

      const cancelled = response.data.status === SkyTabStatus.CANCELLED

      if (cancelled) {
        logger.info({ transactionId, deviceId: this.deviceId }, 'SkyTab transaction cancelled')
      }

      return {
        cancelled,
        error: cancelled ? undefined : response.data.message,
      }
    } catch (error) {
      logger.error({ error, transactionId }, 'SkyTab cancel failed')
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
      const response = await this.client.post('/api/v1/refunds', {
        device_id: this.deviceId,
        original_transaction_id: request.transactionId,
        reference_id: refundId,
        amount: request.amount,
        currency: request.currency.toUpperCase(),
        reason: request.reason,
      })

      const data = response.data
      const approved = data.status === SkyTabStatus.APPROVED

      logger.info(
        {
          refundId,
          approved,
          amount: request.amount,
        },
        'SkyTab refund processed'
      )

      return {
        refundId,
        approved,
        amount: request.amount,
        responseCode: data.response_code,
        responseMessage: data.response_message,
        error: approved ? undefined : data.response_message,
      }
    } catch (error) {
      logger.error({ error, request }, 'SkyTab refund failed')
      throw new TerminalError(
        `SkyTab refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.terminalId
      )
    }
  }

  /**
   * Ping device to check connectivity
   */
  async ping(): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now()

    try {
      await this.client.get(`/api/v1/devices/${this.deviceId}/status`, {
        timeout: 5000,
      })

      const latencyMs = Date.now() - startTime

      logger.debug(
        { terminalId: this.terminalId, deviceId: this.deviceId, latencyMs },
        'SkyTab ping successful'
      )

      return {
        online: true,
        latencyMs,
      }
    } catch (error) {
      logger.warn({ error, terminalId: this.terminalId }, 'SkyTab ping failed')
      return {
        online: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get terminal/device information and capabilities
   */
  async getTerminalInfo(): Promise<TerminalInfo> {
    try {
      const response = await this.client.get(`/api/v1/devices/${this.deviceId}`)

      const data = response.data

      return {
        terminalId: this.terminalId,
        online: data.status === 'online',
        model: data.model,
        serialNumber: data.serial_number,
        firmwareVersion: data.firmware_version,
        supportsEMV: data.capabilities?.emv ?? true,
        supportsNFC: data.capabilities?.nfc ?? true,
        supportsTipping: data.capabilities?.tipping ?? true,
        supportsSignature: data.capabilities?.signature ?? true,
      }
    } catch (error) {
      logger.warn({ error, terminalId: this.terminalId }, 'Failed to get SkyTab device info')

      return {
        terminalId: this.terminalId,
        online: false,
        supportsEMV: true,
        supportsNFC: true,
        supportsTipping: true,
        supportsSignature: true,
      }
    }
  }

  /**
   * Poll transaction status until completion
   */
  private async pollTransactionStatus(
    transactionId: string,
    expectedAmount: number,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<PaymentResult> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(intervalMs)

      const status = await this.getStatus(transactionId)

      // Check if transaction is complete
      if (
        status.status === 'approved' ||
        status.status === 'declined' ||
        status.status === 'cancelled' ||
        status.status === 'error'
      ) {
        if (status.result) {
          return status.result
        }

        // Transaction failed or was cancelled
        return {
          transactionId,
          approved: false,
          amount: expectedAmount,
          totalAmount: expectedAmount,
          error: status.error || 'Transaction was not approved',
          errorCode: status.status.toUpperCase(),
        }
      }

      // Continue polling
      logger.debug(
        { transactionId, attempt, status: status.status },
        'Polling SkyTab transaction status'
      )
    }

    // Timeout
    throw new TerminalTimeoutError(this.terminalId)
  }

  /**
   * Parse SkyTab transaction data into standard PaymentResult
   */
  private parseTransactionData(data: any, transactionId: string): PaymentResult {
    const approved = data.status === SkyTabStatus.APPROVED

    return {
      transactionId,
      approved,
      amount: data.amount,
      tipAmount: data.tip_amount,
      totalAmount: data.total_amount || data.amount,

      // Card details
      token: data.card?.token,
      cardBrand: data.card?.brand,
      cardLast4: data.card?.last4,

      // Authorization
      authCode: data.auth_code,
      entryMode: this.mapEntryMode(data.entry_mode),

      // Response
      responseCode: data.response_code,
      responseMessage: data.response_message,

      // EMV data
      emvData: data.emv_data,

      // Error (if not approved)
      error: approved ? undefined : data.response_message,
      errorCode: approved ? undefined : data.response_code,
    }
  }

  /**
   * Map SkyTab status to standard status
   */
  private mapStatus(
    status: string
  ): 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout' | 'error' {
    const statusMap: Record<string, typeof status> = {
      [SkyTabStatus.PENDING]: 'pending',
      [SkyTabStatus.PROCESSING]: 'pending',
      [SkyTabStatus.APPROVED]: 'approved',
      [SkyTabStatus.DECLINED]: 'declined',
      [SkyTabStatus.CANCELLED]: 'cancelled',
      [SkyTabStatus.ERROR]: 'error',
    }

    return (statusMap[status] as any) || 'error'
  }

  /**
   * Map SkyTab entry mode to standard EntryMode
   */
  private mapEntryMode(mode: string): EntryMode | undefined {
    const modeMap: Record<string, EntryMode> = {
      chip: 'chip',
      emv: 'chip',
      swipe: 'swipe',
      mag: 'swipe',
      contactless: 'contactless',
      nfc: 'contactless',
      tap: 'contactless',
      manual: 'keyed',
      keyed: 'keyed',
      fallback: 'fallback',
    }

    return modeMap[mode?.toLowerCase()] || undefined
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Create SkyTab adapter from configuration
 */
export function createSkyTabAdapter(
  terminalId: string,
  deviceId: string
): SkyTabAdapter {
  const config: SkyTabConfig = {
    enabled: process.env.SKYTAB_ENABLED === 'true',
    apiUrl: process.env.SKYTAB_API_URL || 'https://api.skytab.com',
    apiKey: process.env.SKYTAB_API_KEY || '',
    merchantId: process.env.SKYTAB_MERCHANT_ID || '',
    timeout: parseInt(process.env.SKYTAB_TIMEOUT_MS || '60000', 10),
  }

  if (!config.enabled) {
    throw new Error('SkyTab is not enabled. Set SKYTAB_ENABLED=true')
  }

  if (!config.apiKey || !config.merchantId) {
    throw new Error('SKYTAB_API_KEY and SKYTAB_MERCHANT_ID must be set')
  }

  return new SkyTabAdapter(config, terminalId, deviceId)
}
