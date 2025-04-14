import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { createHmac } from 'crypto';
import { sendStatusUpdateEmail } from "@/lib/services/email/moderationEmails";
import { headers } from 'next/headers';

const SECRET_KEY = process.env.EMAIL_ACTION_SECRET || 'your-secret-key';

function generateToken(contentId: string, action: string, moderatorId: string): string {
    const hmac = createHmac('sha256', SECRET_KEY);
    hmac.update(`${contentId}:${action}:${moderatorId}`);
    return hmac.digest('hex');
}

function verifyToken(token: string, contentId: string, action: string, moderatorId: string): boolean {
    const expectedToken = generateToken(contentId, action, moderatorId);
    return token === expectedToken;
}

function generateHTMLResponse(success: boolean, message: string, action?: string) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.aiedify.com';
    const color = success ? '#34A853' : '#EA4335';
    const icon = success 
        ? '✓' 
        : '✕';
    const title = success 
        ? `Content ${action === 'approved' ? 'Approved' : 'Declined'} Successfully` 
        : 'Error Processing Request';

    return new Response(`<!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background-color: #f8f9fa;
                }
                .container {
                    text-align: center;
                    padding: 2rem;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    max-width: 400px;
                    width: 90%;
                }
                .icon {
                    font-size: 48px;
                    color: ${color};
                    margin-bottom: 1rem;
                }
                .title {
                    color: #202124;
                    font-size: 24px;
                    margin-bottom: 1rem;
                }
                .message {
                    color: #5f6368;
                    margin-bottom: 2rem;
                }
                .button {
                    background-color: #1a73e8;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 4px;
                    text-decoration: none;
                    font-weight: bold;
                    display: inline-block;
                }
                .button:hover {
                    background-color: #1557b0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">${icon}</div>
                <h1 class="title">${title}</h1>
                <p class="message">${message}</p>
                <a href="${baseUrl}/dashboard/moderator" class="button">
                    Return to Dashboard
                </a>
            </div>
        </body>
        </html>`, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contentId = searchParams.get('id');
        const action = searchParams.get('action');
        const moderatorId = searchParams.get('moderatorId');
        const token = searchParams.get('token');

        if (!contentId || !action || !moderatorId || !token) {
            return generateHTMLResponse(false, "Missing required parameters");
        }

        // Verify the token
        if (!verifyToken(token, contentId, action, moderatorId)) {
            return generateHTMLResponse(false, "Invalid or expired token");
        }

        // Validate action
        if (action !== 'approved' && action !== 'declined') {
            return generateHTMLResponse(false, "Invalid action");
        }

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
            return generateHTMLResponse(false, "Content not found");
        }

        // Update the moderation status
        const { error: updateError } = await supabase
            .from("ai_tools_metrics")
            .update({
                moderator_approval: action,
                moderation_updated_at: new Date().toISOString(),
                moderator_id: moderatorId
            })
            .eq("id", contentId);

        if (updateError) {
            return generateHTMLResponse(false, "Error updating content status");
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
                status: action,
                toolType: contentData.prompt_type,
                chatTitle,
                requestId: contentId,
                violations
            });
        }

        return generateHTMLResponse(
            true, 
            `The content has been ${action}. A notification email has been sent to the user.`,
            action
        );

    } catch (error) {
        console.error("Error processing email action:", error);
        return generateHTMLResponse(false, "An unexpected error occurred");
    }
} 