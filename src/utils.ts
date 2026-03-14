/** If the raw string looks like an nxlog JSON wrapper, extract just the inner "message" field. */
export function extractMessageContent(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.message === "string" && parsed.message) return parsed.message;
  } catch {}
  const m = trimmed.match(/"message":"([\s\S]+?)","(?:source|host|container|stream|level)"/);
  if (m) return m[1];
  return trimmed;
}

/** Test a Python-style regex pattern against an array of strings.
 *  Handles (?i) prefix by converting it to the JS `i` flag. */
export function testRegexPattern(pattern: string, messages: string[]): { valid: boolean; error?: string; matchCount: number } {
  if (!pattern.trim()) return { valid: false, error: "Pattern is empty", matchCount: 0 };
  let flags = "";
  let src = pattern;
  if (src.startsWith("(?i)")) { src = src.slice(4); flags = "i"; }
  try {
    const re = new RegExp(src, flags);
    const matchCount = messages.filter((m) => re.test(m)).length;
    return { valid: true, matchCount };
  } catch (e: any) {
    return { valid: false, error: e.message, matchCount: 0 };
  }
}

/** Convert a backend message_template into a ready-to-use regex. */
export function templateToRegex(template: string): string {
  const parts = template.split(/(<[^>]+>)/);
  const result = parts.map((part) =>
    /^<[^>]+>$/.test(part)
      ? "\\S+"
      : part.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")
  );
  return "(?i)" + result.join("");
}

export function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function severityTone(severity?: string) {
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

export function statusTone(status?: string) {
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
