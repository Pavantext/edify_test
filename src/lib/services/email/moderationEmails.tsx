import React from 'react';
import { emailService } from './emailService';
import { ModerationRequestEmail, StatusUpdateEmail } from './components/EmailTemplates';
import type { ModerationRequestParams, StatusUpdateParams } from './components/EmailTemplates';

export async function sendModerationRequestEmail(to: string, params: ModerationRequestParams) {
  return emailService.sendEmail({
    to,
    subject: `Content Review Required: ${params.toolType} Content from ${params.violationDetails.username}`,
    react: <ModerationRequestEmail {...params} />
  });
}

export async function sendStatusUpdateEmail(to: string, params: StatusUpdateParams) {
  const statusText = params.status === 'approved' ? 'Approved' : 'Declined';
  return emailService.sendEmail({
    to,
    subject: `Content ${statusText}: ${params.toolType} Content Review Complete`,
    react: <StatusUpdateEmail {...params} />
  });
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

export default {
  sendModerationRequestEmail,
  sendStatusUpdateEmail
}; 