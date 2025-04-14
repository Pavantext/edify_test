import React from 'react';
import { Img } from '@react-email/img';
import { Link } from '@react-email/link';
import { Container } from '@react-email/container';
import { Text } from '@react-email/text';
import { Section } from '@react-email/section';
import { Heading } from '@react-email/heading';
import { Button } from '@react-email/button';
import { createHmac } from 'crypto';

const SECRET_KEY = process.env.EMAIL_ACTION_SECRET || 'your-secret-key';

function generateToken(contentId: string, action: string, moderatorId: string): string {
    const hmac = createHmac('sha256', SECRET_KEY);
    hmac.update(`${contentId}:${action}:${moderatorId}`);
    return hmac.digest('hex');
}

// Interface for moderation request email (sent to moderator)
export interface ModerationRequestParams {
  username: string;
  contentId: string;
  toolType: string;
  chatTitle: string;
  violationDetails: {
    userId: string;
    username: string;
    violations: Array<{
      type: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
    }>;
    requestId: string;
    timestamp: string;
  };
}

// Interface for status update email (sent to user)
export interface StatusUpdateParams {
  username: string;
  contentId: string;
  status: string;
  toolType: string;
  chatTitle: string;
  notes?: string;
  requestId: string;
  violations?: Array<{ type: string; severity: string }>;
}

const SeverityBadge = ({ severity }: { severity: string }) => {
  const getColor = () => {
    switch (severity.toLowerCase()) {
      case 'critical': return '#FF4444';
      case 'high': return '#FF8C00';
      case 'medium': return '#FFD700';
      case 'low': return '#90EE90';
      default: return '#808080';
    }
  };

  return (
    <span style={{
      backgroundColor: getColor(),
      color: severity.toLowerCase() === 'low' ? '#000' : '#fff',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
      display: 'inline-block',
      marginLeft: '8px'
    }}>
      {severity.toUpperCase()}
    </span>
  );
};

// Update this to match your actual domain
const MODERATION_EMAIL = process.env.MODERATION_EMAIL || 'moderation@aiedify.com';

interface EmailTemplateProps {
    children: React.ReactNode;
    preview?: string;
}

const styles = {
    sectionTitle: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#1a73e8',
        marginBottom: '12px'
    },
    violationsContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px'
    },
    violationBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px'
    },
    violationType: {
        fontSize: '14px',
        color: '#202124'
    },
    buttonContainer: {
        display: 'flex',
        gap: '16px',
        marginTop: '16px'
    },
    approveButton: {
        backgroundColor: '#34A853',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '4px',
        textDecoration: 'none',
        fontWeight: 'bold'
    },
    declineButton: {
        backgroundColor: '#EA4335',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '4px',
        textDecoration: 'none',
        fontWeight: 'bold'
    },
    contentLine: {
        fontSize: '15px',
        lineHeight: '1.8',
        color: '#202124',
        marginBottom: '8px'
    },
    label: {
        color: '#202124',
        fontWeight: 'bold'
    },
    value: {
        color: '#202124'
    }
};

const EmailLayout = ({ children }: EmailTemplateProps) => (
    <Container>
        <Container style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            padding: '40px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontFamily: 'Arial, sans-serif'
        }}>
            {children}
        </Container>
    </Container>
);

const generateActionUrl = (contentId: string, action: 'approve' | 'decline') => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.aiedify.com';
    return `${baseUrl}/api/moderator/violations/${contentId}?action=${action}`;
};

