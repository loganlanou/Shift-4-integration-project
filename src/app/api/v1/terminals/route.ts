/**
 * Terminal management endpoints
 * GET /api/v1/terminals - List terminals
 * POST /api/v1/terminals - Create terminal
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, parseBody } from '@/lib/api-utils'
import { logger } from '@/payments/logger'

interface CreateTerminalRequest {
  name: string
  type: 'UTG' | 'SKYTAB'
  apiTerminalId: string
  ipAddress?: string
  port?: number
  config?: any
  locationName?: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status

    const terminals = await prisma.terminal.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return successResponse(terminals)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<CreateTerminalRequest>(req)

    // Validate
    if (!body.name || !body.type || !body.apiTerminalId) {
      return errorResponse(new Error('Missing required fields'), 400)
    }

    // Check if API terminal ID already exists
    const existing = await prisma.terminal.findUnique({
      where: { apiTerminalId: body.apiTerminalId },
    })

    if (existing) {
      return errorResponse(
        new Error('Terminal with this API ID already exists'),
        400
      )
    }

    // Create terminal
    const terminal = await prisma.terminal.create({
      data: {
        name: body.name,
        type: body.type,
        apiTerminalId: body.apiTerminalId,
        ipAddress: body.ipAddress,
        port: body.port,
        config: body.config || {},
        locationName: body.locationName,
        status: 'ACTIVE',
        supportsEMV: true,
        supportsNFC: body.type === 'SKYTAB',
        supportsTipping: true,
      },
    })

    logger.info({ terminalId: terminal.id, type: terminal.type }, 'Terminal created')

    return successResponse(terminal, 201)
  } catch (error) {
    logger.error({ error }, 'Failed to create terminal')
    return errorResponse(error)
  }
}
