/**
 * Unit tests for UTG Terminal Adapter
 */

import { UTGAdapter } from '../adapters/utg-adapter'
import { UTGConfig } from '../types'
import { TerminalOfflineError, TerminalTimeoutError } from '../errors'

jest.mock('axios')
import axios from 'axios'
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('UTGAdapter', () => {
  let adapter: UTGAdapter
  let mockAxiosInstance: any

  const mockConfig: UTGConfig = {
    enabled: true,
    host: '192.168.1.100',
    port: 8333,
    apiTerminalId: 'TERM_001',
    timeout: 60000,
    retryAttempts: 2,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    }

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance)

    adapter = new UTGAdapter(mockConfig, 'terminal-123')
  })

  describe('startPayment', () => {
    it('should start a payment successfully', async () => {
      const mockResponse = {
        data: {
          ResponseCode: '00', // Approved
          Amount: '5000',
          TotalAmount: '5000',
          Token: 'tok_terminal_123',
          CardBrand: 'Visa',
          Last4: '4242',
          AuthCode: 'AUTH123',
          EntryMode: 'chip',
        },
      }

      mockAxiosInstance.post.mockResolvedValue(mockResponse)

      const result = await adapter.startPayment({
        terminalId: 'terminal-123',
        amount: 5000,
        currency: 'usd',
        orderId: 'order-123',
      })

      expect(result).toMatchObject({
        approved: true,
        amount: 5000,
        totalAmount: 5000,
        token: 'tok_terminal_123',
        cardBrand: 'Visa',
        cardLast4: '4242',
        authCode: 'AUTH123',
        entryMode: 'chip',
      })
    })

    it('should handle declined payment', async () => {
      const mockResponse = {
        data: {
          ResponseCode: '05', // Declined
          ResponseMessage: 'Do not honor',
          Amount: '5000',
        },
      }

      mockAxiosInstance.post.mockResolvedValue(mockResponse)

      const result = await adapter.startPayment({
        terminalId: 'terminal-123',
        amount: 5000,
        currency: 'usd',
        orderId: 'order-123',
      })

      expect(result.approved).toBe(false)
      expect(result.error).toBe('Do not honor')
    })

    it('should handle terminal offline error', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        code: 'ECONNREFUSED',
      })

      await expect(
        adapter.startPayment({
          terminalId: 'terminal-123',
          amount: 5000,
          currency: 'usd',
          orderId: 'order-123',
        })
      ).rejects.toThrow(TerminalOfflineError)
    })

    it('should handle timeout error', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        code: 'ECONNABORTED',
      })

      await expect(
        adapter.startPayment({
          terminalId: 'terminal-123',
          amount: 5000,
          currency: 'usd',
          orderId: 'order-123',
        })
      ).rejects.toThrow(TerminalTimeoutError)
    })
  })

  describe('ping', () => {
    it('should return online status', async () => {
      mockAxiosInstance.get.mockResolvedValue({})

      const result = await adapter.ping()

      expect(result.online).toBe(true)
      expect(result.latencyMs).toBeGreaterThan(0)
    })

    it('should return offline status on failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'))

      const result = await adapter.ping()

      expect(result.online).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('cancel', () => {
    it('should cancel a transaction', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '00',
        },
      })

      const result = await adapter.cancel('tx-123')

      expect(result.cancelled).toBe(true)
    })
  })

  describe('refund', () => {
    it('should process a refund', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '00',
          Amount: '2500',
          ResponseMessage: 'Approved',
        },
      })

      const result = await adapter.refund({
        transactionId: 'tx-123',
        amount: 2500,
        currency: 'usd',
      })

      expect(result.approved).toBe(true)
      expect(result.amount).toBe(2500)
    })
  })
})
