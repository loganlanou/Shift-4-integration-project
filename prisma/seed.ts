import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clean existing data in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...')
    await prisma.auditLog.deleteMany()
    await prisma.payoutLine.deleteMany()
    await prisma.payout.deleteMany()
    await prisma.webhookEvent.deleteMany()
    await prisma.dispute.deleteMany()
    await prisma.refund.deleteMany()
    await prisma.terminalTransaction.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.terminal.deleteMany()
    await prisma.order.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.user.deleteMany()
    await prisma.idempotencyKey.deleteMany()
  }

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      phone: '+1234567890',
    },
  })
  console.log('✅ Created test user:', testUser.email)

  // Create customer
  const customer = await prisma.customer.create({
    data: {
      userId: testUser.id,
      shift4CustomerId: 'cust_test_123456',
      defaultCardToken: 'tok_test_card_visa',
      cardBrand: 'Visa',
      cardLast4: '4242',
      cardExpMonth: 12,
      cardExpYear: 2025,
    },
  })
  console.log('✅ Created customer with saved card')

  // Create sample terminals
  const utgTerminal = await prisma.terminal.create({
    data: {
      name: 'Front Counter Terminal',
      type: 'UTG',
      status: 'ACTIVE',
      apiTerminalId: 'TERM_001',
      ipAddress: '192.168.1.100',
      port: 8333,
      config: {
        timeout: 60000,
        retryAttempts: 2,
        enableTipping: true,
      },
      supportsEMV: true,
      supportsNFC: true,
      supportsTipping: true,
      locationName: 'Main Store - Front Counter',
      lastPingAt: new Date(),
    },
  })
  console.log('✅ Created UTG terminal:', utgTerminal.name)

  const skytabTerminal = await prisma.terminal.create({
    data: {
      name: 'Mobile Terminal',
      type: 'SKYTAB',
      status: 'ACTIVE',
      apiTerminalId: 'SKYTAB_001',
      config: {
        deviceId: 'device_123',
        enableSignature: true,
      },
      supportsEMV: true,
      supportsNFC: true,
      supportsTipping: true,
      locationName: 'Main Store - Mobile',
      lastPingAt: new Date(),
    },
  })
  console.log('✅ Created SkyTab terminal:', skytabTerminal.name)

  // Create sample orders with different statuses
  const orders = await Promise.all([
    // Completed order with online payment
    prisma.order.create({
      data: {
        orderNumber: 'ORD-2024-0001',
        userId: testUser.id,
        status: 'COMPLETED',
        subtotal: 5000,
        tax: 450,
        shipping: 500,
        total: 5950,
        currency: 'usd',
        items: [
          { sku: 'PROD-001', name: 'Product 1', quantity: 2, price: 2500 },
        ],
        payments: {
          create: {
            customerId: customer.id,
            shift4ChargeId: 'ch_test_completed_001',
            amount: 5950,
            currency: 'usd',
            status: 'CAPTURED',
            methodType: 'CARD_ONLINE',
            cardBrand: 'Visa',
            cardLast4: '4242',
            cardExpMonth: 12,
            cardExpYear: 2025,
            idempotencyKey: 'idem_test_001',
            capturedAt: new Date(),
          },
        },
      },
    }),

    // Pending order with terminal payment
    prisma.order.create({
      data: {
        orderNumber: 'ORD-2024-0002',
        userId: testUser.id,
        status: 'PAID',
        subtotal: 3000,
        tax: 270,
        total: 3270,
        currency: 'usd',
        items: [
          { sku: 'PROD-002', name: 'Product 2', quantity: 1, price: 3000 },
        ],
        payments: {
          create: {
            shift4ChargeId: 'ch_test_terminal_001',
            amount: 3270,
            currency: 'usd',
            status: 'CAPTURED',
            methodType: 'CARD_TERMINAL',
            cardBrand: 'Mastercard',
            cardLast4: '5555',
            terminalId: utgTerminal.id,
            authCode: 'AUTH123',
            entryMode: 'chip',
            idempotencyKey: 'idem_test_002',
            capturedAt: new Date(),
          },
        },
      },
    }),

    // Refunded order
    prisma.order.create({
      data: {
        orderNumber: 'ORD-2024-0003',
        userId: testUser.id,
        status: 'REFUNDED',
        subtotal: 10000,
        tax: 900,
        total: 10900,
        refundedTotal: 10900,
        currency: 'usd',
        payments: {
          create: {
            customerId: customer.id,
            shift4ChargeId: 'ch_test_refunded_001',
            amount: 10900,
            currency: 'usd',
            status: 'REFUNDED',
            methodType: 'CARD_ONLINE',
            cardBrand: 'Visa',
            cardLast4: '4242',
            idempotencyKey: 'idem_test_003',
            capturedAt: new Date(Date.now() - 86400000),
            refunds: {
              create: {
                shift4RefundId: 'ref_test_001',
                amount: 10900,
                currency: 'usd',
                status: 'SUCCEEDED',
                reason: 'Customer requested',
                idempotencyKey: 'idem_refund_001',
                processedAt: new Date(),
              },
            },
          },
        },
      },
    }),
  ])
  console.log(`✅ Created ${orders.length} sample orders`)

  // Create sample webhook events
  await prisma.webhookEvent.createMany({
    data: [
      {
        eventId: 'evt_test_001',
        eventType: 'charge.succeeded',
        payload: { type: 'charge.succeeded', data: { id: 'ch_test_completed_001' } },
        processed: true,
        processedAt: new Date(),
      },
      {
        eventId: 'evt_test_002',
        eventType: 'charge.captured',
        payload: { type: 'charge.captured', data: { id: 'ch_test_completed_001' } },
        processed: true,
        processedAt: new Date(),
      },
      {
        eventId: 'evt_test_003',
        eventType: 'refund.succeeded',
        payload: { type: 'refund.succeeded', data: { id: 'ref_test_001' } },
        processed: true,
        processedAt: new Date(),
      },
    ],
  })
  console.log('✅ Created sample webhook events')

  // Create sample payout
  const payout = await prisma.payout.create({
    data: {
      shift4PayoutId: 'po_test_001',
      amount: 18220,
      currency: 'usd',
      status: 'PAID',
      arrivalDate: new Date(),
      description: 'Daily payout',
      reconciled: true,
      reconciledAt: new Date(),
      lines: {
        createMany: {
          data: [
            {
              type: 'charge',
              amount: 5950,
              currency: 'usd',
              shift4ChargeId: 'ch_test_completed_001',
              orderId: orders[0].id,
              fee: 173,
              net: 5777,
              description: 'Payment for ORD-2024-0001',
            },
            {
              type: 'charge',
              amount: 3270,
              currency: 'usd',
              shift4ChargeId: 'ch_test_terminal_001',
              orderId: orders[1].id,
              fee: 95,
              net: 3175,
              description: 'Payment for ORD-2024-0002',
            },
            {
              type: 'charge',
              amount: 10900,
              currency: 'usd',
              shift4ChargeId: 'ch_test_refunded_001',
              orderId: orders[2].id,
              fee: 316,
              net: 10584,
              description: 'Payment for ORD-2024-0003',
            },
            {
              type: 'refund',
              amount: -10900,
              currency: 'usd',
              shift4RefundId: 'ref_test_001',
              orderId: orders[2].id,
              fee: -316,
              net: -10584,
              description: 'Refund for ORD-2024-0003',
            },
          ],
        },
      },
    },
  })
  console.log('✅ Created sample payout with line items')

  console.log('🎉 Database seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
