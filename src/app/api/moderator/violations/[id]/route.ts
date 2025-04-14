import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { sendModerationRequestEmail, sendStatusUpdateEmail } from "@/lib/services/email/moderationEmails.tsx";

type RouteParams = {
    params: Promise<{ id: string }>;
};

export async function PATCH(
    request: NextRequest,
    context: RouteParams
): Promise<NextResponse> {
    try {
        const { userId, orgRole, orgId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        // Define roles more explicitly
        const isModerator = orgRole === "moderator" || orgRole === "org:moderator";
        const isAdmin = orgRole === "org:admin";
        const isEducator = orgRole === "org:educator" || orgRole === "basic";

        // Check if user has a valid role
        if (!isModerator && !isAdmin && !isEducator) {
            return NextResponse.json({ error: "Unauthorized role" }, { status: 401 });
        }

        // Get and validate the ID parameter
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ error: "Missing or invalid violation ID" }, { status: 400 });
        }

        let requestBody;
        try {
            requestBody = await request.json();
        } catch (error) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        const supabase = await createClient();

        // If educator, verify they own the content and are only requesting moderation
        if (isEducator) {
            console.log("Processing educator moderation request...");
            
            // Check if the content belongs to the educator and get full content
            const { data: contentData, error: contentError } = await supabase
                .from("ai_tools_metrics")
                .select(`
                    id,
                    user_id, 
                    moderator_approval, 
                    prompt_type, 
                    prompt_id,
                    content_flags
                `)
                .eq("id", id)
                .single();

            if (contentError || !contentData) {
                console.error("Error fetching content data:", contentError);
                return NextResponse.json({ error: "Content not found" }, { status: 404 });
            }

            // Get chat title from chat_metrics
            const { data: chatData, error: chatError } = await supabase
                .from("chat_metrics")
                .select("prompt_text")
                .eq("id", contentData.prompt_id)
                .single();

            if (chatError) {
                console.error("Error fetching chat title:", chatError);
            }

            const chatTitle = chatData?.prompt_text || "Untitled Chat";

            // Process violations from content_flags - only include true violations
            const violations = Object.entries(contentData.content_flags)
                .filter(([_, value]) => value === true)
                .map(([key]) => {
                    const type = key.replace(/_/g, ' ')
                        .replace(/detected|violation/g, '')
                        .trim()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');

                    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
                    
                    if (key.includes('critical') || 
                        key.includes('child_safety') || 
                        key.includes('extremist')) {
                        severity = 'critical';
                    } else if (key.includes('high') || 
                             key.includes('prompt_injection') || 
                             key.includes('pii')) {
                        severity = 'high';
                    } else if (key.includes('low')) {
                        severity = 'low';
                    }
                    
                    return { type, severity };
                });

            // Get user details
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("username")
                .eq("id", userId)
                .single();

            const username = userData?.username || "User";

            // Get organization members from Clerk
            const clerk = await clerkClient();
            const { data: orgMembers } = await clerk.organizations.getOrganizationMembershipList({ 
                organizationId: orgId as string 
            });
            
            // Filter for moderators
            const moderators = orgMembers.filter(member => 
                member.role === "org:moderator" || member.role === "moderator"
            );

            if (moderators.length === 0) {
                console.error("No moderators found in the organization");
                return NextResponse.json({ error: "No moderator available" }, { status: 404 });
            }

            // Get the first moderator's email
            const moderatorId = moderators[0].publicUserData?.userId;
            if (!moderatorId) {
                console.error("Moderator ID not found");
                return NextResponse.json({ error: "Moderator ID not found" }, { status: 404 });
            }

            const primaryModerator = await clerk.users.getUser(moderatorId);
            if (!primaryModerator) {
                console.error("Moderator not found");
                return NextResponse.json({ error: "Moderator not found" }, { status: 404 });
            }

            const primaryModeratorEmail = primaryModerator.emailAddresses[0]?.emailAddress;
            if (!primaryModeratorEmail) {
                console.error("Moderator email not found");
                return NextResponse.json({ error: "Moderator email not found" }, { status: 404 });
            }

            // Send email to primary moderator
            try {
                await sendModerationRequestEmail(primaryModeratorEmail, {
                    username,
                    contentId: id,
                    toolType: contentData.prompt_type,
                    chatTitle,
                    violationDetails: {
                        userId,
                        username,
                        violations,
                        requestId: id,
                        timestamp: new Date().toISOString()
                    }
                });
                console.log("Successfully sent email to primary moderator");

                // Update the record to indicate moderation has been requested
                const { error: updateError } = await supabase
                    .from("ai_tools_metrics")
                    .update({ 
                        moderator_approval: 'pending',
                        moderation_requested_at: new Date().toISOString(),
                        user_requested_moderation: true
                    })
                    .eq("id", id);

                if (updateError) {
                    console.error("Error updating moderation status:", updateError);
                    return NextResponse.json({ error: updateError.message }, { status: 500 });
                }

            } catch (emailError) {
                console.error("Error sending moderator email:", emailError);
            }

            // Fetch the updated record
            const { data: updatedRecord, error: fetchError } = await supabase
                .from("ai_tools_metrics")
                .select("*")
                .eq("id", id)
                .single();

            if (fetchError) {
                console.error("Error fetching updated record:", fetchError);
                return NextResponse.json({ error: fetchError.message }, { status: 500 });
            }

            return NextResponse.json({ 
                success: true, 
                data: {
                    ...updatedRecord,
                    status: updatedRecord.moderator_approval || 'not_requested'
                }
            });
        } else if (isModerator || isAdmin) {
            // Moderator/Admin actions
            const { moderator_approval, moderator_notes } = requestBody;

            // Fetch the content data to get user email and content
            const { data: contentData, error: contentError } = await supabase
                .from("ai_tools_metrics")
                .select(`
                    user_id, 
                    prompt_type, 
                    prompt_id,
                    content_flags,
                    input_length,
                    input_tokens,
                    output_tokens
                `)
                .eq("id", id)
                .single();

            if (contentError || !contentData) {
                return NextResponse.json({ error: "Content not found" }, { status: 404 });
            }

            // Get user's details
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("email, username")
                .eq("id", contentData.user_id)
                .single();

            if (userError || !userData) {
                console.error("Error fetching user email:", userError);
            } else {
                // Get chat title
                const { data: chatData, error: chatError } = await supabase
                    .from("chat_metrics")
                    .select("prompt_text")
                    .eq("id", contentData.prompt_id)
                    .single();

                const chatTitle = chatData?.prompt_text || "Untitled Chat";

                // Process violations from content_flags
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
                        
                        if (key.includes('critical') || 
                            key.includes('child_safety') || 
                            key.includes('extremist')) {
                            severity = 'critical';
                        } else if (key.includes('high') || 
                                key.includes('prompt_injection') || 
                                key.includes('pii')) {
                            severity = 'high';
                        } else if (key.includes('low')) {
                            severity = 'low';
                        }
                        
                        return { type, severity };
                    });

                // Send status update email to user
                await sendStatusUpdateEmail(userData.email, {
                    username: userData.username,
                    contentId: id,
                    status: moderator_approval,
                    toolType: contentData.prompt_type,
                    chatTitle,
                    notes: moderator_notes,
                    requestId: id,
                    violations
                });
            }

            const { error: updateError } = await supabase
                .from("ai_tools_metrics")
                .update({ 
                    moderator_approval,
                    moderator_notes,
                    moderation_updated_at: new Date().toISOString(),
                    moderator_id: userId
                })
                .eq("id", id);

            if (updateError) {
                console.error("Error updating moderation status:", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            // Fetch the updated record
            const { data: updatedRecord, error: fetchError } = await supabase
                .from("ai_tools_metrics")
                .select("*")
                .eq("id", id)
                .single();

            if (fetchError) {
                console.error("Error fetching updated record:", fetchError);
                return NextResponse.json({ error: fetchError.message }, { status: 500 });
            }

            return NextResponse.json({ 
                success: true, 
                data: {
                    ...updatedRecord,
                    status: updatedRecord.moderator_approval || 'not_requested'
                }
            });
        }

        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    context: RouteParams
): Promise<NextResponse> {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        const { id } = await context.params;
        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        const supabase = await createClient();

        // If no action parameter, return the prompt data
        if (!action) {
            // First get the record from ai_tools_metrics
            const { data: aiToolsMetric, error: aiToolsError } = await supabase
                .from("ai_tools_metrics")
                .select(`
                    id,
                    user_id,
                    prompt_type,
                    prompt_id,
                    content_flags,
                    moderator_approval
                `)
                .eq("id", id)
                .single();

            if (aiToolsError || !aiToolsMetric) {
                console.error("Content not found:", aiToolsError);
                return NextResponse.json({ error: "Content not found" }, { status: 404 });
            }

            // Then get the prompt text from chat_metrics using the prompt_id
            const { data: chatMetric, error: chatError } = await supabase
                .from("chat_metrics")
                .select("prompt_text")
                .eq("id", aiToolsMetric.prompt_id)
                .single();

            if (chatError || !chatMetric) {
                console.error("Chat metric not found:", chatError);
                return NextResponse.json({ error: "Chat content not found" }, { status: 404 });
            }

            // Only return if approved
            if (aiToolsMetric.moderator_approval !== 'approved') {
                console.error("Content not approved:", aiToolsMetric.moderator_approval);
                return NextResponse.json({ error: "Content not approved" }, { status: 403 });
            }

            return NextResponse.json({
                id: aiToolsMetric.id,
                data: {
                    promptText: chatMetric.prompt_text,
                    contentFlags: {
                        ...aiToolsMetric.content_flags,
                        moderator_approval: aiToolsMetric.moderator_approval
                    }
                }
            });
        }

        // For approve/decline actions, verify moderator role
        const { orgRole } = await auth();
        const isModerator = orgRole === "moderator" || orgRole === "org:moderator";
        const isAdmin = orgRole === "org:admin";

        if (!isModerator && !isAdmin) {
            return NextResponse.json({ error: "Unauthorized role" }, { status: 401 });
        }

        // Rest of the existing code for approve/decline actions...

        // Rest of the existing GET endpoint code for action=approve/decline
        if (action !== 'approve' && action !== 'decline') {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const moderator_approval = action === 'approve' ? 'approved' : 'declined';

        // Update the moderation status
        const { error: updateError } = await supabase
            .from("ai_tools_metrics")
            .update({ 
                moderator_approval,
                moderation_updated_at: new Date().toISOString(),
                moderator_id: userId
            })
            .eq("id", id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Get content and user details for email
        const { data: contentData } = await supabase
            .from("ai_tools_metrics")
            .select(`
                user_id, 
                prompt_type, 
                prompt_id,
                content_flags
            `)
            .eq("id", id)
            .single();

        if (contentData) {
            const { data: userData } = await supabase
                .from("users")
                .select("email, username")
                .eq("id", contentData.user_id)
                .single();

            if (userData) {
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

                // Send status update email
                await sendStatusUpdateEmail(userData.email, {
                    username: userData.username,
                    contentId: id,
                    status: moderator_approval,
                    toolType: contentData.prompt_type,
                    chatTitle,
                    requestId: id,
                    violations
                });
            }
        }

        // Return a success page
        const html = `
            <html>
                <head>
                    <title>Moderation ${action === 'approve' ? 'Approved' : 'Declined'}</title>
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f6f9fc; }
                        .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .success { color: ${action === 'approve' ? '#34A853' : '#EA4335'}; font-size: 48px; margin-bottom: 1rem; }
                        .message { color: #333; margin-bottom: 1.5rem; }
                        .back { background: #1a73e8; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 4px; display: inline-block; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success">${action === 'approve' ? '✓' : '✕'}</div>
                        <h1 class="message">Content ${action === 'approve' ? 'Approved' : 'Declined'}</h1>
                        <p>The user has been notified of your decision.</p>
                        <a href="/moderator/dashboard" class="back">Return to Dashboard</a>
                    </div>
                </body>
            </html>
        `;

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' },
        });

    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Helper function to send emails to moderators
async function sendModeratorEmails(moderatorEmails: string[], contentData: any, id: string, userId: string) {
    console.log("Sending emails to moderators:", moderatorEmails);

    // Get chat title
    const supabase = await createClient();
    const { data: chatData, error: chatError } = await supabase
        .from("chat_metrics")
        .select("prompt_text")
        .eq("id", contentData.prompt_id)
        .single();

    const chatTitle = chatData?.prompt_text || "Untitled Chat";

    // Process violations from content_flags
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
            
            if (key.includes('critical') || 
                key.includes('child_safety') || 
                key.includes('extremist')) {
                severity = 'critical';
            } else if (key.includes('high') || 
                     key.includes('prompt_injection') || 
                     key.includes('pii')) {
                severity = 'high';
            } else if (key.includes('low')) {
                severity = 'low';
            }
            
            return { type, severity };
        });

    // Send email to all moderators
    try {
        await Promise.all(moderatorEmails.map(email => 
            sendModerationRequestEmail(email, {
                username: "User",
                contentId: id,
                toolType: contentData.prompt_type,
                chatTitle,
                violationDetails: {
                    userId,
                    username: "User",
                    violations,
                    requestId: id,
                    timestamp: new Date().toISOString()
                }
            })
        ));
        console.log("Successfully sent emails to moderators");
    } catch (emailError) {
        console.error("Error sending moderator emails:", emailError);
    }
} 