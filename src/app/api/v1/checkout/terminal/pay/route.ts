/**
 * POST /api/v1/checkout/terminal/pay
 * Start a terminal payment
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  errorResponse,
  successResponse,
  parseBody,
  generateIdempotencyKey,
} from '@/lib/api-utils'
import { createUTGAdapter, createSkyTabAdapter } from '@/payments'
import { logger, paymentLogger } from '@/payments/logger'
import { nanoid } from 'nanoid'

interface TerminalPayRequest {
  terminalId: string
  orderId: string
  amount: number
  currency?: string
  tipMode?: 'prompt' | 'none' | 'fixed'
  fixedTipAmount?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<TerminalPayRequest>(req)

    // Get terminal
    const terminal = await prisma.terminal.findUnique({
      where: { id: body.terminalId },
    })

    if (!terminal) {
      return errorResponse(new Error('Terminal not found'), 404)
    }

    if (terminal.status !== 'ACTIVE') {
      return errorResponse(new Error('Terminal is not active'), 400)
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
    })

    if (!order) {
      return errorResponse(new Error('Order not found'), 404)
    }

    // Create terminal client
    const terminalClient =
      terminal.type === 'UTG'
        ? createUTGAdapter(terminal.id)
        : createSkyTabAdapter(terminal.id, terminal.apiTerminalId)

    // Generate transaction ID
    const transactionId = nanoid()

    // Log terminal transaction start
    await prisma.terminalTransaction.create({
      data: {
        terminalId: terminal.id,
        transactionId,
        requestType: 'payment',
        amount: body.amount,
        currency: body.currency || 'usd',
        requestData: {
          orderId: body.orderId,
          tipMode: body.tipMode,
        },
        startedAt: new Date(),
      },
    })

    paymentLogger.terminalPaymentStarted(terminal.id, body.amount, transactionId)

    // Start payment (async - runs in background)
    // In a real app, this would be handled by a background job/queue
    terminalClient
      .startPayment({
        terminalId: terminal.id,
        amount: body.amount,
        currency: body.currency || 'usd',
        orderId: body.orderId,
        tipMode: body.tipMode || 'none',
        fixedTipAmount: body.fixedTipAmount,
      })
      .then(async (result) => {
        // Update transaction log
        await prisma.terminalTransaction.update({
          where: { transactionId },
          data: {
            approved: result.approved,
            responseCode: result.responseCode,
            responseMessage: result.responseMessage,
            authCode: result.authCode,
            token: result.token,
            responseData: result,
            completedAt: new Date(),
            durationMs: Date.now() - new Date().getTime(),
          },
        })

        if (result.approved) {
          // Create payment record
          const idempotencyKey = generateIdempotencyKey('term')
          await prisma.payment.create({
            data: {
              orderId: body.orderId,
              shift4ChargeId: result.token, // Use token as charge reference
              amount: result.totalAmount,
              currency: body.currency || 'usd',
              status: 'CAPTURED',
              methodType: 'CARD_TERMINAL',
              cardBrand: result.cardBrand,
              cardLast4: result.cardLast4,
              terminalId: terminal.id,
              authCode: result.authCode,
              entryMode: result.entryMode,
              emvData: result.emvData,
              idempotencyKey,
              capturedAt: new Date(),
              metadata: {
                transactionId,
                tipAmount: result.tipAmount,
              },
            },
          })

          // Update order
          await prisma.order.update({
            where: { id: body.orderId },
            data: { status: 'PAID' },
          })

          paymentLogger.terminalPaymentCompleted(terminal.id, transactionId, true)
        } else {
          paymentLogger.terminalPaymentCompleted(terminal.id, transactionId, false)
        }
      })
      .catch(async (error) => {
        logger.error({ error, transactionId }, 'Terminal payment failed')

        await prisma.terminalTransaction.update({
          where: { transactionId },
          data: {
            approved: false,
            responseMessage: error.message,
            completedAt: new Date(),
          },
        })
      })

    return successResponse({
      transactionId,
      status: 'pending',
    })
  } catch (error) {
    logger.error({ error }, 'Failed to start terminal payment')
    return errorResponse(error)
  }
}
