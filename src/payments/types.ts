/**
 * Core payment types and interfaces for the Shift4 integration
 * Provides abstraction layer for online and terminal payments
 */

// ============================================
// Common Types
// ============================================

export type Currency = 'usd' | 'eur' | 'gbp' | 'cad'

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country: string
}

export interface CardDetails {
  brand: string
  last4: string
  expMonth: number
  expYear: number
  funding?: 'credit' | 'debit' | 'prepaid' | 'unknown'
}

// ============================================
// Online Payment Adapter Interface
// ============================================

export interface CreateCustomerRequest {
  email: string
  name?: string
  phone?: string
  description?: string
  metadata?: Record<string, string>
}

export interface CreateCustomerResponse {
  customerId: string
  created: Date
}

export interface CreateChargeRequest {
  amount: number
  currency: Currency
  token: string
  customerId?: string
  description?: string
  capture?: boolean
  metadata?: Record<string, any>
}

export interface CreateChargeResponse {
  chargeId: string
  amount: number
  currency: Currency
  status: 'succeeded' | 'pending' | 'failed'
  captured: boolean
  card?: CardDetails
  created: Date
  failureCode?: string
  failureMessage?: string
}

export interface CaptureChargeRequest {
  chargeId: string
  amount?: number
}

export interface CaptureChargeResponse {
  chargeId: string
  amount: number
  captured: boolean
}

export interface CreateRefundRequest {
  chargeId: string
  amount?: number
  reason?: string
  metadata?: Record<string, any>
}

export interface CreateRefundResponse {
  refundId: string
  chargeId: string
  amount: number
  status: 'succeeded' | 'pending' | 'failed'
  created: Date
}

export interface SavePaymentMethodRequest {
  customerId: string
  token: string
}

export interface SavePaymentMethodResponse {
  cardId: string
  card: CardDetails
}

export interface OnlinePaymentAdapter {
  createCustomer(request: CreateCustomerRequest): Promise<CreateCustomerResponse>
  createCharge(request: CreateChargeRequest): Promise<CreateChargeResponse>
  captureCharge(request: CaptureChargeRequest): Promise<CaptureChargeResponse>
  createRefund(request: CreateRefundRequest): Promise<CreateRefundResponse>
  savePaymentMethod(request: SavePaymentMethodRequest): Promise<SavePaymentMethodResponse>
  getCharge(chargeId: string): Promise<CreateChargeResponse>
}

// ============================================
// Terminal Payment Adapter Interface
// ============================================

export type TipMode = 'prompt' | 'none' | 'fixed'

export type EntryMode = 'chip' | 'swipe' | 'contactless' | 'keyed' | 'fallback'

export interface StartPaymentRequest {
  terminalId: string
  amount: number
  currency: Currency
  orderId: string
  tipMode?: TipMode
  fixedTipAmount?: number
  promptForSignature?: boolean
  metadata?: Record<string, any>
}

export interface PaymentResult {
  transactionId: string
  approved: boolean
  amount: number
  tipAmount?: number
  totalAmount: number

  // Card details (if available)
  token?: string
  cardBrand?: string
  cardLast4?: string

  // Authorization
  authCode?: string
  entryMode?: EntryMode

  // Status
  responseCode?: string
  responseMessage?: string

  // EMV data
  emvData?: Record<string, any>

  // Error details
  error?: string
  errorCode?: string
}

export interface TransactionStatus {
  transactionId: string
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout' | 'error'
  approved?: boolean
  result?: PaymentResult
  error?: string
}

export interface RefundRequest {
  transactionId?: string
  token?: string
  amount: number
  currency: Currency
  reason?: string
}

export interface RefundResult {
  refundId: string
  approved: boolean
  amount: number
  responseCode?: string
  responseMessage?: string
  error?: string
}

export interface TerminalClient {
  /**
   * Start a payment transaction on the terminal
   */
  startPayment(request: StartPaymentRequest): Promise<PaymentResult>

  /**
   * Get the status of a transaction
   */
  getStatus(transactionId: string): Promise<TransactionStatus>

  /**
   * Cancel a pending transaction
   */
  cancel(transactionId: string): Promise<{ cancelled: boolean; error?: string }>

  /**
   * Process a refund
   */
  refund(request: RefundRequest): Promise<RefundResult>

  /**
   * Ping the terminal to check connectivity
   */
  ping(): Promise<{ online: boolean; latencyMs?: number; error?: string }>

  /**
   * Get terminal status and capabilities
   */
  getTerminalInfo(): Promise<TerminalInfo>
}

export interface TerminalInfo {
  terminalId: string
  online: boolean
  model?: string
  serialNumber?: string
  firmwareVersion?: string

  // Capabilities
  supportsEMV: boolean
  supportsNFC: boolean
  supportsTipping: boolean
  supportsSignature: boolean

  // SAF (Store and Forward) for offline mode
  safEnabled?: boolean
  safTransactionCount?: number
}

// ============================================
// Webhook Event Types
// ============================================

export type WebhookEventType =
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.captured'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.closed'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'customer.created'
  | 'customer.updated'
  | 'payout.created'
  | 'payout.paid'
  | 'payout.failed'

export interface WebhookEvent<T = any> {
  id: string
  type: WebhookEventType
  created: Date
  data: T
  livemode: boolean
}

// ============================================
// Configuration
// ============================================

export interface Shift4Config {
  publicKey: string
  secretKey: string
  mode: 'test' | 'live'
  webhookSecret?: string
  accountId?: string
  apiVersion?: string
}

export interface UTGConfig {
  enabled: boolean
  host: string
  port: number
  apiTerminalId: string
  timeout: number
  retryAttempts: number
  enableSAF?: boolean
}

export interface SkyTabConfig {
  enabled: boolean
  apiUrl: string
  apiKey: string
  merchantId: string
  timeout?: number
}
