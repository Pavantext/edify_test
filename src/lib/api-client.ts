import OpenAI from "openai";
import { config } from "./api-config";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function generateAIResponse<T>({
  prompt,
  schema,
}: {
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Use UK english only and do not use convoluted language." +
            "You are a professional curriculum developer who creates detailed lesson plans. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("No response generated from AI");
    }

    try {
      // Parse the response text as JSON
      const jsonResponse = JSON.parse(responseText);

      // Validate against schema
      const validatedResponse = schema.parse(jsonResponse);

      return validatedResponse;
    } catch (parseError) {
      console.error("Error parsing response:", parseError);
      throw new Error("Failed to parse AI response as valid JSON");
    }
  } catch (error) {
    console.error("Error in generateAIResponse:", error);
    throw error;
  }
}
