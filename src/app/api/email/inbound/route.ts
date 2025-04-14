import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { sendStatusUpdateEmail } from "@/lib/services/email/moderationEmails";

export async function POST(request: Request) {
    try {
        const emailData = await request.json();
        
        // Extract the subject and content ID
        const subject = emailData.subject;
        if (!subject) {
            return NextResponse.json({ error: "Missing subject" }, { status: 400 });
        }

        // Parse the action and content ID from the subject
        const [action, contentId] = subject.split('-');
        if (!action || !contentId) {
            return NextResponse.json({ error: "Invalid subject format" }, { status: 400 });
        }

        // Normalize the action
        const normalizedAction = action.trim().toLowerCase();
        if (normalizedAction !== 'approve' && normalizedAction !== 'decline') {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // Convert action to database format
        const moderatorApproval = normalizedAction === 'approve' ? 'approved' : 'declined';

        const supabase = await createClient();

        // Get the content data first
        const { data: contentData, error: contentError } = await supabase
            .from("ai_tools_metrics")
            .select(`
                user_id,
                prompt_type,
                prompt_id,
                content_flags
            `)
            .eq("id", contentId)
            .single();

        if (contentError || !contentData) {
            return NextResponse.json({ error: "Content not found" }, { status: 404 });
        }

        // Update the moderation status
        const { error: updateError } = await supabase
            .from("ai_tools_metrics")
            .update({
                moderator_approval: moderatorApproval,
                moderation_updated_at: new Date().toISOString(),
                moderator_id: emailData.from // Using the sender's email as moderator ID
            })
            .eq("id", contentId);

        if (updateError) {
            return NextResponse.json({ error: "Error updating content status" }, { status: 500 });
        }

        // Get user's details for email notification
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("email, username")
            .eq("id", contentData.user_id)
            .single();

        if (!userError && userData) {
            // Get chat title
            const { data: chatData } = await supabase
                .from("chat_metrics")
                .select("prompt_text")
                .eq("id", contentData.prompt_id)
                .single();

            const chatTitle = chatData?.prompt_text || "Untitled Chat";

            // Process violations
            const violations = Object.entries(contentData.content_flags || {})
                .filter(([_, value]) => value === true)
                .map(([key]) => {
                    const type = key.replace(/_/g, ' ')
                        .replace(/detected|violation/g, '')
                        .trim()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');

                    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
                    if (key.includes('critical') || key.includes('child_safety') || key.includes('extremist')) {
                        severity = 'critical';
                    } else if (key.includes('high') || key.includes('prompt_injection') || key.includes('pii')) {
                        severity = 'high';
                    } else if (key.includes('low')) {
                        severity = 'low';
                    }
                    return { type, severity };
                });

            // Send status update email to user
            await sendStatusUpdateEmail(userData.email, {
                username: userData.username,
                contentId,
                status: moderatorApproval,
                toolType: contentData.prompt_type,
                chatTitle,
                requestId: contentId,
                violations,
                notes: emailData.text // Include any additional notes from the email body
            });
        }

        return NextResponse.json({
            success: true,
            message: `Content ${moderatorApproval} successfully`
        });

    } catch (error) {
        console.error("Error processing inbound email:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
} 