import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { APIError, handleAPIError } from '@/lib/api-error'
import { createSession, getUserSessions } from '@/lib/chat-service'
import { chatSessionSchema } from '@/schemas/chat-schema'

// Define the params type for static route
type RouteParams = {
  params: Promise<{}>
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) throw new APIError('Unauthorized', 401)

    const body = await request.json()
    const { title, model } = chatSessionSchema.parse(body)

    const session = await createSession(userId, title, model)
    return NextResponse.json(session)
  } catch (error) {
    return NextResponse.json(
      handleAPIError(error),
      { status: error instanceof APIError ? error.status : 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) throw new APIError('Unauthorized', 401)

    const sessions = await getUserSessions(userId)
    return NextResponse.json(sessions)
  } catch (error) {
    return NextResponse.json(
      handleAPIError(error),
      { status: error instanceof APIError ? error.status : 500 }
    )
  }
} 