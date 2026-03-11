import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, RefreshCw, ServerCrash, Search, Activity, FileSearch, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Digest = {
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

type Incident = {
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

type IncidentDetail = {
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
  }>;
};

type IncidentContext = {
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

type AnalyzeResponse = {
  incident_id: number;
  analysis: {
    summary: string;
    probable_root_cause: string;
    confidence: string;
    evidence: string[];
    next_checks: string[];
  };
};

const DEFAULT_BASE_URL = "http://192.168.2.44:8088";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function severityTone(severity?: string) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "error":
    case "high":
      return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    case "warning":
    case "medium":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    case "healthy":
    case "ok":
    case "info":
    case "low":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

function statusTone(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "healthy":
      return "text-emerald-300";
    case "warning":
      return "text-yellow-300";
    case "critical":
      return "text-red-300";
    default:
      return "text-slate-300";
  }
}

async function api<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

export default function HomelabIncidentDashboard() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [draftBaseUrl, setDraftBaseUrl] = useState(DEFAULT_BASE_URL);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [context, setContext] = useState<IncidentContext | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (!q) return true;
      return [
        incident.title,
        incident.event_class,
        incident.summary,
        incident.probable_root_cause,
        ...(incident.affected_nodes || []),
        ...(incident.affected_services || []),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [incidents, search]);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const [digestRes, incidentsRes] = await Promise.all([
        api<Digest>(baseUrl, "/api/incidents/open/llm-digest"),
        api<{ items: Incident[] }>(baseUrl, `/api/incidents?status=${statusFilter}&limit=50`),
      ]);
      setDigest(digestRes);
      setIncidents(incidentsRes.items || []);

      if (!selectedId && incidentsRes.items?.length) {
        setSelectedId(incidentsRes.items[0].id);
      }
      if (selectedId && !incidentsRes.items.some((i) => i.id === selectedId)) {
        setSelectedId(incidentsRes.items[0]?.id ?? null);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  async function loadIncident(incidentId: number) {
    setDetailLoading(true);
    setError(null);
    try {
      const [detailRes, contextRes] = await Promise.all([
        api<IncidentDetail>(baseUrl, `/api/incidents/${incidentId}`),
        api<IncidentContext>(baseUrl, `/api/incidents/${incidentId}/llm-context`),
      ]);
      setDetail(detailRes);
      setContext(contextRes);
      setAnalyzeResult(null);
    } catch (e: any) {
      setError(e.message || "Failed to load incident detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function analyzeIncident() {
    if (!selectedId) return;
    setAnalyzeLoading(true);
    setError(null);
    try {
      const result = await api<AnalyzeResponse>(baseUrl, `/api/incidents/${selectedId}/analyze`, {
        method: "POST",
      });
      setAnalyzeResult(result);
      await loadOverview();
      await loadIncident(selectedId);
    } catch (e: any) {
      setError(e.message || "Failed to analyze incident");
    } finally {
      setAnalyzeLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, statusFilter]);

  useEffect(() => {
    if (selectedId != null) {
      loadIncident(selectedId);
    } else {
      setDetail(null);
      setContext(null);
      setAnalyzeResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const currentAnalysis = analyzeResult?.analysis || detail?.incident?.analysis_json || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]"
        >
          <Card className="border-slate-800 bg-slate-900/70 shadow-2xl rounded-3xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <ShieldAlert className="h-6 w-6" /> Homelab Incident Dashboard
                  </CardTitle>
                  <CardDescription className="text-slate-400 mt-1">
                    Digest, active incidents, incident context, and on-demand analysis from your FastAPI backend.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={classNames("border", severityTone(digest?.overall_status))}>
                    {(digest?.overall_status || "unknown").toUpperCase()}
                  </Badge>
                  <Button variant="outline" className="border-slate-700 bg-slate-900" onClick={loadOverview} disabled={loading}>
                    <RefreshCw className={classNames("h-4 w-4 mr-2", loading && "animate-spin")} /> Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                  <CardContent className="p-4">
                    <div className="text-slate-400 text-sm">Current status</div>
                    <div className={classNames("mt-2 text-xl font-semibold flex items-center gap-2", statusTone(digest?.overall_status))}>
                      {digest?.overall_status === "healthy" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                      {digest?.overall_status || "unknown"}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                  <CardContent className="p-4">
                    <div className="text-slate-400 text-sm">Open incidents in digest</div>
                    <div className="mt-2 text-xl font-semibold">{digest?.source_incident_count ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                  <CardContent className="p-4">
                    <div className="text-slate-400 text-sm">Selected backend</div>
                    <div className="mt-2 text-sm break-all text-slate-200">{baseUrl}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-sm text-slate-400 mb-2">Digest summary</div>
                <div className="text-slate-100 leading-7">{digest?.summary || "No digest loaded yet."}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  value={draftBaseUrl}
                  onChange={(e) => setDraftBaseUrl(e.target.value)}
                  placeholder="FastAPI base URL"
                  className="bg-slate-950 border-slate-800 rounded-2xl"
                />
                <Button
                  className="rounded-2xl"
                  onClick={() => {
                    setBaseUrl(draftBaseUrl.trim());
                    setSelectedId(null);
                  }}
                >
                  Apply backend URL
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5" /> Recommended actions</CardTitle>
              <CardDescription>Derived from the live incident digest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(digest?.recommended_actions || []).length ? (
                digest?.recommended_actions.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm leading-6">
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
                  No recommended actions right now.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {error && (
          <Card className="border-red-900 bg-red-950/40 rounded-3xl">
            <CardContent className="p-4 text-red-200">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl min-h-[700px]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><FileSearch className="h-5 w-5" /> Incidents</CardTitle>
                  <CardDescription>Filter, search, and select incidents for investigation.</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-slate-950 border-slate-800 rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search incidents, nodes, services, root causes..."
                  className="pl-9 bg-slate-950 border-slate-800 rounded-2xl"
                />
              </div>
            </CardHeader>
            <CardContent className="h-[580px]">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-3">
                  {filteredIncidents.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                      No incidents matched this view.
                    </div>
                  )}
                  {filteredIncidents.map((incident) => (
                    <motion.button
                      whileHover={{ y: -1 }}
                      key={incident.id}
                      onClick={() => setSelectedId(incident.id)}
                      className={classNames(
                        "w-full text-left rounded-2xl border p-4 transition-all",
                        selectedId === incident.id
                          ? "border-sky-500/50 bg-sky-500/10"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium leading-6">#{incident.id} · {incident.title}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {incident.event_class || "unknown"} · {incident.affected_nodes?.join(", ") || "no node"}
                          </div>
                        </div>
                        <Badge variant="outline" className={classNames("border", severityTone(incident.severity))}>
                          {incident.severity}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-300 mt-3 line-clamp-3">
                        {incident.summary || "No summary yet."}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>events: {incident.event_count}</span>
                        <span>status: {incident.status}</span>
                        <span>last seen: {fmtDate(incident.last_seen)}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2"><ServerCrash className="h-5 w-5" /> Incident detail</CardTitle>
                    <CardDescription>
                      {selectedId ? `Selected incident #${selectedId}` : "Select an incident to inspect."}
                    </CardDescription>
                  </div>
                  <Button onClick={analyzeIncident} disabled={!selectedId || analyzeLoading} className="rounded-2xl">
                    <RefreshCw className={classNames("h-4 w-4 mr-2", analyzeLoading && "animate-spin")} />
                    Analyze incident
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedId && <div className="text-sm text-slate-400">No incident selected.</div>}
                {selectedId && detailLoading && <div className="text-sm text-slate-400">Loading incident details...</div>}
                {detail?.incident && (
                  <>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={classNames("border", severityTone(detail.incident.severity))}>{detail.incident.severity}</Badge>
                        <Badge variant="outline" className="border-slate-700">{detail.incident.status}</Badge>
                        <Badge variant="outline" className="border-slate-700">{detail.incident.event_class || "unknown"}</Badge>
                      </div>
                      <div className="text-xl font-semibold leading-7">{detail.incident.title}</div>
                      <div className="text-sm text-slate-300 leading-7">{detail.incident.summary || "No persisted summary yet."}</div>
                      <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div><span className="text-slate-400">Nodes:</span> {(detail.incident.affected_nodes || []).join(", ") || "—"}</div>
                        <div><span className="text-slate-400">Services:</span> {(detail.incident.affected_services || []).join(", ") || "—"}</div>
                        <div><span className="text-slate-400">First seen:</span> {fmtDate(detail.incident.first_seen)}</div>
                        <div><span className="text-slate-400">Last seen:</span> {fmtDate(detail.incident.last_seen)}</div>
                        <div><span className="text-slate-400">Probable root cause:</span> {detail.incident.probable_root_cause || "—"}</div>
                        <div><span className="text-slate-400">Confidence:</span> {detail.incident.confidence || "—"}</div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                        <CardHeader>
                          <CardTitle className="text-base">Representative events</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[260px] pr-3">
                            <div className="space-y-3">
                              {context?.representative_events?.map((event) => (
                                <div key={event.id} className="rounded-2xl border border-slate-800 p-3 text-sm">
                                  <div className="text-slate-400 text-xs mb-2">{fmtDate(event.ts)} · {event.host} · {event.container}</div>
                                  <div className="text-slate-200 leading-6">{event.message}</div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                        <CardHeader>
                          <CardTitle className="text-base">Analysis</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {currentAnalysis ? (
                            <>
                              <div className="text-sm leading-7 text-slate-200">{currentAnalysis.summary}</div>
                              <Separator className="bg-slate-800" />
                              <div className="text-sm"><span className="text-slate-400">Probable root cause:</span> {currentAnalysis.probable_root_cause || "—"}</div>
                              <div className="text-sm"><span className="text-slate-400">Confidence:</span> {currentAnalysis.confidence || "—"}</div>
                              {!!currentAnalysis.evidence?.length && (
                                <div>
                                  <div className="text-sm font-medium mb-2">Evidence</div>
                                  <div className="space-y-2">
                                    {currentAnalysis.evidence.map((item, idx) => (
                                      <div key={idx} className="rounded-xl border border-slate-800 p-2 text-sm text-slate-300">
                                        {item}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {!!currentAnalysis.next_checks?.length && (
                                <div>
                                  <div className="text-sm font-medium mb-2">Next checks</div>
                                  <div className="space-y-2">
                                    {currentAnalysis.next_checks.map((item, idx) => (
                                      <div key={idx} className="rounded-xl border border-slate-800 p-2 text-sm text-slate-300">
                                        {item}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-slate-400">No analysis available yet. Use “Analyze incident”.</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                        <CardHeader>
                          <CardTitle className="text-base">Similar incidents</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[220px] pr-3">
                            <div className="space-y-3">
                              {(context?.similar_incidents || []).length === 0 && (
                                <div className="text-sm text-slate-400">No similar incidents found.</div>
                              )}
                              {(context?.similar_incidents || []).map((incident) => (
                                <div key={incident.id} className="rounded-2xl border border-slate-800 p-3 text-sm">
                                  <div className="font-medium">#{incident.id} · {incident.title}</div>
                                  <div className="text-slate-400 text-xs mt-1">{incident.status} · {fmtDate(incident.last_seen)}</div>
                                  <div className="text-slate-300 mt-2 leading-6">{incident.summary || "No summary."}</div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                        <CardHeader>
                          <CardTitle className="text-base">Nearby filtered events</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[220px] pr-3">
                            <div className="space-y-3">
                              {(context?.nearby_events_filtered || []).length === 0 && (
                                <div className="text-sm text-slate-400">No nearby filtered events.</div>
                              )}
                              {(context?.nearby_events_filtered || []).map((event) => (
                                <div key={event.id} className="rounded-2xl border border-slate-800 p-3 text-sm">
                                  <div className="text-xs text-slate-400 mb-1">{fmtDate(event.ts)} · {event.host} · {event.container}</div>
                                  <div className="text-slate-300 leading-6">{event.message}</div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
