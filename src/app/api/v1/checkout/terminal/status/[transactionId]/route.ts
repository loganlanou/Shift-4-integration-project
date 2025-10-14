/**
 * GET /api/v1/checkout/terminal/status/[transactionId]
 * Get terminal transaction status
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const { transactionId } = params

    // Get transaction from database
    const transaction = await prisma.terminalTransaction.findUnique({
      where: { transactionId },
      include: {
        terminal: true,
      },
    })

    if (!transaction) {
      return errorResponse(new Error('Transaction not found'), 404)
    }

    // Determine status
    let status: string
    if (!transaction.completedAt) {
      status = 'pending'
    } else if (transaction.approved) {
      status = 'approved'
    } else if (transaction.responseCode === 'CA') {
      status = 'cancelled'
    } else if (transaction.responseCode === 'TO') {
      status = 'timeout'
    } else {
      status = 'declined'
    }

    // If approved, get payment details
    let result = null
    if (transaction.approved) {
      const payment = await prisma.payment.findFirst({
        where: {
          metadata: {
            path: ['transactionId'],
            equals: transactionId,
          },
        },
      })

      if (payment) {
        result = {
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          card: {
            brand: payment.cardBrand,
            last4: payment.cardLast4,
          },
          authCode: payment.authCode,
          createdAt: payment.createdAt,
        }
      }
    }

    return successResponse({
      transactionId,
      status,
      approved: transaction.approved,
      result,
      error: !transaction.approved ? transaction.responseMessage : undefined,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
