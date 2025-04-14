export interface WaitlistEntry {
  id: string;
  email: string;
  status: 'pending' | 'invited' | 'completed' | 'denied';
  created_at: string;
  account_type: 'individual' | 'organization' | null;
  organization_name: string | null;
  org_status: 'pending' | 'approved' | 'completed' | 'denied' | null;
  approved_at: string | null;
}

export type WaitlistStatus = WaitlistEntry['status']; 