import { createServiceClient } from "@/utils/supabase/service";
import type { ChatMetrics, ContentFlags } from "@/schemas/metrics-schema";
import { calculateGBPPrice } from "./exchange-service";

const supabase = createServiceClient();

export interface ChatMetricsParams {
  userId: string;
  sessionId: string;
  model: string;
  input_length: number;
  response_length: number;
  startTime: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  price_gbp: number;
  contentFlags: ContentFlags;
  error_type?: string;
  status_code?: number;
  prompt_id?: string | null;
}

export async function recordChatMetrics(params: ChatMetricsParams): Promise<void> {
  try {
    // Ensure price is a valid number and has correct precision
    const price = params.price_gbp ? Number(params.price_gbp.toFixed(6)) : 0;
    console.log('Metrics Service - Price Processing:', {
      receivedPrice: params.price_gbp,
      formattedPrice: price,
      type: typeof price
    });

    // Add logging for content flags
    console.log('Metrics Service - Content Flags:', {
      flags: params.contentFlags,
      userId: params.userId,
      sessionId: params.sessionId,
      promptId: params.prompt_id
    });

    const metricsRecord = {
      user_id: params.userId,
      session_id: params.sessionId,
      model: params.model,
      input_length: Math.round(params.input_length),
      response_length: Math.round(params.response_length),
      duration_ms: Math.round(Date.now() - params.startTime.getTime()),
      input_tokens: Math.round(params.inputTokens),
      output_tokens: Math.round(params.outputTokens),
      total_tokens: Math.round(params.totalTokens),
      price_gbp: price,
      content_flags: { ...params.contentFlags },
      error_type: params.error_type,
      status_code: params.status_code,
      prompt_id: params.prompt_id || undefined,
      timestamp: new Date().toISOString()
    };

    // Log the full record before insertion
    console.log('Metrics Service - Database Record:', {
      price_gbp: metricsRecord.price_gbp,
      input_tokens: metricsRecord.input_tokens,
      output_tokens: metricsRecord.output_tokens
    });

    const { data, error: dbError } = await supabase
      .from("chat_metrics")
      .insert(metricsRecord)
      .select('id, price_gbp, input_tokens, output_tokens, content_flags');

    if (dbError) {
      console.error("Metrics Service - Database Error:", {
        error: dbError,
        contentFlags: params.contentFlags,
        record: metricsRecord
      });
      throw dbError;
    }

    console.log('Metrics Service - Inserted Data:', data);
  } catch (error) {
    console.error("Metrics Service - Failed to record:", error);
    throw error;
  }
}