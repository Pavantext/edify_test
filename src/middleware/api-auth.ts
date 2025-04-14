import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check if we're hitting an API route
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Verify environment variables are set
    if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API configuration is incomplete" },
        { status: 500 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};