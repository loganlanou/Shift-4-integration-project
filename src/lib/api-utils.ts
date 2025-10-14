/**
 * API utility functions
 */

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { PaymentError } from '@/payments/errors'

export interface ApiError {
  code: string
  message: string
  details?: any
}

export function errorResponse(error: unknown, status: number = 500): NextResponse {
  if (error instanceof PaymentError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    )
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
        },
      },
      { status }
    )
  }

  return NextResponse.json(
    {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      },
    },
    { status }
  )
}

export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export async function parseBody<T>(req: NextRequest): Promise<T> {
  try {
    return await req.json()
  } catch {
    throw new Error('Invalid JSON body')
  }
}

export function generateIdempotencyKey(prefix: string = 'idem'): string {
  return `${prefix}_${nanoid(24)}`
}

export function generateOrderNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = nanoid(6).toUpperCase()
  return `ORD-${year}${month}${day}-${random}`
}

export interface PaginationParams {
  page: number
  limit: number
}

export function getPaginationParams(req: NextRequest): PaginationParams {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

  return { page, limit }
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}
