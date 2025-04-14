import { NextRequest, NextResponse } from 'next/server'
import { getSession, addMessage } from '@/lib/chat-service'
import { chatMessageSchema } from '@/schemas/chat-schema'
import { auth } from '@clerk/nextjs/server'
import { APIError, handleAPIError } from '@/lib/api-error'

// Define the params type
type RouteParams = {
  params: Promise<{
    sessionId: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) throw new APIError('Unauthorized', 401)

    const { sessionId } = await params
    const session = await getSession(sessionId, userId)
    return NextResponse.json(session)
  } catch (error) {
    return NextResponse.json(handleAPIError(error), { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) throw new APIError('Unauthorized', 401)

    const body = await request.json()
    const message = chatMessageSchema.parse(body)
    const { sessionId } = await params

    const updatedSession = await addMessage(sessionId, message)
    return NextResponse.json(updatedSession)
  } catch (error) {
    return NextResponse.json(handleAPIError(error), { status: 500 })
  }
} 