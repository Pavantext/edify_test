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