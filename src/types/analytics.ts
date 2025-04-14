// src/types/analytics.ts
export interface User {
    id: string
    email: string | null
    full_name: string | null
    image_url: string | null
    created_at: string
    org_members: Array<{
      role: string
      organization: {
        id: string
        name: string
        slug: string
      }
    }>
  }
  
  export interface Organization {
    id: string
    name: string
    slug: string | null
    image_url: string | null
    created_at: string
    metadata: Record<string, any>
  }
  
  export interface OrgMember {
    org_id: string
    user_id: string
    role: 'admin' | 'educator'
    created_at: string
    updated_at: string
  }
  
  // Add new interface for chat metrics
  export interface ChatMetrics {
    input_tokens: number
    output_tokens: number
    total_tokens: number
    price_gbp: number
    content_flags: {
      pii_detected: boolean
      bias_detected: boolean
      content_violation: boolean
      self_harm_detected: boolean
      child_safety_violation: boolean
      misinformation_detected: boolean
      prompt_injection_detected: boolean
      automation_misuse_detected: boolean
      extremist_content_detected: boolean
      fraudulent_intent_detected: boolean
    }
  }
  
  // Extended types for analytics
  export interface UserAnalytics extends User {
    organizations: Organization[]
    total_orgs: number
    last_active: string
    role_counts: {
      admin: number
      educator: number
    }
    // New metrics
    metrics: {
      total_tokens: number
      total_cost: number
      total_violations: number
      subscription_status: 'active' | 'inactive'
      token_usage: {
        input_tokens: number
        output_tokens: number
      }
      violations_breakdown: Record<keyof ChatMetrics['content_flags'], number>
    }
  }
  
  export interface OrganizationAnalytics extends Organization {
    member_count: number
    admin_count: number
    educator_count: number
    latest_activity: string
  }
  
  // Add new types for the analytics dashboard
  export interface AnalyticsData {
    totals: {
      total_input_tokens: number
      total_output_tokens: number
      total_tokens: number
      total_cost: number
      total_requests: number
      total_violations: number
      total_users: number
    }
    timeSeriesData: Array<{
      date: string
      input: number
      output: number
      total: number
    }>
    modelData: Array<{
      name: string
      cost: number
      tokens: number
    }>
    violationsData: Array<{
      name: string
      value: number
    }>
  }