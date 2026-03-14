export type Digest = {
  overall_status: "healthy" | "warning" | "critical" | string;
  summary: string;
  top_issues: Array<{
    incident_id: number;
    title: string;
    severity: string;
    assessment: string;
  }>;
  recommended_actions: string[];
  source_incident_count: number;
  source_incidents: Incident[];
};

export type Incident = {
  id: number;
  status: string;
  severity: string;
  title: string;
  event_class: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
  affected_nodes: string[];
  affected_services: string[];
  root_cause_candidates: string[];
  summary: string;
  primary_fingerprint?: string;
  probable_root_cause?: string;
  confidence?: string;
  last_analyzed_at?: string;
  analysis_json?: {
    summary?: string;
    probable_root_cause?: string;
    confidence?: string;
    evidence?: string[];
    next_checks?: string[];
  } | null;
  metadata?: Record<string, any>;
};

export type IncidentDetail = {
  incident: Incident;
  events: Array<{
    id: number;
    ts: string;
    source: string;
    host: string;
    container: string;
    level: string;
    severity_norm: string;
    event_class: string;
    dependency: string;
    message: string;
    message_template: string;
  }>;
};

export type IncidentContext = {
  incident: Incident;
  investigation_focus: {
    primary_question: string;
    candidate_causes: string[];
    event_class: string;
    severity: string;
    affected_nodes: string[];
    affected_services: string[];
  };
  representative_events: Array<{
    id: number;
    ts: string;
    source: string;
    host: string;
    container: string;
    message: string;
    severity_norm: string;
    event_class: string;
    dependency: string;
  }>;
  nearby_window: {
    start: string;
    end: string;
    minutes_before: number;
    minutes_after: number;
  };
  nearby_events_filtered: Array<{
    id: number;
    ts: string;
    source: string;
    host: string;
    container: string;
    message: string;
    severity_norm: string;
    event_class: string;
  }>;
  similar_incidents: Incident[];
};

export type SuppressRule = {
  id: number;
  match_type: "fingerprint" | "event_class" | "event_class_host" | "message_regex";
  canonical_fingerprint: string;
  match_host: string;
  match_pattern: string;
  incident_title: string;
  event_class: string;
  reason: string;
  created_at: string;
  hit_count: number;
};

export type LogEvent = {
  id: number;
  ts: string;
  created_at: string;
  host: string;
  container: string;
  stream: string;
  level: string;
  severity_norm: string;
  event_class: string;
  message: string;
  processed: number;
  fingerprint: string;
  incident_id: number | null;
  suppressed: number;
};

export type NtfyEntry = {
  id: number;
  sent_at: string;
  title: string;
  priority: string;
  source: string;
  message: string;
};

export type LlmLogEntry = {
  id: number;
  called_at: string;
  duration_seconds: number;
  error: number;
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
  caller: string;
  response_preview: string;
};

export type LlmStats = {
  period_days: number;
  total_calls: number;
  total_errors: number;
  total_seconds: number;
  avg_seconds: number;
  min_seconds: number;
  max_seconds: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  daily: Array<{ day: string; calls: number; errors: number; total_sec: number; avg_sec: number; prompt_tokens: number; completion_tokens: number }>;
  recent: Array<{ called_at: string; duration_seconds: number; error: number; prompt_tokens: number; completion_tokens: number; model: string }>;
  session: { total_calls: number; total_errors: number; total_seconds: number; total_prompt_tokens: number; total_completion_tokens: number; last_call_at: string; last_duration_seconds: number };
};

export type EventStats = {
  period_days: number;
  total_stored: number;
  open_incidents: number;
  active_suppress_rules: number;
  by_severity: Record<string, number>;
  by_source: Record<string, number>;
  by_event_class: Record<string, number>;
  daily: Array<{ day: string; count: number }>;
  session: { total_received: number; total_stored: number; total_ignored: number };
};

export type AnalyzeResponse = {
  incident_id: number;
  analysis: {
    summary: string;
    probable_root_cause: string;
    confidence: string;
    evidence: string[];
    next_checks: string[];
  };
};
