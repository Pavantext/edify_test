import { NextResponse } from "next/server";
import { config } from "@/lib/api-config";

export async function GET() {
  try {
    // Check if API keys are configured
    if (!config.openai.apiKey || !config.gemini.apiKey) {
      return NextResponse.json(
        { error: "API configuration is incomplete" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { error: "API service is unavailable" },
      { status: 500 }
    );
  }
} 