/**
 * POST /api/v1/webhooks/shift4
 * Shift4 webhook receiver
 *
 * IMPORTANT: This endpoint receives webhook events from Shift4.
 * Always fetch the full event from Shift4 API before processing to ensure authenticity.
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { createShift4Adapter } from '@/payments'
import { logger, paymentLogger } from '@/payments/logger'

export async function POST(req: NextRequest) {
  try {
    // Parse webhook payload
    const payload = await req.json()

    const eventId = payload.id || payload.eventId
    const eventType = payload.type

    if (!eventId || !eventType) {
      return errorResponse(new Error('Invalid webhook payload'), 400)
    }

    paymentLogger.webhookReceived(eventId, eventType)

    // Check if we've already processed this event (idempotency)
    const existing = await prisma.webhookEvent.findUnique({
      where: { eventId },
    })

    if (existing && existing.processed) {
      logger.info({ eventId }, 'Webhook event already processed')
      return new Response('OK', { status: 200 })
    }

    // Store raw event
    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        eventType,
        payload,
        processed: false,
        receivedAt: new Date(),
      },
      update: {
        retryCount: { increment: 1 },
      },
    })

    // Process event asynchronously
    // In production, use a job queue (e.g., BullMQ, Inngest, etc.)
    processWebhookEvent(webhookEvent.id, eventId, eventType).catch((error) => {
      logger.error({ error, eventId }, 'Webhook processing failed')
    })

    // Return 200 immediately to acknowledge receipt
    return new Response('OK', { status: 200 })
  } catch (error) {
    logger.error({ error }, 'Webhook receiver error')
    return errorResponse(error)
  }
}

/**
 * Process webhook event
 * Fetches the full event from Shift4 and processes it
 */
async function processWebhookEvent(
  webhookEventId: string,
  eventId: string,
  eventType: string
) {
  try {
    // Fetch full event from Shift4 API (best practice for security)
    // TODO: Implement getEvent in Shift4 adapter
    // const shift4 = createShift4Adapter()
    // const event = await shift4.getEvent(eventId)

    // For now, get event from database
    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    })

    if (!webhookEvent) {
      throw new Error('Webhook event not found')
    }

    const data = webhookEvent.payload

    // Process based on event type
    switch (eventType) {
      case 'charge.succeeded':
        await handleChargeSucceeded(data)
        break

      case 'charge.failed':
        await handleChargeFailed(data)
        break

      case 'charge.captured':
        await handleChargeCaptured(data)
        break

      case 'charge.refunded':
        await handleChargeRefunded(data)
        break

      case 'charge.dispute.created':
        await handleDisputeCreated(data)
        break

      case 'charge.dispute.closed':
        await handleDisputeClosed(data)
        break

      case 'refund.succeeded':
        await handleRefundSucceeded(data)
        break

      case 'refund.failed':
        await handleRefundFailed(data)
        break

      case 'payout.created':
      case 'payout.paid':
        await handlePayout(data)
        break

      default:
        logger.info({ eventType }, 'Unhandled webhook event type')
    }

    // Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    })

    paymentLogger.webhookProcessed(eventId, eventType)
  } catch (error) {
    // Log error and update webhook event
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        processingError: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    paymentLogger.webhookFailed(
      eventId,
      eventType,
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw error
  }
}

// ==================== Event Handlers ====================

async function handleChargeSucceeded(data: any) {
  const chargeId = data.data?.id || data.id

  // Update payment status
  await prisma.payment.updateMany({
    where: { shift4ChargeId: chargeId },
    data: { status: 'CAPTURED' },
  })

  logger.info({ chargeId }, 'Charge succeeded')
}

async function handleChargeFailed(data: any) {
  const chargeId = data.data?.id || data.id

  await prisma.payment.updateMany({
    where: { shift4ChargeId: chargeId },
    data: { status: 'FAILED' },
  })

  logger.info({ chargeId }, 'Charge failed')
}

async function handleChargeCaptured(data: any) {
  const chargeId = data.data?.id || data.id

  await prisma.payment.updateMany({
    where: { shift4ChargeId: chargeId },
    data: {
      status: 'CAPTURED',
      capturedAt: new Date(),
    },
  })

  logger.info({ chargeId }, 'Charge captured')
}

async function handleChargeRefunded(data: any) {
  const chargeId = data.data?.id || data.id
  const refundId = data.data?.refunds?.[0]?.id

  // Update payment
  await prisma.payment.updateMany({
    where: { shift4ChargeId: chargeId },
    data: { status: 'REFUNDED' },
  })

  // Update refund if exists
  if (refundId) {
    await prisma.refund.updateMany({
      where: { shift4RefundId: refundId },
      data: {
        status: 'SUCCEEDED',
        processedAt: new Date(),
      },
    })
  }

  logger.info({ chargeId, refundId }, 'Charge refunded')
}

async function handleRefundSucceeded(data: any) {
  const refundId = data.data?.id || data.id

  await prisma.refund.updateMany({
    where: { shift4RefundId: refundId },
    data: {
      status: 'SUCCEEDED',
      processedAt: new Date(),
    },
  })

  logger.info({ refundId }, 'Refund succeeded')
}

async function handleRefundFailed(data: any) {
  const refundId = data.data?.id || data.id

  await prisma.refund.updateMany({
    where: { shift4RefundId: refundId },
    data: {
      status: 'FAILED',
      failureMessage: data.data?.failureMessage,
    },
  })

  logger.info({ refundId }, 'Refund failed')
}

async function handleDisputeCreated(data: any) {
  const disputeId = data.data?.id || data.id
  const chargeId = data.data?.chargeId

  // Find payment
  const payment = await prisma.payment.findFirst({
    where: { shift4ChargeId: chargeId },
  })

  if (!payment) {
    logger.warn({ chargeId }, 'Payment not found for dispute')
    return
  }

  // Create dispute record
  await prisma.dispute.create({
    data: {
      orderId: payment.orderId,
      shift4DisputeId: disputeId,
      shift4ChargeId: chargeId,
      amount: data.data?.amount || payment.amount,
      currency: data.data?.currency || payment.currency,
      status: 'NEEDS_RESPONSE',
      reason: data.data?.reason || 'unknown',
      evidenceDeadline: data.data?.evidenceDeadline
        ? new Date(data.data.evidenceDeadline * 1000)
        : null,
    },
  })

  logger.info({ disputeId, chargeId }, 'Dispute created')
}

async function handleDisputeClosed(data: any) {
  const disputeId = data.data?.id || data.id
  const status = data.data?.status

  await prisma.dispute.updateMany({
    where: { shift4DisputeId: disputeId },
    data: {
      status: status === 'won' ? 'WON' : 'LOST',
      resolvedAt: new Date(),
      resolution: data.data?.outcome,
    },
  })

  logger.info({ disputeId, status }, 'Dispute closed')
}

async function handlePayout(data: any) {
  const payoutId = data.data?.id || data.id

  // Upsert payout
  await prisma.payout.upsert({
    where: { shift4PayoutId: payoutId },
    create: {
      shift4PayoutId: payoutId,
      amount: data.data?.amount || 0,
      currency: data.data?.currency || 'usd',
      status: data.type === 'payout.paid' ? 'PAID' : 'PENDING',
      arrivalDate: data.data?.arrivalDate
        ? new Date(data.data.arrivalDate * 1000)
        : null,
      description: data.data?.description,
    },
    update: {
      status: data.type === 'payout.paid' ? 'PAID' : 'PENDING',
    },
  })

  logger.info({ payoutId }, 'Payout processed')
}
