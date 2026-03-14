import React, { useEffect, useRef, useState } from "react";
import { Send, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage, ChatResponse } from "./types";
import { api } from "./api";

export default function IncidentChat({ baseUrl, incidentId }: { baseUrl: string; incidentId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [incidentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await api<ChatResponse>(baseUrl, `/api/incidents/${incidentId}/chat`, {
        method: "POST",
        body: JSON.stringify({ messages: updated }),
      });
      setMessages([...updated, { role: "assistant", content: res.response }]);
    } catch (e: any) {
      setError(e.message || "Failed to get response");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900/70 rounded-3xl shadow-2xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          Investigate with LLM
          <span className="text-xs text-slate-500 font-normal">Incident #{incidentId}</span>
        </CardTitle>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-300 -mt-1"
            onClick={() => { setMessages([]); setError(null); }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 && !loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            Ask questions about this incident. The LLM has full context including events, timeline, and any existing analysis.
          </div>
        )}

        {messages.length > 0 && (
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      msg.role === "user"
                        ? "max-w-[80%] rounded-2xl bg-blue-600/20 border border-blue-500/30 px-4 py-2.5 text-sm text-blue-100"
                        : "max-w-[90%] rounded-2xl bg-slate-950/80 border border-slate-700 px-4 py-2.5 text-sm text-slate-200"
                    }
                  >
                    {msg.role === "assistant" ? (
                      <div className="leading-6 whitespace-pre-wrap break-words prose-invert" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    ) : (
                      <div className="leading-6 whitespace-pre-wrap break-words">{msg.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-950/80 border border-slate-700 px-4 py-2.5 text-sm text-slate-400 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}

        {error && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this incident..."
            rows={1}
            className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600 resize-none"
            disabled={loading}
          />
          <Button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-2xl px-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Lightweight markdown-to-HTML for LLM responses. */
function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="rounded-lg bg-slate-900 border border-slate-700 p-3 my-2 overflow-x-auto text-xs"><code>${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1.5 py-0.5 rounded text-xs">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Headers
  html = html.replace(/^### (.+)$/gm, '<div class="font-semibold text-slate-100 mt-3 mb-1">$1</div>');
  html = html.replace(/^## (.+)$/gm, '<div class="font-semibold text-slate-100 mt-3 mb-1 text-base">$1</div>');
  html = html.replace(/^# (.+)$/gm, '<div class="font-bold text-slate-100 mt-3 mb-1 text-lg">$1</div>');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<div class="pl-4 before:content-[\'•\'] before:mr-2 before:text-slate-500">$1</div>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<div class="pl-4">$1</div>');

  // Line breaks (double newline = paragraph break)
  html = html.replace(/\n\n/g, '<div class="h-2"></div>');
  html = html.replace(/\n/g, "<br/>");

  return html;
}
