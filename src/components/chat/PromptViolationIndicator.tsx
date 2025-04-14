'use client';

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import React from "react";
import { useSearchParams } from 'next/navigation';

interface ContentFlags {
  pii_detected?: boolean;
  content_violation?: boolean;
  bias_detected?: boolean;
  prompt_injection_detected?: boolean;
  fraudulent_intent_detected?: boolean;
  misinformation_detected?: boolean;
  self_harm_detected?: boolean;
  extremist_content_detected?: boolean;
  child_safety_violation?: boolean;
  automation_misuse_detected?: boolean;
  moderator_approval?: 'pending' | 'approved' | 'declined' | 'not_requested';
}

interface PromptViolationIndicatorProps {
  flags: ContentFlags;
  contentId?: string;
  onStatusUpdate?: (status: 'pending' | 'approved' | 'declined' | 'not_requested') => void;
}

const VIOLATION_LABELS: Record<string, { label: string; severity: 'critical' | 'high' | 'medium' | 'low' }> = {
  child_safety_violation: { label: 'Child Safety', severity: 'critical' },
  self_harm_detected: { label: 'Self Harm', severity: 'critical' },
  extremist_content_detected: { label: 'Extremist Content', severity: 'critical' },
  content_violation: { label: 'Content Violation', severity: 'high' },
  pii_detected: { label: 'Personal Information', severity: 'high' },
  fraudulent_intent_detected: { label: 'Fraudulent Intent', severity: 'high' },
  prompt_injection_detected: { label: 'Prompt Injection', severity: 'medium' },
  bias_detected: { label: 'Bias', severity: 'medium' },
  misinformation_detected: { label: 'Misinformation', severity: 'medium' },
  automation_misuse_detected: { label: 'Automation Misuse', severity: 'low' }
};

export function PromptViolationIndicator({ flags, contentId, onStatusUpdate }: PromptViolationIndicatorProps) {
  const searchParams = useSearchParams();
  const approvedId = searchParams.get('approved');
  const isApprovedFromEmail = approvedId === contentId;

  // If this content is approved from email, show only approved status
  if (isApprovedFromEmail || flags.moderator_approval === 'approved') {
    return (
      <Alert className="mt-2 bg-green-50 border-green-200">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-xs text-green-700">Approved Content</AlertTitle>
        <AlertDescription className="text-xs text-green-600">
          This content has been reviewed and approved by a moderator
        </AlertDescription>
      </Alert>
    );
  }

  // Create a stable copy of the flags to prevent stale renders
  const currentFlags = React.useMemo(() => ({...flags}), [flags]);

  const violations = React.useMemo(() => 
    Object.entries(currentFlags)
      .filter(([key, isViolated]) => isViolated && key !== 'moderator_approval')
      .map(([key]) => ({
        key,
        ...VIOLATION_LABELS[key]
      }))
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
    [currentFlags]
  );

  // Add debug logging
  React.useEffect(() => {
    console.log('Violation Indicator - Current Flags:', currentFlags);
    console.log('Violation Indicator - Processed Violations:', violations);
  }, [currentFlags, violations]);

  if (violations.length === 0) {
    return (
      <Alert className="mt-2 bg-green-50 border-green-200">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-xs text-green-700">Safe Content</AlertTitle>
        <AlertDescription className="text-xs text-green-600">
          No content violations detected
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="mt-2">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Content Safety Alert</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-1.5">
          {violations.map(({ key, label, severity }) => (
            <div 
              key={key}
              className="flex items-center justify-between p-1.5 bg-red-100/20 rounded"
            >
              <span className="text-sm">{label}</span>
              <span className={`
                px-1.5 py-0.5 text-xs rounded-full
                ${severity === 'critical' ? 'bg-red-500' : ''}
                ${severity === 'high' ? 'bg-orange-500' : ''}
                ${severity === 'medium' ? 'bg-yellow-500' : ''}
                ${severity === 'low' ? 'bg-blue-500' : ''}
                text-white
              `}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
} 