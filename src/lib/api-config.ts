if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error("Missing GOOGLE_GEMINI_API_KEY environment variable");
}

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o", // or your preferred model
  },
  gemini: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    model: "gemini-pro", // or your preferred model
  },
} as const;
