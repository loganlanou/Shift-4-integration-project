/**
 * Shift4 Online Payment Adapter
 * Handles card-not-present transactions via Shift4 REST API
 */

import axios, { AxiosInstance, AxiosError } from 'axios'
import type {
  OnlinePaymentAdapter,
  CreateCustomerRequest,
  CreateCustomerResponse,
  CreateChargeRequest,
  CreateChargeResponse,
  CaptureChargeRequest,
  CaptureChargeResponse,
  CreateRefundRequest,
  CreateRefundResponse,
  SavePaymentMethodRequest,
  SavePaymentMethodResponse,
  Shift4Config,
} from '../types'
import {
  PaymentError,
  AuthenticationError,
  CardError,
  InvalidRequestError,
  RateLimitError,
  NetworkError,
} from '../errors'
import { logger } from '../logger'

const SHIFT4_API_URL = 'https://api.shift4.com'

export class Shift4Adapter implements OnlinePaymentAdapter {
  private client: AxiosInstance
  private config: Shift4Config

  constructor(config: Shift4Config) {
    this.config = config

    this.client = axios.create({
      baseURL: SHIFT4_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      auth: {
        username: config.secretKey,
        password: '',
      },
      timeout: 30000,
    })

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(
          {
            method: config.method,
            url: config.url,
            params: config.params,
          },
          'Shift4 API request'
        )
        return config
      },
      (error) => {
        logger.error({ error }, 'Shift4 request interceptor error')
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          {
            status: response.status,
            url: response.config.url,
          },
          'Shift4 API response'
        )
        return response
      },
      (error: AxiosError) => {
        return Promise.reject(this.handleError(error))
      }
    )
  }

  /**
   * Create a new customer in Shift4
   */
  async createCustomer(request: CreateCustomerRequest): Promise<CreateCustomerResponse> {
    try {
      const response = await this.client.post('/customers', {
        email: request.email,
        description: request.name,
        metadata: {
          name: request.name,
          phone: request.phone,
          ...request.metadata,
        },
      })

      return {
        customerId: response.data.id,
        created: new Date(response.data.created * 1000),
      }
    } catch (error) {
      logger.error({ error, request }, 'Failed to create customer')
      throw error
    }
  }

  /**
   * Create a charge (payment)
   */
  async createCharge(request: CreateChargeRequest): Promise<CreateChargeResponse> {
    try {
      const payload: any = {
        amount: request.amount,
        currency: request.currency,
        captured: request.capture ?? true,
        description: request.description,
      }

      // Either use token or customerId
      if (request.token) {
        payload.card = request.token
      } else if (request.customerId) {
        payload.customerId = request.customerId
      } else {
        throw new InvalidRequestError('Either token or customerId is required')
      }

      if (request.metadata) {
        payload.metadata = request.metadata
      }

      const response = await this.client.post('/charges', payload)

      const charge = response.data

      return {
        chargeId: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: this.mapChargeStatus(charge),
        captured: charge.captured,
        card: charge.card
          ? {
              brand: charge.card.brand,
              last4: charge.card.last4,
              expMonth: charge.card.expMonth,
              expYear: charge.card.expYear,
              funding: charge.card.type,
            }
          : undefined,
        created: new Date(charge.created * 1000),
        failureCode: charge.failureCode,
        failureMessage: charge.failureMessage,
      }
    } catch (error) {
      logger.error({ error, request }, 'Failed to create charge')
      throw error
    }
  }

  /**
   * Capture a previously authorized charge
   */
  async captureCharge(request: CaptureChargeRequest): Promise<CaptureChargeResponse> {
    try {
      const payload: any = {}
      if (request.amount) {
        payload.amount = request.amount
      }

      const response = await this.client.post(
        `/charges/${request.chargeId}/capture`,
        payload
      )

      return {
        chargeId: response.data.id,
        amount: response.data.amount,
        captured: response.data.captured,
      }
    } catch (error) {
      logger.error({ error, request }, 'Failed to capture charge')
      throw error
    }
  }

  /**
   * Create a refund
   */
  async createRefund(request: CreateRefundRequest): Promise<CreateRefundResponse> {
    try {
      const payload: any = {
        chargeId: request.chargeId,
      }

      if (request.amount) {
        payload.amount = request.amount
      }

      if (request.reason) {
        payload.reason = request.reason
      }

      if (request.metadata) {
        payload.metadata = request.metadata
      }

      const response = await this.client.post('/refunds', payload)

      return {
        refundId: response.data.id,
        chargeId: response.data.chargeId,
        amount: response.data.amount,
        status: response.data.status === 'successful' ? 'succeeded' : 'pending',
        created: new Date(response.data.created * 1000),
      }
    } catch (error) {
      logger.error({ error, request }, 'Failed to create refund')
      throw error
    }
  }

  /**
   * Save a payment method to a customer
   */
  async savePaymentMethod(
    request: SavePaymentMethodRequest
  ): Promise<SavePaymentMethodResponse> {
    try {
      // Update customer with new card
      const response = await this.client.post(`/customers/${request.customerId}`, {
        card: request.token,
      })

      const card = response.data.cards[0] // Get the most recent card

      return {
        cardId: card.id,
        card: {
          brand: card.brand,
          last4: card.last4,
          expMonth: card.expMonth,
          expYear: card.expYear,
          funding: card.type,
        },
      }
    } catch (error) {
      logger.error({ error, request }, 'Failed to save payment method')
      throw error
    }
  }

  /**
   * Get charge details
   */
  async getCharge(chargeId: string): Promise<CreateChargeResponse> {
    try {
      const response = await this.client.get(`/charges/${chargeId}`)
      const charge = response.data

      return {
        chargeId: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: this.mapChargeStatus(charge),
        captured: charge.captured,
        card: charge.card
          ? {
              brand: charge.card.brand,
              last4: charge.card.last4,
              expMonth: charge.card.expMonth,
              expYear: charge.card.expYear,
              funding: charge.card.type,
            }
          : undefined,
        created: new Date(charge.created * 1000),
        failureCode: charge.failureCode,
        failureMessage: charge.failureMessage,
      }
    } catch (error) {
      logger.error({ error, chargeId }, 'Failed to get charge')
      throw error
    }
  }

  /**
   * Map Shift4 charge status to our standard status
   */
  private mapChargeStatus(charge: any): 'succeeded' | 'pending' | 'failed' {
    if (charge.status === 'successful') {
      return 'succeeded'
    }
    if (charge.status === 'failed') {
      return 'failed'
    }
    return 'pending'
  }

  /**
   * Handle and transform Shift4 API errors
   */
  private handleError(error: AxiosError): Error {
    if (!error.response) {
      // Network error
      return new NetworkError(
        error.message || 'Network error connecting to Shift4',
        true
      )
    }

    const status = error.response.status
    const data: any = error.response.data

    // Extract error details
    const errorCode = data?.error?.code || data?.code
    const errorMessage =
      data?.error?.message || data?.message || 'Unknown Shift4 error'

    switch (status) {
      case 400:
        return new InvalidRequestError(errorMessage)

      case 401:
        return new AuthenticationError(
          'Invalid Shift4 API credentials. Check your secret key.'
        )

      case 402:
        // Card error
        return new CardError(errorMessage, errorCode)

      case 429:
        const retryAfter = error.response.headers['retry-after']
        return new RateLimitError(
          'Shift4 rate limit exceeded',
          retryAfter ? parseInt(retryAfter) : undefined
        )

      case 500:
      case 502:
      case 503:
      case 504:
        return new NetworkError('Shift4 API is temporarily unavailable', true)

      default:
        return new PaymentError(errorMessage, errorCode || 'SHIFT4_ERROR', status)
    }
  }
}

/**
 * Create a Shift4 adapter instance from environment variables
 */
export function createShift4Adapter(): Shift4Adapter {
  const config: Shift4Config = {
    publicKey: process.env.SHIFT4_PUBLIC_KEY!,
    secretKey: process.env.SHIFT4_SECRET_KEY!,
    mode: (process.env.SHIFT4_MODE as 'test' | 'live') || 'test',
    webhookSecret: process.env.SHIFT4_WEBHOOK_SIGNING_SECRET,
    accountId: process.env.SHIFT4_ACCOUNT_ID,
  }

  if (!config.publicKey || !config.secretKey) {
    throw new Error('SHIFT4_PUBLIC_KEY and SHIFT4_SECRET_KEY must be set')
  }

  return new Shift4Adapter(config)
}
