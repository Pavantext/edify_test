import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAIToolUsage, logToolAccess } from "@/lib/ai-tools";

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { promptId, toolType, metadata } = await req.json();

    const usage = await createAIToolUsage({
      userId,
      orgId,
      promptId,
      toolType,
      metadata,
    });

    return NextResponse.json(usage);
  } catch (error) {
    console.error("[AI_TOOL_USAGE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 