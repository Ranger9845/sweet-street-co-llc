import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, err } from "../_utils";

const DEV_EMAIL = (process.env.DEV_CONSOLE_EMAIL ?? "ldfarris2007@gmail.com").toLowerCase();
const REPO = "Ranger9845/sweet-street-co-llc";

function isDevCaller(req: VercelRequest): boolean {
  const email = (req.headers["x-clerk-user-email"] as string | undefined)?.toLowerCase();
  return !!email && email === DEV_EMAIL;
}

interface LogEntry {
  level: "log" | "info" | "warn" | "error";
  msg: string;
  ts: string;
}

function buildBody(fields: {
  summary: string;
  url?: string;
  userAgent?: string;
  logs: LogEntry[];
}) {
  const { summary, url, userAgent, logs } = fields;
  const lines: string[] = [];

  lines.push(summary.trim() || "_No summary provided._");
  lines.push("");
  lines.push("---");
  if (url) lines.push(`**Page:** ${url}`);
  if (userAgent) lines.push(`**User agent:** ${userAgent}`);
  lines.push(`**Reported:** ${new Date().toISOString()}`);
  lines.push("");

  if (logs.length > 0) {
    lines.push(`<details><summary>Console logs (${logs.length})</summary>`);
    lines.push("");
    lines.push("```");
    for (const l of logs) {
      const time = l.ts.split("T")[1]?.split(".")[0] ?? l.ts;
      lines.push(`[${l.level.toUpperCase()}] ${time} ${l.msg}`);
    }
    lines.push("```");
    lines.push("</details>");
  } else {
    lines.push("_No console logs captured._");
  }

  lines.push("");
  lines.push("_Sent from the Dev Console live-log reporter._");

  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");
  if (!isDevCaller(req)) return err(res, 403, "Forbidden");

  const token = process.env.GITHUB_ISSUES_TOKEN;
  if (!token) return err(res, 500, "GITHUB_ISSUES_TOKEN not configured");

  const summary: string = (req.body?.summary ?? "").toString();
  const url: string | undefined = req.body?.url;
  const userAgent: string | undefined = req.body?.userAgent;
  const logs: LogEntry[] = Array.isArray(req.body?.logs) ? req.body.logs : [];

  if (!summary.trim()) return err(res, 400, "summary is required");

  const title = `[Dev Console] ${summary.slice(0, 72)}${summary.length > 72 ? "…" : ""}`;
  const body = buildBody({ summary, url, userAgent, logs });

  const ghRes = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ title, body, labels: ["dev-console", "bug"] }),
  });

  if (!ghRes.ok) {
    const text = await ghRes.text().catch(() => "");
    return err(res, 502, `GitHub API error: ${ghRes.status} ${text.slice(0, 200)}`);
  }

  const issue = await ghRes.json();
  return res.status(201).json({ ok: true, issueUrl: issue.html_url, issueNumber: issue.number });
}
