import { ReactNode } from 'react';

export interface EmailTemplateProps {
  preview: string;
  children: ReactNode;
}

export interface ViolationDetails {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface UserViolationEmailProps {
  username: string;
  violations: ViolationDetails[];
  promptContent: string;
  requestId: string;
  contentId: string;
  toolType: string;
  promptId: string;
}

export interface ModeratorRequestEmailProps {
  violationDetails: {
    userId: string;
    username: string;
    promptContent: string;
    violations: ViolationDetails[];
    requestId: string;
    timestamp: string;
  }
  contentId: string;
  toolType: string;
  promptId: string;
}

export interface StatusUpdateEmailProps {
  username: string;
  status: 'approved' | 'declined';
  promptContent: string;
  moderatorNotes?: string;
  requestId: string;
  contentId: string;
  toolType: string;
  promptId: string;
  notes?: string;
} 