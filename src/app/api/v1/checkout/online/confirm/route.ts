/**
 * POST /api/v1/checkout/online/confirm
 * Confirm an online payment with a Shift4 token
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  errorResponse,
  successResponse,
  parseBody,
  generateIdempotencyKey,
} from '@/lib/api-utils'
import { createShift4Adapter } from '@/payments'
import { logger, paymentLogger } from '@/payments/logger'

interface ConfirmRequest {
  orderId: string
  token: string
  customerId?: string
  saveMethod?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<ConfirmRequest>(req)

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
    })

    if (!order) {
      return errorResponse(new Error('Order not found'), 404)
    }

    if (order.status !== 'DRAFT' && order.status !== 'PENDING_PAYMENT') {
      return errorResponse(new Error('Order cannot be paid'), 400)
    }

    // Initialize Shift4 adapter
    const shift4 = createShift4Adapter()

    // Create charge
    const idempotencyKey = generateIdempotencyKey('pay')
    const chargeResult = await shift4.createCharge({
      amount: order.total,
      currency: order.currency,
      token: body.token,
      customerId: body.customerId,
      description: `Payment for ${order.orderNumber}`,
      capture: true,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    })

    // Save payment to database
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        customerId: body.customerId,
        shift4ChargeId: chargeResult.chargeId,
        amount: chargeResult.amount,
        currency: chargeResult.currency,
        status: chargeResult.status === 'succeeded' ? 'CAPTURED' : 'FAILED',
        methodType: 'CARD_ONLINE',
        cardBrand: chargeResult.card?.brand,
        cardLast4: chargeResult.card?.last4,
        cardExpMonth: chargeResult.card?.expMonth,
        cardExpYear: chargeResult.card?.expYear,
        idempotencyKey,
        capturedAt: chargeResult.captured ? new Date() : null,
        failureCode: chargeResult.failureCode,
        failureMessage: chargeResult.failureMessage,
      },
    })

    // Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: chargeResult.status === 'succeeded' ? 'PAID' : 'PENDING_PAYMENT',
      },
    })

    // Log payment
    if (chargeResult.status === 'succeeded') {
      paymentLogger.chargeCreated(chargeResult.chargeId, chargeResult.amount, chargeResult.currency)
    } else {
      paymentLogger.chargeFailed(chargeResult.chargeId, chargeResult.failureMessage || 'Unknown', chargeResult.failureCode)
    }

    // TODO: If saveMethod is true, save payment method to customer

    return successResponse({
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      card: chargeResult.card,
      createdAt: payment.createdAt,
    })
  } catch (error) {
    logger.error({ error }, 'Failed to confirm payment')
    return errorResponse(error)
  }
}
