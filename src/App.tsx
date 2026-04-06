import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, RefreshCw, ServerCrash, Search, Activity, FileSearch, ShieldAlert, X, ChevronDown, ChevronUp, BellOff, Trash2, List, Bell, Cpu, CalendarDays, CalendarRange } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Digest, Incident, IncidentDetail, IncidentContext, SuppressRule, LogEvent, NtfyEntry, LlmLogEntry, LlmStats, EventStats, AnalyzeResponse } from "./types";
import { api, DEFAULT_BASE_URL, STORAGE_KEY } from "./api";
import { extractMessageContent, testRegexPattern, templateToRegex, classNames, fmtDate, severityTone, statusTone } from "./utils";
import IncidentChat from "./IncidentChat";

export default function HomelabIncidentDashboard() {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL);
  const [draftBaseUrl, setDraftBaseUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentTotal, setIncidentTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [context, setContext] = useState<IncidentContext | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [suppressLoading, setSuppressLoading] = useState(false);
  const [suppressScope, setSuppressScope] = useState<"fingerprint" | "event_class" | "event_class_host" | "message_regex">("event_class");
  const [suppressReason, setSuppressReason] = useState("");
  const [suppressHost, setSuppressHost] = useState("");
  const [suppressPattern, setSuppressPattern] = useState("");
  const [showSuppressInput, setShowSuppressInput] = useState(false);
  const [suppressRules, setSuppressRules] = useState<SuppressRule[]>([]);
  const [suppressRulesLoading, setSuppressRulesLoading] = useState(false);
  const [showSuppressRules, setShowSuppressRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawEvents, setShowRawEvents] = useState(false);
  const [showEventsPanel, setShowEventsPanel] = useState(false);
  const [logEvents, setLogEvents] = useState<LogEvent[]>([]);
  const [logEventsTotal, setLogEventsTotal] = useState(0);
  const [logEventsLoading, setLogEventsLoading] = useState(false);
  const [logHostFilter, setLogHostFilter] = useState("");
  const [logContainerFilter, setLogContainerFilter] = useState("");
  const [showNtfyLog, setShowNtfyLog] = useState(false);
  const [ntfyLog, setNtfyLog] = useState<NtfyEntry[]>([]);
  const [ntfyLogLoading, setNtfyLogLoading] = useState(false);
  const [showLlmLog, setShowLlmLog] = useState(false);
  const [llmLog, setLlmLog] = useState<LlmLogEntry[]>([]);
  const [llmLogLoading, setLlmLogLoading] = useState(false);
  const [showDailyReports, setShowDailyReports] = useState(false);
  const [dailyReports, setDailyReports] = useState<NtfyEntry[]>([]);
  const [dailyReportsLoading, setDailyReportsLoading] = useState(false);
  const [showWeeklyReports, setShowWeeklyReports] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState<NtfyEntry[]>([]);
  const [weeklyReportsLoading, setWeeklyReportsLoading] = useState(false);
  const [llmStats, setLlmStats] = useState<LlmStats | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  function buildIncidentsUrl(status: string, severity: string, limit: number, offset = 0) {
    let url = `/api/incidents?status=${status}&limit=${limit}&offset=${offset}`;
    if (severity && severity !== "all") url += `&severity=${severity}`;
    return url;
  }

  async function loadIncidents() {
    setIncidentsLoading(true);
    setError(null);
    try {
      const res = await api<{ items: Incident[]; total: number }>(
        baseUrl,
        buildIncidentsUrl(statusFilter, severityFilter, 50)
      );
      setIncidents(res.items || []);
      setIncidentTotal(res.total ?? res.items?.length ?? 0);
      setSelectedId((prev) => {
        if (!prev && res.items?.length) return res.items[0].id;
        if (prev && !res.items.some((i) => i.id === prev)) return res.items[0]?.id ?? null;
        return prev;
      });
    } catch (e: any) {
      setError(e.message || "Failed to load incidents");
    } finally {
      setIncidentsLoading(false);
    }
  }

  async function loadMoreIncidents() {
    setLoadMoreLoading(true);
    try {
      const res = await api<{ items: Incident[]; total: number }>(
        baseUrl,
        buildIncidentsUrl(statusFilter, severityFilter, 50, incidents.length)
      );
      setIncidents((prev) => [...prev, ...(res.items || [])]);
      setIncidentTotal(res.total ?? 0);
    } catch (e: any) {
      setError(e.message || "Failed to load more incidents");
    } finally {
      setLoadMoreLoading(false);
    }
  }

  async function loadDigest(refresh = false) {
    setDigestLoading(true);
    try {
      const digestRes = await api<Digest>(baseUrl, `/api/incidents/open/llm-digest${refresh ? "?refresh=true" : ""}`);
      setDigest(digestRes);
    } catch (e: any) {
      setError(e.message || "Failed to load digest");
    } finally {
      setDigestLoading(false);
    }
  }

  async function loadDetail(incidentId: number) {
    setDetailLoading(true);
    try {
      const detailRes = await api<IncidentDetail>(baseUrl, `/api/incidents/${incidentId}`);
      setDetail(detailRes);
      setAnalyzeResult(null);
      setShowRawEvents(false);
    } catch (e: any) {
      setError(e.message || "Failed to load incident detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadContext(incidentId: number) {
    setContextLoading(true);
    try {
      const contextRes = await api<IncidentContext>(baseUrl, `/api/incidents/${incidentId}/llm-context`);
      setContext(contextRes);
    } catch {
      setContext(null);
    } finally {
      setContextLoading(false);
    }
  }

  async function loadIncident(incidentId: number) {
    setError(null);
    loadDetail(incidentId);
    loadContext(incidentId);
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
      await loadIncidents();
      await loadIncident(selectedId);
    } catch (e: any) {
      setError(e.message || "Failed to analyze incident");
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function closeIncident() {
    if (!selectedId) return;
    setCloseLoading(true);
    setError(null);
    try {
      await api(baseUrl, `/api/incidents/${selectedId}?status=closed`, { method: "PATCH" });
      await loadIncidents();
      await loadDetail(selectedId);
    } catch (e: any) {
      setError(e.message || "Failed to close incident");
    } finally {
      setCloseLoading(false);
    }
  }

  async function reopenIncident() {
    if (!selectedId) return;
    setReopenLoading(true);
    setError(null);
    try {
      await api(baseUrl, `/api/incidents/${selectedId}?status=open`, { method: "PATCH" });
      await loadIncidents();
      await loadDetail(selectedId);
    } catch (e: any) {
      setError(e.message || "Failed to reopen incident");
    } finally {
      setReopenLoading(false);
    }
  }

  async function suppressIncident() {
    if (!selectedId) return;
    setSuppressLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ scope: suppressScope });
      if (suppressReason.trim()) p.set("reason", suppressReason.trim());
      if (suppressScope === "event_class_host" && suppressHost.trim()) p.set("match_host", suppressHost.trim());
      if (suppressScope === "message_regex") p.set("match_pattern", suppressPattern.trim());
      await api(baseUrl, `/api/incidents/${selectedId}/suppress?${p}`, { method: "POST" });
      setShowSuppressInput(false);
      setSuppressReason("");
      setSuppressHost("");
      setSuppressPattern("");
      await loadIncidents();
      await loadSuppressRules();
    } catch (e: any) {
      setError(e.message || "Failed to suppress incident");
    } finally {
      setSuppressLoading(false);
    }
  }

  async function loadSuppressRules() {
    setSuppressRulesLoading(true);
    try {
      const res = await api<{ items: SuppressRule[] }>(baseUrl, "/api/suppress-rules");
      setSuppressRules(res.items || []);
    } catch {
      // non-fatal
    } finally {
      setSuppressRulesLoading(false);
    }
  }

  async function deleteSuppressRule(ruleId: number) {
    try {
      await api(baseUrl, `/api/suppress-rules/${ruleId}`, { method: "DELETE" });
      setSuppressRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e: any) {
      setError(e.message || "Failed to delete suppress rule");
    }
  }

  async function loadNtfyLog() {
    setNtfyLogLoading(true);
    try {
      const res = await api<{ items: NtfyEntry[] }>(baseUrl, "/api/ntfy-log?limit=50");
      setNtfyLog(res.items || []);
    } catch {
      // non-fatal
    } finally {
      setNtfyLogLoading(false);
    }
  }

  async function loadLlmLog() {
    setLlmLogLoading(true);
    try {
      const res = await api<{ items: LlmLogEntry[] }>(baseUrl, "/api/llm-log?limit=50");
      setLlmLog(res.items || []);
    } catch {
      // non-fatal
    } finally {
      setLlmLogLoading(false);
    }
  }

  async function loadDailyReports() {
    setDailyReportsLoading(true);
    try {
      const res = await api<{ items: NtfyEntry[] }>(baseUrl, "/api/reports/daily?limit=50");
      setDailyReports(res.items || []);
    } catch {
      // non-fatal
    } finally {
      setDailyReportsLoading(false);
    }
  }

  async function loadWeeklyReports() {
    setWeeklyReportsLoading(true);
    try {
      const res = await api<{ items: NtfyEntry[] }>(baseUrl, "/api/reports/weekly?limit=50");
      setWeeklyReports(res.items || []);
    } catch {
      // non-fatal
    } finally {
      setWeeklyReportsLoading(false);
    }
  }

  async function loadLlmStats() {
    try {
      const res = await api<LlmStats>(baseUrl, "/api/llm-stats?days=30");
      setLlmStats(res);
    } catch {
      // non-fatal
    }
  }

  async function loadEventStats() {
    try {
      const res = await api<EventStats>(baseUrl, "/api/event-stats?days=30");
      setEventStats(res);
    } catch {
      // non-fatal
    }
  }

  async function loadLogEvents(append = false) {
    setLogEventsLoading(true);
    try {
      const p = new URLSearchParams({ limit: "100", offset: append ? String(logEvents.length) : "0" });
      if (logHostFilter.trim()) p.set("host", logHostFilter.trim());
      if (logContainerFilter.trim()) p.set("container", logContainerFilter.trim());
      const res = await api<{ items: LogEvent[]; total: number }>(baseUrl, `/api/events?${p}`);
      setLogEvents((prev) => append ? [...prev, ...(res.items || [])] : (res.items || []));
      setLogEventsTotal(res.total ?? 0);
    } catch {
      // non-fatal
    } finally {
      setLogEventsLoading(false);
    }
  }

  useEffect(() => {
    loadIncidents();
    loadDigest();
    loadSuppressRules();
    loadLlmStats();
    loadEventStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  // Reload incidents (no LLM) when filters change
  useEffect(() => {
    loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, severityFilter]);

  // Auto-refresh incident list every 30s using refs to avoid stale closures
  const baseUrlRef = useRef(baseUrl);
  const statusFilterRef = useRef(statusFilter);
  const severityFilterRef = useRef(severityFilter);
  useEffect(() => { baseUrlRef.current = baseUrl; }, [baseUrl]);
  useEffect(() => { statusFilterRef.current = statusFilter; }, [statusFilter]);
  useEffect(() => { severityFilterRef.current = severityFilter; }, [severityFilter]);

  useEffect(() => {
    autoRefreshRef.current = setInterval(async () => {
      try {
        const url = buildIncidentsUrl(statusFilterRef.current, severityFilterRef.current, 50);
        const res = await api<{ items: Incident[]; total: number }>(baseUrlRef.current, url);
        setIncidents(res.items || []);
        setIncidentTotal(res.total ?? res.items?.length ?? 0);
      } catch {
        // silent — user will see stale data until next successful refresh
      }
    }, 30_000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedId != null) {
      loadIncident(selectedId);
      setShowSuppressInput(false);
      setSuppressReason("");
      setSuppressHost("");
      setSuppressPattern("");
    } else {
      setDetail(null);
      setContext(null);
      setAnalyzeResult(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (showSuppressRules) loadSuppressRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuppressRules]);

  useEffect(() => {
    if (showNtfyLog) loadNtfyLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNtfyLog]);

  useEffect(() => {
    if (showLlmLog) loadLlmLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLlmLog]);

  useEffect(() => {
    if (showDailyReports) loadDailyReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDailyReports]);

  useEffect(() => {
    if (showWeeklyReports) loadWeeklyReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWeeklyReports]);

  // Auto-fill message_regex pattern whenever the panel opens or scope switches to message_regex
  useEffect(() => {
    if (showSuppressInput && suppressScope === "message_regex" && !suppressPattern) {
      const firstEvent = detail?.events?.[0];
      const raw = firstEvent?.message_template || firstEvent?.message || "";
      const content = extractMessageContent(raw);
      if (content) setSuppressPattern(templateToRegex(content));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuppressInput, suppressScope]);

  // Load + auto-refresh events panel when open
  const showEventsPanelRef = useRef(showEventsPanel);
  const baseUrlRefE = useRef(baseUrl);
  const logHostFilterRef = useRef(logHostFilter);
  const logContainerFilterRef = useRef(logContainerFilter);
  useEffect(() => { showEventsPanelRef.current = showEventsPanel; }, [showEventsPanel]);
  useEffect(() => { baseUrlRefE.current = baseUrl; }, [baseUrl]);
  useEffect(() => { logHostFilterRef.current = logHostFilter; }, [logHostFilter]);
  useEffect(() => { logContainerFilterRef.current = logContainerFilter; }, [logContainerFilter]);

  useEffect(() => {
    if (showEventsPanel) loadLogEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEventsPanel, logHostFilter, logContainerFilter]);

  useEffect(() => {
    eventsRefreshRef.current = setInterval(async () => {
      if (!showEventsPanelRef.current) return;
      try {
        const p = new URLSearchParams({ limit: "100", offset: "0" });
        if (logHostFilterRef.current.trim()) p.set("host", logHostFilterRef.current.trim());
        if (logContainerFilterRef.current.trim()) p.set("container", logContainerFilterRef.current.trim());
        const res = await api<{ items: LogEvent[]; total: number }>(baseUrlRefE.current, `/api/events?${p}`);
        setLogEvents(res.items || []);
        setLogEventsTotal(res.total ?? 0);
      } catch { /* silent */ }
    }, 10_000);
    return () => { if (eventsRefreshRef.current) clearInterval(eventsRefreshRef.current); };
  }, []);

  const currentAnalysis = analyzeResult?.analysis || detail?.incident?.analysis_json || null;
  const hasMore = incidents.length < incidentTotal;

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
                  <Button variant="outline" className="border-slate-700 bg-slate-900" onClick={loadIncidents} disabled={incidentsLoading}>
                    <RefreshCw className={classNames("h-4 w-4 mr-2", incidentsLoading && "animate-spin")} /> Refresh
                  </Button>
                  <Button variant="outline" className="border-slate-700 bg-slate-900" onClick={() => loadDigest(true)} disabled={digestLoading} title="Re-run LLM digest (slow)">
                    <RefreshCw className={classNames("h-4 w-4 mr-2", digestLoading && "animate-spin")} /> Regen Digest
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                  <CardContent className="p-4">
                    <div className="text-slate-400 text-sm flex items-center gap-1.5">
                      {digest?.overall_status === "healthy" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />}
                      Status · <span className={statusTone(digest?.overall_status)}>{digest?.overall_status || "unknown"}</span>
                    </div>
                    <div className="mt-2 text-xl font-semibold text-cyan-300">{(eventStats?.total_stored ?? 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">events ({eventStats?.period_days ?? 30}d)</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">{digest?.source_incident_count ?? 0} open · {(eventStats?.total_ignored ?? 0).toLocaleString()} ignored · {eventStats?.active_suppress_rules ?? 0} rules</div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                  <CardContent className="p-4">
                    <div className="text-slate-400 text-sm flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-purple-400" /> LLM ({llmStats?.period_days ?? 30}d)</div>
                    <div className="mt-2 text-xl font-semibold text-purple-300">{llmStats?.total_calls ?? 0} calls<span className="text-sm font-normal text-slate-400"> · {llmStats?.avg_seconds ?? 0}s avg · {((llmStats?.total_tokens ?? 0) / 1000).toFixed(1)}k tokens</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">{llmStats && llmStats.total_errors > 0 ? <span className="text-red-400">{llmStats.total_errors} errors · </span> : null}{((llmStats?.total_prompt_tokens ?? 0) / 1000).toFixed(1)}k in / {((llmStats?.total_completion_tokens ?? 0) / 1000).toFixed(1)}k out</div>
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
                    const url = draftBaseUrl.trim();
                    localStorage.setItem(STORAGE_KEY, url);
                    setBaseUrl(url);
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
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <span className="text-red-200">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-red-400 hover:text-red-200 hover:bg-red-950/60 -mt-1 -mr-1"
                onClick={() => setError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl min-h-[700px]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><FileSearch className="h-5 w-5" /> Incidents</CardTitle>
                  <CardDescription>
                    {incidentsLoading ? "Loading…" : `${incidentTotal} total · ${filteredIncidents.length} shown`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[120px] bg-slate-950 border-slate-800 rounded-2xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-[130px] bg-slate-950 border-slate-800 rounded-2xl">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severity</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
            <CardContent className="h-[580px] flex flex-col">
              <ScrollArea className="flex-1 min-h-0 pr-3">
                <div className="space-y-3">
                  {filteredIncidents.length === 0 && !incidentsLoading && (
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
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={classNames("border", severityTone(incident.severity))}>
                            {incident.severity}
                          </Badge>
                          {incident.status === "closed" && (
                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                              closed
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-slate-300 mt-3 line-clamp-3">
                        {incident.summary || "No summary yet."}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>events: {incident.event_count}</span>
                        <span>last seen: {fmtDate(incident.last_seen)}</span>
                        {incident.last_analyzed_at && (
                          <span className="text-sky-400/70">analyzed: {fmtDate(incident.last_analyzed_at)}</span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                  {hasMore && !search && (
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl border-slate-700 bg-slate-950/60"
                      onClick={loadMoreIncidents}
                      disabled={loadMoreLoading}
                    >
                      {loadMoreLoading
                        ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
                        : `Load more (${incidentTotal - incidents.length} remaining)`
                      }
                    </Button>
                  )}
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
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={analyzeIncident} disabled={!selectedId || analyzeLoading} className="rounded-2xl">
                      <RefreshCw className={classNames("h-4 w-4 mr-2", analyzeLoading && "animate-spin")} />
                      Analyze
                    </Button>
                    {detail?.incident?.status === "open" && (
                      <Button
                        variant="outline"
                        className="rounded-2xl border-slate-700 bg-slate-900"
                        onClick={closeIncident}
                        disabled={closeLoading}
                      >
                        {closeLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                        Close
                      </Button>
                    )}
                    {detail?.incident?.status === "closed" && (
                      <Button
                        variant="outline"
                        className="rounded-2xl border-emerald-800 bg-slate-900 text-emerald-400 hover:text-emerald-300"
                        onClick={reopenIncident}
                        disabled={reopenLoading}
                      >
                        {reopenLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                        Re-open
                      </Button>
                    )}
                    {detail?.incident && (
                      <Button
                        variant="outline"
                        className="rounded-2xl border-slate-700 bg-slate-900 text-slate-400 hover:text-orange-300 hover:border-orange-800"
                        onClick={() => setShowSuppressInput((v) => !v)}
                        title="Suppress this incident type permanently"
                      >
                        <BellOff className="h-4 w-4 mr-2" />
                        Suppress
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showSuppressInput && detail?.incident && (
                  <div className="rounded-2xl border border-orange-900/50 bg-orange-950/30 p-4 space-y-3">
                    <div className="text-sm font-medium text-orange-300 flex items-center gap-2">
                      <BellOff className="h-4 w-4" />
                      Suppress this incident type
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-slate-400 mb-1">Scope</div>
                      <div className="grid grid-cols-2 gap-2">
                        {(["event_class", "event_class_host", "message_regex", "fingerprint"] as const).map((s) => {
                          const fp = detail.incident.primary_fingerprint || "";
                          const ec = detail.incident.event_class || "?";
                          const labels: Record<string, { title: string; desc: string }> = {
                            event_class:      { title: "Event class",     desc: `all "${ec}" events, any source` },
                            event_class_host: { title: "Class + host",    desc: `"${ec}" from one specific node` },
                            message_regex:    { title: "Message pattern", desc: "regex matched against log text" },
                            fingerprint:      { title: "Exact pattern",   desc: fp },
                          };
                          return (
                            <button
                              key={s}
                              onClick={() => setSuppressScope(s)}
                              title={s === "fingerprint" ? fp : undefined}
                              className={classNames(
                                "rounded-xl border p-2 text-left text-xs transition-all",
                                suppressScope === s
                                  ? "border-orange-600 bg-orange-900/40 text-orange-200"
                                  : "border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-600"
                              )}
                            >
                              <div className="font-medium">{labels[s].title}</div>
                              <div className={classNames(
                                "text-slate-500 mt-0.5 leading-4",
                                s === "fingerprint" && "font-mono truncate"
                              )}>
                                {labels[s].desc}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {suppressScope === "event_class_host" && (
                      <Input
                        value={suppressHost}
                        onChange={(e) => setSuppressHost(e.target.value)}
                        placeholder={`Host (e.g. ${detail.incident.affected_nodes?.[0] || "proxmox"})`}
                        className="bg-slate-950 border-slate-700 rounded-2xl text-sm"
                      />
                    )}

                    {suppressScope === "message_regex" && (() => {
                      // Test against extracted inner message (strips nxlog JSON wrapper) for accurate match count
                      const eventMessages = (detail.events || []).map((e) => extractMessageContent(e.message || e.message_template || ""));
                      const { valid, error: regexError, matchCount } = testRegexPattern(suppressPattern, eventMessages);
                      const total = eventMessages.length;
                      return (
                        <div className="space-y-1.5">
                          <div className="text-xs text-slate-400">
                            Pattern <span className="text-slate-500">(Python regex — pre-filled from the event template, edit specific names like engine/host to <code className="font-mono text-slate-400">\w+</code> if you want broader matching)</span>
                          </div>
                          <textarea
                            value={suppressPattern}
                            onChange={(e) => setSuppressPattern(e.target.value)}
                            rows={3}
                            spellCheck={false}
                            placeholder="e.g. (?i)searx\.engines\.\w+: HTTP requests timeout"
                            className={classNames(
                              "w-full rounded-2xl border bg-slate-950 px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none",
                              !suppressPattern.trim() ? "border-slate-700 focus:border-orange-700"
                                : valid && matchCount > 0 ? "border-emerald-700 focus:border-emerald-600"
                                : valid && matchCount === 0 ? "border-yellow-700 focus:border-yellow-600"
                                : "border-red-700 focus:border-red-600"
                            )}
                          />
                          {suppressPattern.trim() && (
                            <div className={classNames(
                              "text-xs flex items-center gap-1.5",
                              !valid ? "text-red-400" : matchCount > 0 ? "text-emerald-400" : "text-yellow-400"
                            )}>
                              {!valid && <><span>✗ Invalid regex:</span><span className="font-mono">{regexError}</span></>}
                              {valid && matchCount > 0 && <span>✓ Matches {matchCount} of {total} events in this incident</span>}
                              {valid && matchCount === 0 && <span>⚠ Valid regex but matches none of the {total} events — pattern may be too narrow</span>}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <Input
                      value={suppressReason}
                      onChange={(e) => setSuppressReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="bg-slate-950 border-slate-700 rounded-2xl text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={suppressIncident}
                        disabled={
                          suppressLoading ||
                          (suppressScope === "event_class_host" && !suppressHost.trim()) ||
                          (suppressScope === "message_regex" && !suppressPattern.trim()) ||
                          (suppressScope === "message_regex" && suppressPattern.trim().length > 0 && !testRegexPattern(suppressPattern, (detail?.events || []).map((e) => extractMessageContent(e.message || e.message_template || ""))).valid)
                        }
                        className="rounded-2xl bg-orange-700 hover:bg-orange-600 text-white"
                      >
                        {suppressLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                        Confirm suppress
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl border-slate-700"
                        onClick={() => { setShowSuppressInput(false); setSuppressReason(""); setSuppressHost(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {!selectedId && <div className="text-sm text-slate-400">No incident selected.</div>}
                {selectedId && detailLoading && <div className="text-sm text-slate-400">Loading incident details…</div>}
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
                          {contextLoading ? (
                            <div className="text-sm text-slate-400 py-4">Loading context…</div>
                          ) : (
                            <ScrollArea className="h-[260px] pr-3">
                              <div className="space-y-3">
                                {(context?.representative_events || []).length === 0 && (
                                  <div className="text-sm text-slate-400">No representative events.</div>
                                )}
                                {context?.representative_events?.map((event) => (
                                  <div key={event.id} className="rounded-2xl border border-slate-800 p-3 text-sm overflow-hidden">
                                    <div className="flex items-center gap-2 flex-wrap text-xs mb-2">
                                      <span className="text-slate-500">{fmtDate(event.ts)}</span>
                                      <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs py-0">{event.host}</Badge>
                                      <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs py-0">{event.container}</Badge>
                                      {event.severity_norm && event.severity_norm !== "info" && (
                                        <Badge variant="outline" className={classNames("text-xs py-0",
                                          event.severity_norm === "critical" ? "border-red-800 text-red-400"
                                          : event.severity_norm === "error" ? "border-orange-800 text-orange-400"
                                          : "border-yellow-800 text-yellow-400"
                                        )}>{event.severity_norm}</Badge>
                                      )}
                                    </div>
                                    <pre className="styled-scroll text-xs text-slate-200 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">{event.message}</pre>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
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
                            <div className="text-sm text-slate-400">No analysis available yet. Use "Analyze incident".</div>
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
                          {contextLoading ? (
                            <div className="text-sm text-slate-400 py-4">Loading context…</div>
                          ) : (
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
                          )}
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
                        <CardHeader>
                          <CardTitle className="text-base">Nearby filtered events</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {contextLoading ? (
                            <div className="text-sm text-slate-400 py-4">Loading context…</div>
                          ) : (
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
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <IncidentChat baseUrl={baseUrl} incidentId={selectedId!} />

                    {/* Raw events collapsible */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60">
                      <button
                        className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
                        onClick={() => setShowRawEvents((v) => !v)}
                      >
                        <span>Raw events ({detail.events?.length ?? 0})</span>
                        {showRawEvents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {showRawEvents && (
                        <div className="px-4 pb-4">
                          <ScrollArea className="h-[320px] pr-3">
                            <div className="space-y-2">
                              {(detail.events || []).length === 0 && (
                                <div className="text-sm text-slate-400">No raw events.</div>
                              )}
                              {(detail.events || []).map((event) => (
                                <div key={event.id} className="rounded-xl border border-slate-800 p-3 text-sm font-mono">
                                  <div className="text-slate-400 text-xs mb-1">
                                    {fmtDate(event.ts)} · {event.host} · {event.container}
                                    {event.level && <span className="ml-2 text-slate-500">[{event.level}]</span>}
                                  </div>
                                  <div className="text-slate-200 leading-5 break-all">{event.message}</div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Suppression rules panel */}
        <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
          <button
            className="w-full flex items-center justify-between p-6 text-left"
            onClick={() => setShowSuppressRules((v) => !v)}
          >
            <div>
              <div className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <BellOff className="h-5 w-5 text-orange-400" />
                Suppression rules
                {suppressRules.length > 0 && (
                  <Badge variant="outline" className="border-orange-800 text-orange-300 ml-1">
                    {suppressRules.length}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Incident types that are permanently silenced.
              </div>
            </div>
            {showSuppressRules ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showSuppressRules && (
            <CardContent className="pt-0 space-y-3">
              {suppressRulesLoading && (
                <div className="text-sm text-slate-400">Loading…</div>
              )}
              {!suppressRulesLoading && suppressRules.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No suppression rules. Use the "Suppress" button on an incident to add one.
                </div>
              )}
              {suppressRules.map((rule) => {
                const scopeLabel = {
                  fingerprint: "Exact pattern",
                  event_class: "All by class",
                  event_class_host: "Class + host",
                  message_regex: "Message pattern",
                }[rule.match_type] ?? rule.match_type;
                return (
                  <div key={rule.id} className="rounded-2xl border border-orange-900/30 bg-orange-950/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-200">{rule.incident_title || "—"}</span>
                          <Badge variant="outline" className="border-orange-800/50 text-orange-400/80 text-xs">
                            {scopeLabel}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400 space-x-3">
                          {rule.event_class && <span>class: <span className="text-slate-300">{rule.event_class}</span></span>}
                          {rule.match_host && <span>host: <span className="text-slate-300">{rule.match_host}</span></span>}
                          {rule.match_type === "fingerprint" && (
                            <span className="font-mono text-slate-500 break-all">{rule.canonical_fingerprint}</span>
                          )}
                        </div>
                        {rule.match_type === "message_regex" && rule.match_pattern && (
                          <div className="font-mono text-xs text-slate-400 bg-slate-900 rounded-lg px-2 py-1 mt-1 break-all">
                            {rule.match_pattern}
                          </div>
                        )}
                        {rule.reason && (
                          <div className="text-xs text-orange-300/70">Reason: {rule.reason}</div>
                        )}
                        <div className="text-xs text-slate-500">
                          Added {fmtDate(rule.created_at)}
                          {rule.hit_count > 0 && (
                            <span className="ml-3 text-orange-400/70">{rule.hit_count.toLocaleString()} events suppressed</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-950/40"
                        onClick={() => deleteSuppressRule(rule.id)}
                        title="Lift suppression"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Daily reports panel */}
        <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
          <button
            className="w-full flex items-center justify-between p-6 text-left"
            onClick={() => setShowDailyReports((v) => !v)}
          >
            <div>
              <div className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <CalendarDays className="h-5 w-5 text-cyan-400" />
                Daily reports
                {dailyReports.length > 0 && (
                  <Badge variant="outline" className="border-cyan-800 text-cyan-300 ml-1">
                    {dailyReports.length}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                LLM-generated daily health reports.
              </div>
            </div>
            {showDailyReports ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showDailyReports && (
            <CardContent className="pt-0 space-y-3">
              {dailyReportsLoading && <div className="text-sm text-slate-400">Loading...</div>}
              {!dailyReportsLoading && dailyReports.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No daily reports yet.
                </div>
              )}
              {dailyReports.map((entry) => {
                const statusMatch = entry.message.match(/Overall Status:\s*(Healthy|Warning|Critical)/i);
                const status = statusMatch ? statusMatch[1].toLowerCase() : null;
                const statusColor = status === "critical" ? "text-red-400 border-red-800"
                  : status === "warning" ? "text-orange-400 border-orange-800"
                  : status === "healthy" ? "text-emerald-400 border-emerald-800"
                  : "text-slate-400 border-slate-700";
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {status && (
                        <Badge variant="outline" className={classNames("text-xs", statusColor)}>
                          {status}
                        </Badge>
                      )}
                      <Badge variant="outline" className={classNames("text-xs", entry.priority === "urgent" ? "text-red-400 border-red-800" : entry.priority === "high" ? "text-orange-400 border-orange-800" : "text-slate-400 border-slate-700")}>
                        {entry.priority}
                      </Badge>
                      <span className="text-xs text-slate-500">{fmtDate(entry.sent_at)}</span>
                    </div>
                    <pre className="styled-scroll text-xs text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto">{entry.message}</pre>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Weekly reports panel */}
        <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
          <button
            className="w-full flex items-center justify-between p-6 text-left"
            onClick={() => setShowWeeklyReports((v) => !v)}
          >
            <div>
              <div className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <CalendarRange className="h-5 w-5 text-indigo-400" />
                Weekly reports
                {weeklyReports.length > 0 && (
                  <Badge variant="outline" className="border-indigo-800 text-indigo-300 ml-1">
                    {weeklyReports.length}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                LLM-generated weekly reliability reports.
              </div>
            </div>
            {showWeeklyReports ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showWeeklyReports && (
            <CardContent className="pt-0 space-y-3">
              {weeklyReportsLoading && <div className="text-sm text-slate-400">Loading...</div>}
              {!weeklyReportsLoading && weeklyReports.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No weekly reports yet.
                </div>
              )}
              {weeklyReports.map((entry) => {
                const statusMatch = entry.message.match(/Overall Status:\s*(Healthy|Warning|Critical)/i);
                const status = statusMatch ? statusMatch[1].toLowerCase() : null;
                const statusColor = status === "critical" ? "text-red-400 border-red-800"
                  : status === "warning" ? "text-orange-400 border-orange-800"
                  : status === "healthy" ? "text-emerald-400 border-emerald-800"
                  : "text-slate-400 border-slate-700";
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {status && (
                        <Badge variant="outline" className={classNames("text-xs", statusColor)}>
                          {status}
                        </Badge>
                      )}
                      <Badge variant="outline" className={classNames("text-xs", entry.priority === "urgent" ? "text-red-400 border-red-800" : entry.priority === "high" ? "text-orange-400 border-orange-800" : "text-slate-400 border-slate-700")}>
                        {entry.priority}
                      </Badge>
                      <span className="text-xs text-slate-500">{fmtDate(entry.sent_at)}</span>
                    </div>
                    <pre className="styled-scroll text-xs text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto">{entry.message}</pre>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Notification log panel */}
        <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
          <button
            className="w-full flex items-center justify-between p-6 text-left"
            onClick={() => setShowNtfyLog((v) => !v)}
          >
            <div>
              <div className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <Bell className="h-5 w-5 text-amber-400" />
                Notification log
                {ntfyLog.length > 0 && (
                  <Badge variant="outline" className="border-amber-800 text-amber-300 ml-1">
                    {ntfyLog.length}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Recent ntfy notifications sent by the system.
              </div>
            </div>
            {showNtfyLog ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showNtfyLog && (
            <CardContent className="pt-0 space-y-3">
              {ntfyLogLoading && <div className="text-sm text-slate-400">Loading...</div>}
              {!ntfyLogLoading && ntfyLog.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No notifications sent yet.
                </div>
              )}
              {ntfyLog.map((entry) => {
                const priorityColor = entry.priority === "urgent" ? "text-red-400 border-red-800"
                  : entry.priority === "high" ? "text-orange-400 border-orange-800"
                  : "text-slate-400 border-slate-700";
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant="outline" className={classNames("text-xs", priorityColor)}>
                        {entry.priority}
                      </Badge>
                      <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                        {entry.source}
                      </Badge>
                      <span className="text-xs text-slate-500">{fmtDate(entry.sent_at)}</span>
                    </div>
                    <pre className="styled-scroll text-xs text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">{entry.message}</pre>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* LLM call log panel */}
        <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
          <button
            className="w-full flex items-center justify-between p-6 text-left"
            onClick={() => setShowLlmLog((v) => !v)}
          >
            <div>
              <div className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <Cpu className="h-5 w-5 text-purple-400" />
                LLM call log
                {llmLog.length > 0 && (
                  <Badge variant="outline" className="border-purple-800 text-purple-300 ml-1">
                    {llmLog.length}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Recent Ollama API calls with response previews and token usage.
              </div>
            </div>
            {showLlmLog ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showLlmLog && (
            <CardContent className="pt-0 space-y-3">
              {llmLogLoading && <div className="text-sm text-slate-400">Loading...</div>}
              {!llmLogLoading && llmLog.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No LLM calls recorded yet.
                </div>
              )}
              {llmLog.map((entry) => {
                const statusColor = entry.error ? "text-red-400 border-red-800" : "text-emerald-400 border-emerald-800";
                const totalTokens = (entry.prompt_tokens || 0) + (entry.completion_tokens || 0);
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant="outline" className={classNames("text-xs", statusColor)}>
                        {entry.error ? "error" : "ok"}
                      </Badge>
                      <Badge variant="outline" className="border-purple-800 text-purple-300 text-xs">
                        {entry.caller || "unknown"}
                      </Badge>
                      {entry.model && (
                        <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                          {entry.model}
                        </Badge>
                      )}
                      <span className="text-xs text-slate-500">{fmtDate(entry.called_at)}</span>
                      <span className="text-xs text-slate-500 ml-auto">
                        {entry.duration_seconds.toFixed(1)}s
                        {totalTokens > 0 && ` · ${totalTokens.toLocaleString()} tok (${(entry.prompt_tokens || 0).toLocaleString()} in / ${(entry.completion_tokens || 0).toLocaleString()} out)`}
                      </span>
                    </div>
                    {entry.response_preview && (
                      <pre className="styled-scroll text-xs text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">{entry.response_preview}</pre>
                    )}
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Recent events panel */}
        <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
          <button
            className="w-full flex items-center justify-between p-6 text-left"
            onClick={() => setShowEventsPanel((v) => !v)}
          >
            <div>
              <div className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <List className="h-5 w-5 text-sky-400" />
                Recent events
                {logEventsTotal > 0 && (
                  <Badge variant="outline" className="border-sky-800 text-sky-300 ml-1">
                    {logEventsTotal.toLocaleString()} total
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Last received log events, auto-refreshes every 10s.
              </div>
            </div>
            {showEventsPanel ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>
          {showEventsPanel && (
            <CardContent className="pt-0 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={logHostFilter}
                  onChange={(e) => setLogHostFilter(e.target.value)}
                  placeholder="Filter by host…"
                  className="bg-slate-950 border-slate-800 rounded-2xl w-48 text-sm"
                />
                <Input
                  value={logContainerFilter}
                  onChange={(e) => setLogContainerFilter(e.target.value)}
                  placeholder="Filter by container…"
                  className="bg-slate-950 border-slate-800 rounded-2xl w-52 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-slate-700 bg-slate-900"
                  onClick={() => loadLogEvents()}
                  disabled={logEventsLoading}
                >
                  <RefreshCw className={classNames("h-4 w-4", logEventsLoading && "animate-spin")} />
                </Button>
              </div>
              {logEventsLoading && logEvents.length === 0 && (
                <div className="text-sm text-slate-400">Loading…</div>
              )}
              {!logEventsLoading && logEvents.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No events found.
                </div>
              )}
              <ScrollArea className="h-[480px] pr-3">
                <div className="space-y-1.5">
                  {logEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm font-mono grid gap-x-3"
                      style={{ gridTemplateColumns: "auto 1fr" }}
                    >
                      <div className="text-slate-500 text-xs whitespace-nowrap pt-0.5 space-y-0.5">
                        <div>{fmtDate(ev.ts)}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400">{ev.host}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-sky-400/70">{ev.container}</span>
                          {ev.level && (
                            <>
                              <span className="text-slate-600">·</span>
                              <Badge variant="outline" className={classNames("border text-xs px-1 py-0", severityTone(ev.severity_norm || ev.level))}>
                                {ev.level}
                              </Badge>
                            </>
                          )}
                          {ev.suppressed === 1 && (
                            <>
                              <span className="text-slate-600">·</span>
                              <Badge variant="outline" className="border text-xs px-1 py-0 bg-amber-500/15 text-amber-300 border-amber-500/30">
                                suppressed
                              </Badge>
                            </>
                          )}
                          {ev.incident_id && (
                            <>
                              <span className="text-slate-600">·</span>
                              <button
                                className="text-orange-400/80 hover:text-orange-300 text-xs"
                                onClick={() => { setSelectedId(ev.incident_id!); setShowEventsPanel(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                                title={`Jump to incident #${ev.incident_id}`}
                              >
                                #{ev.incident_id}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-slate-200 leading-5 break-all">{ev.message}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {logEvents.length < logEventsTotal && (
                <Button
                  variant="outline"
                  className="w-full rounded-2xl border-slate-700 bg-slate-950/60"
                  onClick={() => loadLogEvents(true)}
                  disabled={logEventsLoading}
                >
                  {logEventsLoading
                    ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
                    : `Load more (${logEventsTotal - logEvents.length} remaining)`}
                </Button>
              )}
            </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
}
