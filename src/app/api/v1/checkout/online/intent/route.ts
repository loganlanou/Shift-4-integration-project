/**
 * POST /api/v1/checkout/online/intent
 * Create an online checkout intent
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  errorResponse,
  successResponse,
  parseBody,
  generateOrderNumber,
} from '@/lib/api-utils'
import { logger } from '@/payments/logger'

interface IntentRequest {
  amount: number
  currency?: string
  customerId?: string
  items?: Array<{
    sku: string
    name: string
    quantity: number
    price: number
  }>
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<IntentRequest>(req)

    // Validate
    if (!body.amount || body.amount <= 0) {
      return errorResponse(new Error('Amount must be greater than 0'), 400)
    }

    const currency = body.currency || 'usd'

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: body.customerId || 'guest', // TODO: Get from session
        status: 'DRAFT',
        subtotal: body.amount,
        total: body.amount,
        currency,
        items: body.items || [],
      },
    })

    logger.info({ orderId: order.id, amount: body.amount }, 'Online checkout intent created')

    return successResponse({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: body.amount,
      currency,
      publicKey: process.env.SHIFT4_PUBLIC_KEY,
      clientConfig: {
        amount: body.amount,
        currency,
      },
    })
  } catch (error) {
    logger.error({ error }, 'Failed to create checkout intent')
    return errorResponse(error)
  }
}
