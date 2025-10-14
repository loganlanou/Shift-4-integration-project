/**
 * Terminal detail endpoints
 * GET /api/v1/terminals/[terminalId] - Get terminal
 * PUT /api/v1/terminals/[terminalId] - Update terminal
 * DELETE /api/v1/terminals/[terminalId] - Delete terminal
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, parseBody } from '@/lib/api-utils'

export async function GET(
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

    return successResponse(terminal)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { terminalId: string } }
) {
  try {
    const body = await parseBody<any>(req)

    const terminal = await prisma.terminal.update({
      where: { id: params.terminalId },
      data: {
        name: body.name,
        ipAddress: body.ipAddress,
        port: body.port,
        config: body.config,
        locationName: body.locationName,
        status: body.status,
      },
    })

    return successResponse(terminal)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { terminalId: string } }
) {
  try {
    await prisma.terminal.delete({
      where: { id: params.terminalId },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
