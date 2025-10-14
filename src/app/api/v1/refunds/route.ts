/**
 * POST /api/v1/refunds
 * Create a refund
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  errorResponse,
  successResponse,
  parseBody,
  generateIdempotencyKey,
  getPaginationParams,
  paginationMeta,
} from '@/lib/api-utils'
import { createShift4Adapter } from '@/payments'
import { logger, paymentLogger } from '@/payments/logger'

interface CreateRefundRequest {
  paymentId: string
  amount?: number
  reason?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<CreateRefundRequest>(req)

    // Get payment
    const payment = await prisma.payment.findUnique({
      where: { id: body.paymentId },
      include: { order: true },
    })

    if (!payment) {
      return errorResponse(new Error('Payment not found'), 404)
    }

    if (payment.status === 'REFUNDED') {
      return errorResponse(new Error('Payment already refunded'), 400)
    }

    const refundAmount = body.amount || payment.amount

    // Validate refund amount
    const existingRefunds = await prisma.refund.findMany({
      where: { paymentId: payment.id, status: 'SUCCEEDED' },
    })
    const totalRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0)
    const availableToRefund = payment.amount - totalRefunded

    if (refundAmount > availableToRefund) {
      return errorResponse(
        new Error(`Cannot refund more than ${availableToRefund} cents`),
        400
      )
    }

    // Process refund via Shift4
    if (payment.methodType === 'CARD_ONLINE' || payment.methodType === 'SAVED_CARD') {
      const shift4 = createShift4Adapter()

      const refundResult = await shift4.createRefund({
        chargeId: payment.shift4ChargeId!,
        amount: refundAmount,
        reason: body.reason,
        metadata: {
          orderId: payment.orderId,
          paymentId: payment.id,
        },
      })

      // Create refund record
      const refund = await prisma.refund.create({
        data: {
          orderId: payment.orderId,
          paymentId: payment.id,
          shift4RefundId: refundResult.refundId,
          amount: refundAmount,
          currency: payment.currency,
          status: refundResult.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
          reason: body.reason,
          idempotencyKey: generateIdempotencyKey('ref'),
          processedAt: refundResult.status === 'succeeded' ? new Date() : null,
        },
      })

      // Update payment status
      const newTotalRefunded = totalRefunded + refundAmount
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:
            newTotalRefunded >= payment.amount
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED',
        },
      })

      // Update order
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          refundedTotal: { increment: refundAmount },
          status:
            newTotalRefunded >= payment.order.total
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED',
        },
      })

      paymentLogger.refundCreated(refund.id, payment.shift4ChargeId!, refundAmount)

      return successResponse(refund, 200)
    }

    // Terminal refund (UTG/SkyTab)
    // TODO: Implement terminal refund logic using TerminalClient.refund()

    return errorResponse(new Error('Terminal refunds not yet implemented'), 501)
  } catch (error) {
    logger.error({ error }, 'Failed to create refund')
    return errorResponse(error)
  }
}

export async function GET(req: NextRequest) {
  try {
    const { page, limit } = getPaginationParams(req)
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')

    const where: any = {}
    if (orderId) {
      where.orderId = orderId
    }

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        include: {
          order: { select: { orderNumber: true } },
          payment: { select: { cardBrand: true, cardLast4: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.refund.count({ where }),
    ])

    return successResponse({
      data: refunds,
      pagination: paginationMeta(total, page, limit),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
