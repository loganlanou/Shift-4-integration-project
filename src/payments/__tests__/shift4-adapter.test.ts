/**
 * Unit tests for Shift4 Online Payment Adapter
 */

import { Shift4Adapter } from '../adapters/shift4-adapter'
import { Shift4Config } from '../types'
import {
  CardError,
  AuthenticationError,
  InvalidRequestError,
} from '../errors'

// Mock axios
jest.mock('axios')
import axios from 'axios'
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('Shift4Adapter', () => {
  let adapter: Shift4Adapter
  let mockAxiosInstance: any

  const mockConfig: Shift4Config = {
    publicKey: 'pk_test_123',
    secretKey: 'sk_test_456',
    mode: 'test',
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance)

    adapter = new Shift4Adapter(mockConfig)
  })

  describe('createCharge', () => {
    it('should create a successful charge', async () => {
      const mockResponse = {
        data: {
          id: 'ch_test_123',
          amount: 5000,
          currency: 'usd',
          status: 'successful',
          captured: true,
          created: 1234567890,
          card: {
            brand: 'Visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2025,
            type: 'credit',
          },
        },
      }

      mockAxiosInstance.post.mockResolvedValue(mockResponse)

      const result = await adapter.createCharge({
        amount: 5000,
        currency: 'usd',
        token: 'tok_test_123',
      })

      expect(result).toMatchObject({
        chargeId: 'ch_test_123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        captured: true,
        card: {
          brand: 'Visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
        },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/charges',
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          card: 'tok_test_123',
          captured: true,
        })
      )
    })

    it('should handle card errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 402,
          data: {
            error: {
              code: 'card_declined',
              message: 'Your card was declined',
            },
          },
        },
      })

      await expect(
        adapter.createCharge({
          amount: 5000,
          currency: 'usd',
          token: 'tok_test_123',
        })
      ).rejects.toThrow(CardError)
    })

    it('should require either token or customerId', async () => {
      await expect(
        adapter.createCharge({
          amount: 5000,
          currency: 'usd',
        } as any)
      ).rejects.toThrow(InvalidRequestError)
    })
  })

  describe('createRefund', () => {
    it('should create a refund', async () => {
      const mockResponse = {
        data: {
          id: 'ref_test_123',
          chargeId: 'ch_test_123',
          amount: 2500,
          status: 'successful',
          created: 1234567890,
        },
      }

      mockAxiosInstance.post.mockResolvedValue(mockResponse)

      const result = await adapter.createRefund({
        chargeId: 'ch_test_123',
        amount: 2500,
        reason: 'Customer request',
      })

      expect(result).toMatchObject({
        refundId: 'ref_test_123',
        chargeId: 'ch_test_123',
        amount: 2500,
        status: 'succeeded',
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/refunds',
        expect.objectContaining({
          chargeId: 'ch_test_123',
          amount: 2500,
          reason: 'Customer request',
        })
      )
    })
  })

  describe('createCustomer', () => {
    it('should create a customer', async () => {
      const mockResponse = {
        data: {
          id: 'cust_test_123',
          created: 1234567890,
        },
      }

      mockAxiosInstance.post.mockResolvedValue(mockResponse)

      const result = await adapter.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
      })

      expect(result).toMatchObject({
        customerId: 'cust_test_123',
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/customers',
        expect.objectContaining({
          email: 'test@example.com',
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle authentication errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid API key',
            },
          },
        },
      })

      await expect(
        adapter.createCharge({
          amount: 5000,
          currency: 'usd',
          token: 'tok_test_123',
        })
      ).rejects.toThrow(AuthenticationError)
    })

    it('should handle network errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        message: 'Network error',
        code: 'ECONNREFUSED',
      })

      await expect(
        adapter.createCharge({
          amount: 5000,
          currency: 'usd',
          token: 'tok_test_123',
        })
      ).rejects.toThrow()
    })
  })
})