export const ModerationRequestEmail = ({
    username,
    contentId,
    toolType,
    chatTitle,
    violationDetails
}: ModerationRequestParams) => {
    const styles = {
        container: {
            backgroundColor: '#ffffff',
            padding: '40px 20px'
        },
        header: {
            textAlign: 'center' as const,
            marginBottom: '32px'
        },
        logo: {
            width: '80px',
            height: '80px',
            marginBottom: '24px'
        },
        title: {
            color: '#1a73e8',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center' as const,
            margin: '0 0 16px 0'
        },
        subtitle: {
            color: '#5f6368',
            fontSize: '16px',
            textAlign: 'center' as const,
            marginBottom: '32px'
        },
        section: {
            backgroundColor: '#F8FAFB',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
        },
        sectionTitle: {
            color: '#1a73e8',
            fontSize: '18px',
            fontWeight: 'bold',
            marginTop: 0,
            marginBottom: '16px'
        },
        contentLine: {
            fontSize: '15px',
            lineHeight: '1.8',
            color: '#202124',
            marginBottom: '8px'
        },
        label: {
            color: '#202124',
            fontWeight: 'bold',
            display: 'inline'
        },
        value: {
            color: '#202124',
            display: 'inline'
        },
        violationsList: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '8px'
        },
        violationItem: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
        },
        actionButtons: {
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            marginTop: '32px'
        },
        approveButton: {
            backgroundColor: '#34A853',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold'
        },
        declineButton: {
            backgroundColor: '#EA4335',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold'
        },
        footer: {
            borderTop: '1px solid #e0e0e0',
            marginTop: '32px',
            paddingTop: '24px',
            color: '#5f6368',
            fontSize: '14px',
            textAlign: 'center' as const
        }
    };

    // Force string conversion and explicit trimming
    const usernameStr = String(username || '').trim();
    
    // Extract username before the underscore using lastIndexOf
    const lastUnderscore = usernameStr.lastIndexOf('_');
    
    // Create display name with explicit fallback
    const displayName = lastUnderscore !== -1 
        ? usernameStr.substring(0, lastUnderscore) 
        : usernameStr;
    
    // For debugging - log this somewhere if possible
    console.log('Moderation Email username processing:', { 
        original: usernameStr,
        lastUnderscore,
        displayName
    });

    return (
        <EmailLayout>
            <Container style={styles.container}>
                {/* Header with Logo */}
                <Section style={styles.header}>
                    <Img
                        src="@mainlogo.png"
                        alt="AI Edify Logo"
                        width="80"
                        height="80"
                    />
                </Section>

                {/* Title */}
                <Text style={styles.title}>Content Moderation Request</Text>
                <Text style={styles.subtitle}>
                    A new content moderation request has been submitted by {displayName}.
                </Text>

                {/* Content Box */}
                <Section style={styles.section}>
                    <Text style={styles.contentLine}>
                        <Text style={styles.label}>chat: </Text>"{chatTitle}"
                    </Text>
                    <Text style={styles.contentLine}>
                        <Text style={styles.label}>tool type: </Text>"{toolType}"
                    </Text>
                    <Text style={styles.contentLine}>
                        <Text style={styles.label}>content id: </Text>{contentId}
                    </Text>
                </Section>

                {/* Violations */}
                {violationDetails.violations && violationDetails.violations.length > 0 && (
                    <Section style={styles.section}>
                        <Text style={styles.sectionTitle}>Detected Violations</Text>
                        <Container style={styles.violationsList}>
                            {violationDetails.violations.map((violation, index) => (
                                <Container key={index} style={styles.violationItem}>
                                    <Text style={styles.value}>{violation.type}</Text>
                                    <SeverityBadge severity={violation.severity} />
                                </Container>
                            ))}
                        </Container>
                    </Section>
                )}

                {/* Action Buttons */}
                <Section>
                    <Text style={styles.sectionTitle}>Take Action</Text>
                    <Container style={styles.actionButtons}>
                        <Link
                            href={generateActionUrl(contentId, 'approve')}
                            style={styles.approveButton}
                        >
                            Approve Content
                        </Link>
                        <Link
                            href={generateActionUrl(contentId, 'decline')}
                            style={styles.declineButton}
                        >
                            Decline Content
                        </Link>
                    </Container>
                </Section>

                {/* Footer */}
                <Text style={styles.footer}>
                    Thank you for your assistance.
                </Text>
            </Container>
        </EmailLayout>
    );
};

const getToolUrl = (type: string, contentId: string, status: string) => {
    // First, clean the tool type string
    const cleanType = type.toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '-')
        .replace('-generator', ''); // Remove generator suffix if present

    // Map all possible prompt_type values to their correct URLs
    const toolMap: { [key: string]: string } = {
        // Chat related
        'chat': '/tools/ai-chat-history',
        'ai-chat': '/tools/ai-chat-history',
        'ai-chat-history': '/tools/ai-chat-history',
        
        // Generators
        'prompt': '/tools/prompt-generator',
        'prompt-generator': '/tools/prompt-generator',
        'lesson-plan': '/tools/lesson-plan-generator',
        'lesson': '/tools/lesson-plan-generator',
        'long-qa': '/tools/long-qa-generator',
        'mcq': '/tools/mcq-generator',
        'peel': '/tools/peel-generator',
        'report': '/tools/report-generator',
        'rubric': '/tools/rubric-generator',
        'sow': '/tools/sow-generator',
        'quiz': '/tools/quiz-generator',
        
        // Special tools
        'clarify-or-challenge': '/tools/clarify-or-challenge',
        'perspective-challenge': '/tools/perspective-challenge',
        'lesson-plan-evaluator': '/tools/lesson-plan-evaluator',
        
        // Ensure exact matches also work
        'lesson-plan-generator': '/tools/lesson-plan-generator',
        'long-qa-generator': '/tools/long-qa-generator',
        'mcq-generator': '/tools/mcq-generator',
        'peel-generator': '/tools/peel-generator',
        'report-generator': '/tools/report-generator',
        'rubric-generator': '/tools/rubric-generator',
        'sow-generator': '/tools/sow-generator',
        'quiz-generator': '/tools/quiz-generator'
    };

    // Get the base URL
    const baseUrl = toolMap[cleanType] || '/tools';
    
    // Add approved parameter if status is approved
    if (status === 'approved') {
        return `${baseUrl}?approved=${contentId}`;
    }
    
    return baseUrl;
};

