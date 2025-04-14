import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { updateToolUsageMetadata } from "@/lib/ai-tools";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await updateToolUsageMetadata(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[METADATA_UPDATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update metadata" },
      { status: 500 }
    );
  }
} 