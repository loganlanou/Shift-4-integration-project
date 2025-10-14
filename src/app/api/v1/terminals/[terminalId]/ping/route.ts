/**
 * POST /api/v1/terminals/[terminalId]/ping
 * Test terminal connectivity
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { createUTGAdapter, createSkyTabAdapter } from '@/payments'

export async function POST(
  req: NextRequest,
  { params }: { params: { terminalId: string } }
) {
  try {
    const terminal = await prisma.terminal.findUnique({
      where: { id: params.terminalId },
    })

    if (!terminal) {
      return errorResponse(new Error('Terminal not found'), 404)
    }

    // Create client
    const client =
      terminal.type === 'UTG'
        ? createUTGAdapter(terminal.id)
        : createSkyTabAdapter(terminal.id, terminal.apiTerminalId)

    // Ping terminal
    const result = await client.ping()

    // Update last ping
    if (result.online) {
      await prisma.terminal.update({
        where: { id: terminal.id },
        data: {
          lastPingAt: new Date(),
          status: 'ACTIVE',
        },
      })
    } else {
      await prisma.terminal.update({
        where: { id: terminal.id },
        data: { status: 'OFFLINE' },
      })
    }

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
