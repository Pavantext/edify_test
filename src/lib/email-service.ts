interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
    metadata?: {
        tool: string;
        userId: string;
        lessonPlanId?: string;
        perspectiveChallengeId?: string;
        topic?: string;
        subject?: string;
        yearGroup?: string;
        duration?: number;
        learningObjectives?: string;
        specialConsiderations?: any;
    };
}

export async function sendEmail(options: EmailOptions) {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'Edify <noreply@edify.com>',
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                metadata: options.metadata,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Email service error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            return { success: false, error: 'Failed to send email' };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
}

// Add helper function for perspective challenge approval email
export async function sendPerspectiveChallengeApprovalEmail(
    to: string,
    userId: string,
    perspectiveChallengeId: string,
    input: string
) {
    const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tools/perspective-challenge?approved=${perspectiveChallengeId}`;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Your Perspective Challenge Has Been Approved</h2>
            <p>Your perspective challenge has been reviewed and approved by our moderation team.</p>
            <p>Original input: ${input}</p>
            <p>You can now view your analysis by clicking the button below:</p>
            <div style="margin: 20px 0;">
                <a href="${approvalUrl}" 
                   style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    View Analysis
                </a>
            </div>
            <p>If you have any questions, please contact our support team.</p>
        </div>
    `;

    const text = `
        Your Perspective Challenge Has Been Approved
        
        Your perspective challenge has been reviewed and approved by our moderation team.
        Original input: ${input}
        
        You can view your analysis by visiting: ${approvalUrl}
        
        If you have any questions, please contact our support team.
    `;

    return sendEmail({
        to,
        subject: 'Your Perspective Challenge Has Been Approved',
        text,
        html,
        metadata: {
            tool: 'perspective_challenge',
            userId,
            perspectiveChallengeId,
        }
    });
} 