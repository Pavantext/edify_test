import { NextRequest, NextResponse } from 'next/server'
import { chatMessageSchema } from '@/schemas/chat-schema'
import { auth } from '@clerk/nextjs/server'
import { APIError, handleAPIError } from '@/lib/api-error'
import { getUserSessions, generateResponse } from '@/lib/chat-service'
import { createServiceClient } from '@/utils/supabase/service'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from "@/utils/supabase/server";

const supabase = createServiceClient();

type RouteParams = {
  params: Promise<{}>;
};

export const maxDuration = 299 // Set maximum duration to 299 seconds

export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, model, sessionId, messageId } = await request.json()

    // Validate required fields
    if (!message || !model || !sessionId || !messageId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient();
    const startTime = Date.now();

    try {
      console.log('Calling generateResponse with sessionId:', sessionId);
      const stream = await generateResponse(
        message, 
        model, 
        userId,
        sessionId,
        messageId || uuidv4()
      )
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
      })
    } catch (error) {
      console.error('Generate response error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate response'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('API route error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const status = 
      errorMessage.includes('personal information') ? 400 :
      errorMessage.includes('safety policy') ? 403 :
      errorMessage.includes('prompt injection') ? 400 : 500

    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient();
    const { data: sessions, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
} 