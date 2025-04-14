import { createClient } from '@supabase/supabase-js';
import { auth, currentUser } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function createAIToolUsage({
  userId,
  orgId,
  promptId,
  toolType,
  metadata,
}: {
  userId: string;
  orgId: string;
  promptId: string;
  toolType: string;
  metadata?: any;
}) {
  const { data: toolUsage, error } = await supabase
    .from('ai_tool_usage')
    .insert([
      { user_id: userId, org_id: orgId, prompt_id: promptId, tool_type: toolType, metadata }
    ])
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('ai_usage_log')
    .insert([
      { 
        tool_usage_id: toolUsage.id,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString()
      }
    ]);

  return toolUsage;
}

export async function logToolAccess({ toolUsageId }: { toolUsageId: string }) {
  const { data, error } = await supabase
    .from('ai_usage_log')
    .insert([
      { 
        tool_usage_id: toolUsageId,
        accessed_at: new Date().toISOString()
      }
    ])
    .select();

  if (error) throw error;
  return data;
}

export async function updateToolUsageMetadata(userId: string) {
  try {
    const user = await currentUser();
    const metadata = {
      role: user?.publicMetadata?.role as string,
      subjects: user?.unsafeMetadata?.subjects as string[]
    };

    const { error } = await supabase
      .from('ai_tool_usage')
      .update({ metadata })
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error updating metadata:", error);
    throw error;
  }
}