export const StatusUpdateEmail = ({
    username,
    contentId,
    status,
    toolType,
    chatTitle,
    notes,
    violations
}: StatusUpdateParams) => {
    const styles = {
        container: {
            backgroundColor: '#ffffff',
            padding: '40px 20px'
        },
        header: {
            textAlign: 'center' as const,
            marginBottom: '32px'
        },
        logo: {
            width: '80px',
            height: '80px',
            marginBottom: '24px'
        },
        statusBanner: {
            backgroundColor: status === 'approved' ? '#E8F5E9' : '#FFEAEA',
            padding: '24px',
            borderRadius: '12px',
            marginBottom: '32px',
            textAlign: 'center' as const
        },
        statusIcon: {
            fontSize: '32px',
            color: status === 'approved' ? '#34A853' : '#EA4335',
            marginBottom: '16px'
        },
        statusTitle: {
            color: status === 'approved' ? '#1B5E20' : '#B71C1C',
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '0 0 8px 0'
        },
        statusMessage: {
            color: status === 'approved' ? '#2E7D32' : '#C62828',
            fontSize: '16px',
            margin: 0
        },
        section: {
            backgroundColor: '#F8FAFB',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
        },
        sectionTitle: {
            color: '#1a73e8',
            fontSize: '18px',
            fontWeight: 'bold',
            marginTop: 0,
            marginBottom: '16px'
        },
        contentLine: {
            fontSize: '15px',
            lineHeight: '1.8',
            color: '#202124',
            marginBottom: '8px'
        },
        label: {
            color: '#202124',
            fontWeight: 'bold',
            display: 'inline'
        },
        value: {
            color: '#202124',
            display: 'inline'
        },
        violationsList: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '8px'
        },
        violationItem: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
        },
        notes: {
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            fontSize: '16px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap' as const
        },
        actionButton: {
            backgroundColor: '#1a73e8',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold',
            display: 'inline-block',
            textAlign: 'center' as const,
            marginTop: '24px'
        },
        footer: {
            borderTop: '1px solid #e0e0e0',
            marginTop: '32px',
            paddingTop: '24px',
            color: '#5f6368',
            fontSize: '14px',
            textAlign: 'center' as const
        }
    };

    // Force string conversion and explicit trimming
    const usernameStr = String(username || '').trim();
    
    // Extract username before the underscore using lastIndexOf
    const lastUnderscore = usernameStr.lastIndexOf('_');
    
    // Create display name with explicit fallback
    const displayName = lastUnderscore !== -1 
        ? usernameStr.substring(0, lastUnderscore) 
        : usernameStr;
    
    // For debugging - log this somewhere if possible
    console.log('Email username processing:', { 
        original: usernameStr,
        lastUnderscore,
        displayName
    });

    return (
        <EmailLayout>
            <Container style={styles.container}>
                {/* Header with Logo */}
                <Section style={styles.header}>
                    <Img
                        src="@mainlogo.png"
                        alt="AI Edify Logo"
                        width="80"
                        height="80"
                    />
                </Section>

                {/* Status Banner */}
                <Section style={styles.statusBanner}>
                    <Text style={styles.statusIcon}>
                        {status === 'approved' ? '✓' : '✕'}
                    </Text>
                    <Text style={styles.statusTitle}>
                        Content {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                    <Text style={styles.statusMessage}>
                        Hello {displayName}, your content has been reviewed and {status}.
                    </Text>
                </Section>

                {/* Content Details */}
                <Section style={styles.section}>
                    <Text style={styles.contentLine}>
                        <Text style={styles.label}>tool type: </Text>"{toolType}"
                    </Text>
                    <Text style={styles.contentLine}>
                        <Text style={styles.label}>chat: </Text>"{chatTitle}"
                    </Text>
                    <Text style={styles.contentLine}>
                        <Text style={styles.label}>content id: </Text>{contentId}
                    </Text>
                </Section>

                {/* Violations */}
                {violations && violations.length > 0 && (
                    <Section style={styles.section}>
                        <Text style={styles.sectionTitle}>Detected Violations</Text>
                        <Container style={styles.violationsList}>
                            {violations.map((violation, index) => (
                                <Container key={index} style={styles.violationItem}>
                                    <Text style={styles.value}>{violation.type}</Text>
                                    <SeverityBadge severity={violation.severity} />
                                </Container>
                            ))}
                        </Container>
                    </Section>
                )}

                {/* Moderator Notes */}
                {notes && (
                    <Section style={styles.section}>
                        <Text style={styles.sectionTitle}>Moderator Notes</Text>
                        <Text style={styles.notes}>{notes}</Text>
                    </Section>
                )}

                {/* Action Button */}
                {status === 'approved' && (
                    <Section style={{ textAlign: 'center' as const }}>
                        <Link
                            href={`${process.env.NEXT_PUBLIC_APP_URL}${getToolUrl(toolType, contentId, status)}`}
                            style={styles.actionButton}
                        >
                            Go to Tool
                        </Link>
                    </Section>
                )}

                {/* Footer */}
                <Text style={styles.footer}>
                    This is an automated message. Please do not reply to this email.
                </Text>
            </Container>
        </EmailLayout>
    );
}; 