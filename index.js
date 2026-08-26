import { ipcMain as m, shell as B, BrowserWindow as $, dialog as Ee, app as g, Tray as xe, Menu as Te } from "electron";
import { createRequire as Ce } from "node:module";
import { fileURLToPath as Se } from "node:url";
import c from "node:path";
import x from "node:os";
import h from "node:fs/promises";
import le from "node-fetch";
import { exec as Re } from "node:child_process";
import { promisify as Ie } from "node:util";
import De from "better-sqlite3";
import Le from "auto-launch";
import Y from "node:crypto";
import Ne from "electron-updater";
import R from "node:fs";
import { v4 as _e } from "uuid";
function E(...t) {
  return c.join(x.homedir(), ...t);
}
function U(t, e) {
  return Y.createHash("sha1").update(`${t}:${e}`).digest("hex").slice(0, 16);
}
function F(t) {
  return Y.createHash("sha256").update(t).digest("hex").slice(0, 16);
}
function H(t, e) {
  const s = c.basename(t);
  let n = s;
  return /^skill\.md$/i.test(s) ? n = c.basename(c.dirname(e)) : n = s.replace(/\.(mdc|md|toml|txt)$/i, ""), n.toLowerCase().replace(/\(r\)|\(tm\)/gi, "").replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}
function q(t, e, s) {
  const n = s.match(/^---\s*\n([\s\S]*?)\n---/);
  if (n) {
    const o = n[1].match(/^(?:name|title)\s*:\s*["']?(.+?)["']?\s*$/mi);
    if (o != null && o[1]) return o[1].trim();
  }
  const r = s.match(/^#\s+(.+)$/m);
  return r != null && r[1] ? r[1].trim() : /^skill\.md$/i.test(t) ? c.basename(c.dirname(e)) : t.replace(/\.(mdc|md|toml|txt)$/i, "");
}
const D = [
  "extensions",
  "node_modules",
  ".git",
  "Cache",
  "cache",
  "logs",
  "CachedData",
  "GPUCache",
  "Code Cache",
  "blob_storage",
  "Crashpad",
  "dist",
  "vendor_imports"
];
function Ae(t) {
  return /\.(mdc|md|toml|txt)$/i.test(t);
}
function L(t, e, s = "other") {
  const n = t.replace(/\\/g, "/").toLowerCase(), r = e.toLowerCase();
  return r === "skill.md" || n.includes("/skills/") || n.includes("/skills-cursor/") || n.includes("/builtin_skills/") ? "skill" : n.includes("/agents/") || r.endsWith(".toml") && n.includes("agent") ? "agent" : n.includes("/prompts/") || n.includes("/commands/") ? "prompt" : n.includes("/rules/") || r.endsWith(".mdc") || r === "user_rules.md" || r === "claude.md" || r === "agents.md" ? "rule" : r.endsWith(".toml") ? "agent" : s;
}
function N(t, e, s) {
  if (!Ae(s)) return !1;
  const n = e.replace(/\\/g, "/");
  return !(/(^|\/)(readme|changelog|license|security|support|contributing)\.md$/i.test(s) && !/(^|\/)(rules|skills|skills-cursor|agents|prompts|commands|builtin_skills)(\/|$)/i.test(n));
}
const j = [
  {
    id: "cursor",
    label: "Cursor",
    getRoots: () => [E(".cursor")],
    excludeDirNames: [...D, "projects", "ai-tracking", "browser-logs"],
    includeTopDirs: ["rules", "skills-cursor", "agents", "skills"],
    shouldInclude: (t, e, s) => {
      const n = e.replace(/\\/g, "/");
      return N(t, e, s) ? n.startsWith("rules/") || n.startsWith("skills-cursor/") || n.startsWith("agents/") || /(^|\/)skills\//i.test(n) : !1;
    },
    inferKind: (t, e) => L(t, e, "rule")
  },
  {
    id: "claude",
    label: "Claude Code",
    getRoots: () => [E(".claude")],
    excludeDirNames: [...D, "debug", "statsig", "telemetry", "file-history", "shell-snapshots", "session-env", "projects", "todos", "plans", "plugins"],
    includeTopDirs: ["skills", "agents", "commands", "rules", ".cursor", ".agents"],
    shouldInclude: (t, e, s) => {
      if (!N(t, e, s)) return !1;
      const n = e.replace(/\\/g, "/"), r = s.toLowerCase();
      return r === "claude.md" || r === "agents.md" ? !0 : n.includes("/rules/") || n.startsWith("rules/") || n.includes("/skills/") || n.startsWith("skills/") || n.includes("/agents/") || n.startsWith("agents/") || n.includes("/commands/") || n.startsWith("commands/") || r === "skill.md";
    },
    inferKind: (t, e) => L(t, e, "other")
  },
  {
    id: "codex",
    label: "Codex",
    getRoots: () => [E(".codex")],
    excludeDirNames: [...D, "tmp", "sessions", "memories"],
    includeTopDirs: ["prompts", "agents", "skills"],
    shouldInclude: (t, e, s) => {
      if (!N(t, e, s) && !/\.toml$/i.test(s)) return !1;
      const n = e.replace(/\\/g, "/");
      return n.startsWith("prompts/") || n.startsWith("agents/") || n.startsWith("skills/") || /(^|\/)skills\//i.test(n);
    },
    inferKind: (t, e) => L(t, e, "prompt")
  },
  {
    id: "trae",
    label: "Trae",
    getRoots: () => [E(".trae"), E(".trae-cn"), E(".trae-aicc")],
    excludeDirNames: [...D],
    includeTopDirs: ["builtin_skills", "rules", "skills"],
    shouldInclude: (t, e, s) => {
      if (!N(t, e, s)) return !1;
      const n = e.replace(/\\/g, "/"), r = s.toLowerCase();
      return r === "user_rules.md" || n.includes("builtin_skills/") || n.includes("/rules/") || n.includes("/skills/") || r === "skill.md";
    },
    inferKind: (t, e) => L(t, e, "rule")
  },
  {
    id: "qoder",
    label: "Qoder",
    getRoots: () => [E(".qoder"), E(".qoder-cn"), E(".qodersec")],
    excludeDirNames: [...D],
    includeTopDirs: ["skills", "rules", "canvas"],
    shouldInclude: (t, e, s) => {
      if (!N(t, e, s)) return !1;
      const n = e.replace(/\\/g, "/");
      return n.includes("/skills/") || n.startsWith("skills/") || n.includes("/rules/") || n.includes("canvas/recipes/") || s.toLowerCase() === "skill.md";
    },
    inferKind: (t, e) => t.replace(/\\/g, "/").includes("canvas/recipes/") ? "prompt" : L(t, e, "skill")
  }
];
function ce(t) {
  return j.find((e) => e.id === t);
}
function Pe() {
  const t = [];
  for (const e of j)
    for (const s of e.getRoots())
      t.push(c.resolve(s));
  return t;
}
function Oe(t) {
  var n;
  const e = /* @__PURE__ */ new Map();
  for (const r of t) {
    const o = e.get(r.slug) || [];
    o.push(r), e.set(r.slug, o);
  }
  const s = [];
  for (const [r, o] of e) {
    const a = [...new Set(o.map((p) => p.toolId))], l = o.map((p) => p.contentHash).filter(Boolean), u = new Set(l), f = l.length >= 2 && u.size === 1;
    let i = "single";
    a.length > 1 ? i = f ? "identical" : "same-name" : o.length > 1 && f ? i = "identical" : o.length > 1 && (i = "same-name"), s.push({
      slug: r,
      title: ((n = o[0]) == null ? void 0 : n.title) || r,
      toolIds: a,
      assets: o,
      sameContent: f,
      matchType: i
    });
  }
  return s.sort((r, o) => {
    if (o.toolIds.length !== r.toolIds.length) return o.toolIds.length - r.toolIds.length;
    if (r.matchType !== o.matchType) {
      const a = { identical: 0, "same-name": 1, single: 2 };
      return a[r.matchType] - a[o.matchType];
    }
    return r.slug.localeCompare(o.slug);
  }), s;
}
function $e(t, e) {
  if (t === "agents")
    return `# AGENTS.md

## 项目约定

- 用简体中文回复用户（除非对方要求其他语言）
- 只改任务相关文件，不做无关重构
- 提交前确认构建/类型检查通过

## 技术栈

（填写本仓库主要技术栈）

## 禁止事项

- 不要提交密钥或 \`.env\`
- 不要擅自 force push main
`;
  if (t === "skill") {
    const n = e;
    return `---
name: ${n}
description: 一句话说明何时使用此技能
---

# ${n}

## 何时使用

- …

## 步骤

1. …
2. …

## 注意

- …
`;
  }
  const s = e;
  return `---
description: ${s}
globs:
alwaysApply: false
---

# ${s}

## 约定

- …

## 示例

\`\`\`
（好的写法）
\`\`\`
`;
}
function ze(t, e) {
  const s = e.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
  return t === "agents" ? { relDir: "", fileName: "AGENTS.md" } : t === "skill" ? { relDir: `skills/${s}`, fileName: "SKILL.md" } : { relDir: "rules", fileName: `${s}.mdc` };
}
function Be(t) {
  return t === "skill" ? "skill" : "rule";
}
async function je(t) {
  var b;
  const e = ce(t.toolId);
  if (!e) throw new Error("未知工具");
  const s = e.getRoots().map((w) => c.resolve(w));
  let n = s[0];
  for (const w of s)
    try {
      await h.access(w), n = w;
      break;
    } catch {
    }
  if (!n) throw new Error("未找到工具配置目录");
  try {
    await h.mkdir(n, { recursive: !0 });
  } catch {
  }
  const r = ((b = t.slug) == null ? void 0 : b.trim()) || "untitled", { relDir: o, fileName: a } = ze(t.template, r), l = o ? c.join(n, o) : n;
  await h.mkdir(l, { recursive: !0 });
  const u = c.join(l, a);
  let f = !1;
  try {
    await h.access(u), f = !0;
  } catch {
    f = !1;
  }
  if (f)
    throw new Error(`文件已存在：${c.relative(n, u)}`);
  const i = $e(t.template, r);
  await h.writeFile(u, i, "utf8");
  const p = await h.stat(u), y = c.relative(n, u), v = t.kind || Be(t.template);
  return {
    id: U(t.toolId, u),
    toolId: t.toolId,
    kind: v,
    title: q(a, y, i),
    slug: H(a, y),
    absPath: u,
    relPath: y,
    rootPath: n,
    size: p.size,
    mtime: p.mtimeMs,
    contentHash: F(i)
  };
}
const Me = 30 * 1024;
function Ue() {
  return { oversized: 0, drift: 0, duplicate: 0, "missing-entry": 0 };
}
function Fe(t, e) {
  var l, u, f;
  const s = [];
  for (const i of e)
    i.size > Me && s.push({
      id: `oversized:${i.id}`,
      type: "oversized",
      severity: "info",
      title: `过大：${i.title}`,
      message: `${Math.round(i.size / 1024)} KB，建议拆分或精简（阈值 30KB）`,
      assetIds: [i.id],
      slug: i.slug
    });
  const n = /* @__PURE__ */ new Map();
  for (const i of e) {
    const p = n.get(i.slug) || [];
    p.push(i), n.set(i.slug, p);
  }
  for (const [i, p] of n) {
    const y = [...new Set(p.map((w) => w.toolId))];
    if (y.length < 2) continue;
    const v = p.map((w) => w.contentHash).filter(Boolean);
    if (v.length < 2) continue;
    new Set(v).size > 1 && s.push({
      id: `drift:${i}`,
      type: "drift",
      severity: "warn",
      title: `内容漂移：${((l = p[0]) == null ? void 0 : l.title) || i}`,
      message: `在 ${y.join(" / ")} 中同名但内容不一致`,
      assetIds: p.map((w) => w.id),
      slug: i
    });
  }
  const r = /* @__PURE__ */ new Map();
  for (const i of e) {
    if (!i.contentHash) continue;
    const p = r.get(i.contentHash) || [];
    p.push(i), r.set(i.contentHash, p);
  }
  for (const [i, p] of r)
    p.length < 2 || new Set(p.map((v) => v.absPath)).size < 2 || s.push({
      id: `dup:${i}`,
      type: "duplicate",
      severity: "info",
      title: `疑似重复：${((u = p[0]) == null ? void 0 : u.title) || i}`,
      message: `${p.length} 处内容哈希相同`,
      assetIds: p.map((v) => v.id),
      slug: (f = p[0]) == null ? void 0 : f.slug
    });
  const o = {
    claude: { names: ["claude.md", "agents.md"], label: "CLAUDE.md / AGENTS.md" },
    cursor: { names: ["agents.md"], label: "AGENTS.md（可选）" },
    codex: { names: ["agents.md"], label: "AGENTS.md（可选）" }
  };
  for (const i of t) {
    if (!i.detected) continue;
    const p = o[i.toolId];
    if (!p) continue;
    !e.filter((b) => b.toolId === i.toolId).some((b) => {
      var I;
      const w = ((I = b.relPath.replace(/\\/g, "/").split("/").pop()) == null ? void 0 : I.toLowerCase()) || "";
      return p.names.includes(w);
    }) && i.toolId === "claude" && s.push({
      id: `missing:${i.toolId}`,
      type: "missing-entry",
      severity: "info",
      title: `缺少入口：${i.label}`,
      message: `已检测到目录，但未找到 ${p.label}`,
      assetIds: []
    });
  }
  const a = Ue();
  for (const i of s) a[i.type] += 1;
  return s.sort((i, p) => i.severity !== p.severity ? i.severity === "warn" ? -1 : 1 : i.title.localeCompare(p.title)), {
    scannedAt: Date.now(),
    issueCount: s.length,
    byType: a,
    issues: s
  };
}
const He = 64 * 1024, qe = 6, We = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "Cache",
  "cache",
  "vendor",
  ".next",
  "coverage"
]), Ve = /* @__PURE__ */ new Set([".cursor", ".claude", ".codex", ".trae", ".trae-cn", ".qoder", ".qoder-cn"]);
let P = null;
function Q() {
  return P;
}
function G(t) {
  return P = t ? c.resolve(t) : null, P;
}
function Qe() {
  return P ? [P] : [];
}
async function te(t) {
  try {
    return await h.access(t), !0;
  } catch {
    return !1;
  }
}
function Ke(t, e) {
  const s = t.replace(/\\/g, "/").toLowerCase(), n = e.toLowerCase();
  return n === "skill.md" || s.includes("/skills/") ? "skill" : s.includes("/agents/") ? "agent" : s.includes("/prompts/") || s.includes("/commands/") ? "prompt" : n === "agents.md" || n === "claude.md" || n === ".cursorrules" || n.endsWith(".mdc") || s.includes("/rules/") ? "rule" : "other";
}
function Ge(t) {
  const e = t.replace(/\\/g, "/").toLowerCase();
  return e.startsWith(".cursor/") || e.includes("/.cursor/") ? "cursor" : e.startsWith(".claude/") || e.includes("/.claude/") ? "claude" : e.startsWith(".codex/") || e.includes("/.codex/") ? "codex" : e.includes(".trae") ? "trae" : e.includes(".qoder") ? "qoder" : "workspace";
}
function Je(t, e) {
  const s = t.replace(/\\/g, "/"), n = e.toLowerCase();
  return !!(["agents.md", "claude.md", ".cursorrules"].includes(n) && !s.includes("/") || /(^|\/)\.cursor\/rules\//i.test(s) && /\.(md|mdc)$/i.test(n) || /(^|\/)\.claude\/(skills|agents|commands|rules)\//i.test(s) && /\.(md|mdc|toml)$/i.test(n) || /(^|\/)\.codex\/(prompts|agents|skills)\//i.test(s) || n === "skill.md");
}
async function se(t, e) {
  try {
    const s = await h.stat(e);
    if (!s.isFile()) return null;
    const n = c.relative(t, e), r = c.basename(e), o = Ge(n), a = Ke(n, r);
    let l = "", u;
    try {
      const f = await h.open(e, "r");
      try {
        const i = Buffer.alloc(Math.min(He, s.size)), { bytesRead: p } = await f.read(i, 0, i.length, 0), y = i.subarray(0, p);
        u = F(y), l = y.toString("utf8");
      } finally {
        await f.close();
      }
    } catch {
    }
    return {
      id: U(`project:${o}`, e),
      toolId: o,
      kind: a,
      title: q(r, n, l),
      slug: H(r, n),
      absPath: e,
      relPath: n,
      rootPath: t,
      size: s.size,
      mtime: s.mtimeMs,
      contentHash: u
    };
  } catch {
    return null;
  }
}
async function ue(t, e, s, n) {
  if (s > qe) return;
  let r;
  try {
    r = await h.readdir(e, { withFileTypes: !0 });
  } catch {
    return;
  }
  for (const o of r) {
    const a = c.join(e, o.name);
    if (o.isDirectory()) {
      if (We.has(o.name) || o.name.startsWith(".") && !Ve.has(o.name)) continue;
      await ue(t, a, s + 1, n);
    } else o.isFile() && n.push(a);
  }
}
async function ne(t) {
  const e = c.resolve(t);
  if (!await te(e))
    throw new Error("项目目录不存在");
  G(e);
  const s = [];
  await ue(e, e, 0, s);
  const n = [], r = /* @__PURE__ */ new Set();
  for (const l of s) {
    const u = c.relative(e, l), f = c.basename(l);
    if (!Je(u, f)) continue;
    const i = await se(e, l);
    i && !r.has(i.absPath) && (r.add(i.absPath), n.push(i));
  }
  for (const l of ["AGENTS.md", "CLAUDE.md", ".cursorrules", "agents.md", "claude.md"]) {
    const u = c.join(e, l);
    if (!await te(u) || r.has(u)) continue;
    const f = await se(e, u);
    f && (r.add(u), n.push(f));
  }
  n.sort((l, u) => u.mtime - l.mtime);
  const o = { rule: 0, skill: 0, agent: 0, prompt: 0, other: 0 };
  for (const l of n) o[l.kind] += 1;
  return {
    tools: [
      {
        toolId: "workspace",
        label: c.basename(e) || "当前项目",
        roots: [e],
        presentRoots: [e],
        detected: !0,
        counts: o,
        total: n.length
      }
    ],
    assets: n,
    scannedAt: Date.now()
  };
}
const Ye = 64 * 1024, Xe = 8;
async function Ze(t) {
  try {
    return await h.access(t), !0;
  } catch {
    return !1;
  }
}
async function de(t, e, s, n, r, o) {
  if (r > Xe) return;
  let a;
  try {
    a = await h.readdir(e, { withFileTypes: !0 });
  } catch {
    return;
  }
  for (const l of a) {
    const u = c.join(e, l.name);
    if (l.isDirectory()) {
      if (s.has(l.name) || r === 0 && (n != null && n.length) && !n.includes(l.name) || l.name.startsWith(".") && l.name !== ".cursor" && l.name !== ".agents")
        continue;
      await de(t, u, s, n, r + 1, o);
    } else l.isFile() && o.push(u);
  }
}
async function et(t, e, s, n) {
  try {
    const r = await h.stat(s);
    if (!r.isFile()) return null;
    const o = c.relative(e, s), a = c.basename(s);
    let l = "", u;
    try {
      const f = await h.open(s, "r");
      try {
        const i = Buffer.alloc(Math.min(Ye, r.size)), { bytesRead: p } = await f.read(i, 0, i.length, 0), y = i.subarray(0, p);
        u = F(y), l = y.toString("utf8");
      } finally {
        await f.close();
      }
    } catch {
    }
    return {
      id: U(t, s),
      toolId: t,
      kind: n,
      title: q(a, o, l),
      slug: H(a, o),
      absPath: s,
      relPath: o,
      rootPath: e,
      size: r.size,
      mtime: r.mtimeMs,
      contentHash: u
    };
  } catch {
    return null;
  }
}
function tt() {
  return { rule: 0, skill: 0, agent: 0, prompt: 0, other: 0 };
}
async function K(t) {
  const e = t != null && t.length ? j.filter((r) => t.includes(r.id)) : j, s = [], n = [];
  for (const r of e) {
    const o = r.getRoots().map((i) => c.resolve(i)), a = [], l = new Set(r.excludeDirNames), u = [];
    for (const i of o) {
      if (!await Ze(i)) continue;
      a.push(i);
      const p = [];
      await de(i, i, l, r.includeTopDirs, 0, p);
      for (const y of p) {
        const v = c.relative(i, y), b = c.basename(y);
        if (!r.shouldInclude(y, v, b)) continue;
        const w = r.inferKind(v, b), I = await et(r.id, i, y, w);
        I && u.push(I);
      }
    }
    const f = tt();
    for (const i of u) f[i.kind] += 1;
    n.push({
      toolId: r.id,
      label: r.label,
      roots: o,
      presentRoots: a,
      detected: a.length > 0,
      counts: f,
      total: u.length
    }), s.push(...u);
  }
  return s.sort((r, o) => o.mtime - r.mtime), {
    tools: n,
    assets: s,
    scannedAt: Date.now()
  };
}
async function st(t, e) {
  const s = c.resolve(t), n = await h.stat(s), r = e != null && e.full ? Math.min(n.size, 2 * 1024 * 1024) : (e == null ? void 0 : e.maxBytes) ?? 256 * 1024, o = Math.min(n.size, r), a = await h.open(s, "r");
  try {
    const l = Buffer.alloc(o), { bytesRead: u } = await a.read(l, 0, o, 0), f = l.subarray(0, u).toString("utf8");
    return {
      absPath: s,
      truncated: n.size > r,
      size: n.size,
      content: f
    };
  } finally {
    await a.close();
  }
}
async function nt(t, e) {
  const s = c.resolve(t);
  if (typeof e != "string")
    throw new Error("内容必须是文本");
  if (Buffer.byteLength(e, "utf8") > 2 * 1024 * 1024)
    throw new Error("文件过大，无法在应用内保存（上限 2MB）");
  await h.writeFile(s, e, "utf8");
  const n = await h.stat(s);
  return {
    absPath: s,
    size: n.size,
    mtime: n.mtimeMs
  };
}
function rt(t, e, s) {
  const n = c.basename(e), r = n.toLowerCase();
  if (t === "skill" || r === "skill.md") {
    const a = r === "skill.md" ? c.basename(c.dirname(e)) : n.replace(/\.(md|mdc)$/i, "");
    return c.join("skills", a, "SKILL.md");
  }
  if (t === "agent")
    return c.join("agents", n);
  if (t === "prompt")
    return c.join("prompts", n);
  if (r === "agents.md" || r === "claude.md")
    return n;
  if (r.endsWith(".mdc"))
    return c.join("rules", n);
  const o = n.replace(/\.(md|txt)$/i, "") || s;
  return c.join("rules", `${o}.md`);
}
async function ot(t) {
  const e = await h.readFile(t.sourceAbsPath, "utf8"), s = [];
  for (const n of t.targetToolIds) {
    if (n === t.sourceToolId) {
      s.push({ toolId: n, absPath: t.sourceAbsPath, skipped: !0, reason: "源工具跳过" });
      continue;
    }
    const r = ce(n);
    if (!r) {
      s.push({ toolId: n, absPath: "", skipped: !0, reason: "未知工具" });
      continue;
    }
    const o = r.getRoots().map((y) => c.resolve(y));
    let a = o[0];
    for (const y of o)
      try {
        await h.access(y), a = y;
        break;
      } catch {
      }
    if (!a) {
      s.push({ toolId: n, absPath: "", skipped: !0, reason: "目录不存在" });
      continue;
    }
    await h.mkdir(a, { recursive: !0 });
    const l = rt(t.sourceKind, t.sourceRelPath, t.sourceTitle), u = c.join(a, l);
    try {
      if (await h.access(u), !t.overwrite) {
        s.push({ toolId: n, absPath: u, skipped: !0, reason: "目标已存在" });
        continue;
      }
    } catch {
    }
    await h.mkdir(c.dirname(u), { recursive: !0 }), await h.writeFile(u, e, "utf8");
    const f = await h.stat(u), i = c.basename(u), p = {
      id: U(n, u),
      toolId: n,
      kind: t.sourceKind,
      title: q(i, l, e),
      slug: H(i, l),
      absPath: u,
      relPath: l,
      rootPath: a,
      size: f.size,
      mtime: f.mtimeMs,
      contentHash: F(e)
    };
    s.push({ toolId: n, absPath: u, asset: p });
  }
  return s;
}
async function _(t) {
  const e = c.resolve(t);
  let s;
  try {
    s = await h.realpath(e);
  } catch {
    s = e;
    const a = c.dirname(e);
    try {
      s = c.join(await h.realpath(a), c.basename(e));
    } catch {
      throw new Error("文件不存在或无法访问");
    }
  }
  const n = [...Pe(), ...Qe()];
  if (!(await Promise.all(
    n.map(async (a) => {
      try {
        return await h.realpath(a);
      } catch {
        return c.resolve(a);
      }
    })
  )).some((a) => s === a || s.startsWith(a + c.sep)))
    throw new Error("路径不在允许的规则目录内");
  return s;
}
function it() {
  m.handle("rules:scan", async (t, e) => K(e)), m.handle("rules:health", async (t, e) => {
    var n;
    const s = (n = e == null ? void 0 : e.assets) != null && n.length ? { tools: e.tools || [], assets: e.assets } : await K();
    return Fe(s.tools, s.assets);
  }), m.handle("rules:read", async (t, e, s) => {
    const n = await _(e);
    return st(n, s);
  }), m.handle("rules:write", async (t, e, s) => {
    const n = await _(e);
    return nt(n, s);
  }), m.handle("rules:reveal", async (t, e) => {
    const s = await _(e);
    return B.showItemInFolder(s), { success: !0 };
  }), m.handle("rules:open", async (t, e) => {
    const s = await _(e), n = await B.openPath(s);
    if (n) throw new Error(n);
    return { success: !0 };
  }), m.handle("rules:compare", async (t, e) => {
    const s = e != null && e.length ? e : (await K()).assets;
    return Oe(s);
  }), m.handle(
    "rules:create",
    async (t, e) => je(e)
  ), m.handle(
    "rules:sync",
    async (t, e) => (await _(e.sourceAbsPath), ot(e))
  ), m.handle("rules:get-project", () => ({
    projectRoot: Q()
  })), m.handle("rules:clear-project", () => (G(null), { projectRoot: null })), m.handle("rules:pick-project", async (t) => {
    const e = $.fromWebContents(t.sender), s = await Ee.showOpenDialog(e ?? void 0, {
      title: "选择项目目录",
      properties: ["openDirectory"]
    });
    if (s.canceled || !s.filePaths[0])
      return { canceled: !0, projectRoot: Q() };
    const n = G(s.filePaths[0]), r = await ne(n);
    return { canceled: !1, projectRoot: n, ...r };
  }), m.handle("rules:scan-project", async (t, e) => {
    const s = e || Q();
    if (!s) throw new Error("尚未选择项目目录");
    return ne(s);
  });
}
const re = {
  autoCheck: !0
};
function pe() {
  return c.join(g.getPath("userData"), "update-settings.json");
}
function X() {
  try {
    const t = R.readFileSync(pe(), "utf8"), e = JSON.parse(t);
    return {
      autoCheck: typeof e.autoCheck == "boolean" ? e.autoCheck : re.autoCheck
    };
  } catch {
    return { ...re };
  }
}
function at(t) {
  const e = { ...X(), ...t };
  return R.writeFileSync(pe(), JSON.stringify(e, null, 2), "utf8"), e;
}
const { autoUpdater: k } = Ne;
let fe = () => null, oe = !1;
function C(t) {
  const e = fe();
  e && !e.isDestroyed() && e.webContents.send("update:status", t);
}
function me(t) {
  const e = String((t == null ? void 0 : t.message) || t || "检查更新失败").replace(/\s+/g, " ").trim();
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch failed|net::/i.test(e))
    return "网络异常，请稍后重试";
  if (/401|403|Unauthorized|Bad credentials|private/i.test(e))
    return "无法访问更新源（仓库权限或 Token 无效）";
  if (/Unable to find latest version|Cannot parse releases feed|latest\.yml|404/i.test(e))
    return "暂未找到可用更新，请稍后再试";
  if (/code signature|not signed|notariz/i.test(e))
    return "更新包校验失败";
  const s = e.split(/[\n\r]/)[0] || e;
  return s.length <= 80 ? s : `${s.slice(0, 80)}…`;
}
function lt() {
  k.autoDownload = !0, k.autoInstallOnAppQuit = !0, k.on("checking-for-update", () => {
    C({ type: "checking" });
  }), k.on("update-available", (t) => {
    C({ type: "available", version: t.version });
  }), k.on("update-not-available", (t) => {
    C({ type: "not-available", version: t.version });
  }), k.on("download-progress", (t) => {
    C({ type: "downloading", percent: Math.round(t.percent) });
  }), k.on("update-downloaded", (t) => {
    t.version, C({ type: "downloaded", version: t.version });
  }), k.on("error", (t) => {
    console.error("[update]", t), C({ type: "error", message: me(t) });
  });
}
async function he(t) {
  var e;
  if (!g.isPackaged) {
    const s = {
      type: "dev-skip",
      message: "开发环境不可用，请使用打包后的应用检查更新"
    };
    return C(s), { ok: !1, ...s, manual: t };
  }
  try {
    const s = await k.checkForUpdates();
    return { ok: !0, manual: t, version: (e = s == null ? void 0 : s.updateInfo) == null ? void 0 : e.version };
  } catch (s) {
    console.error("[update]", s);
    const n = me(s);
    return C({ type: "error", message: n }), { ok: !1, manual: t, message: n };
  }
}
function ct(t) {
  fe = t, oe || (lt(), oe = !0), m.handle("update:get-version", () => g.getVersion()), m.handle("update:get-settings", () => X()), m.handle("update:set-auto-check", (e, s) => at({ autoCheck: !!s })), m.handle("update:check", async () => he(!0)), m.handle("update:quit-and-install", () => (k.quitAndInstall(!1, !0), { success: !0 }));
}
function ut(t = 4e3) {
  const { autoCheck: e } = X();
  e && setTimeout(() => {
    he(!1);
  }, t);
}
function dt() {
  return c.join(g.getPath("userData"), "device-id");
}
function pt() {
  const t = dt();
  try {
    const s = R.readFileSync(t, "utf8").trim();
    if (s) return s;
  } catch {
  }
  const e = _e();
  return R.writeFileSync(t, e, "utf8"), e;
}
function M() {
  const t = pt();
  return Y.createHash("sha256").update(t).digest("hex");
}
function Z() {
  return c.join(g.getPath("userData"), "unlock-session.json");
}
function ft() {
  try {
    const t = R.readFileSync(Z(), "utf8"), e = JSON.parse(t);
    return typeof e.deviceId == "string" && typeof e.token == "string" && typeof e.expiresAt == "number" ? e : null;
  } catch {
    return null;
  }
}
function ge(t) {
  R.writeFileSync(Z(), JSON.stringify(t, null, 2), "utf8");
}
function mt() {
  try {
    R.unlinkSync(Z());
  } catch {
  }
}
function ht(t) {
  return !t || t.deviceId !== M() ? !1 : t.expiresAt > Date.now();
}
const gt = 15e3;
function yt() {
  return "https://cztool-unlock-api.cnchenduxiu.workers.dev".replace(/\/$/, "");
}
async function ye(t, e) {
  const s = new AbortController(), n = setTimeout(() => s.abort(), gt);
  try {
    const r = await le(`${yt()}${t}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(e),
      signal: s.signal
    }), o = await r.json().catch(() => ({}));
    return r.ok ? o : { ok: !1, message: typeof o.error == "string" ? o.error : wt(r.status), status: r.status };
  } catch (r) {
    return (r == null ? void 0 : r.name) === "AbortError" ? { ok: !1, message: "网络请求超时，请稍后重试" } : { ok: !1, message: "网络连接失败，请检查网络后重试" };
  } finally {
    clearTimeout(n);
  }
}
function wt(t) {
  return t === 403 ? "该验证码已被其他设备使用" : t === 400 ? "验证码无效" : t === 401 ? "会话已失效，请重新输入验证码" : "验证失败，请稍后重试";
}
async function vt(t, e) {
  return ye("/verify", {
    code: t.trim().toUpperCase(),
    deviceId: e,
    appVersion: g.getVersion()
  });
}
async function bt(t, e) {
  return ye("/refresh", { deviceId: t, token: e });
}
let ie = !1, z = null;
function we() {
  return !g.isPackaged && process.env.CZTOOL_UNLOCK_SKIP === "1";
}
function kt() {
  ie || (ie = !0, ut(4e3));
}
function A() {
  kt(), z == null || z();
}
async function Et() {
  const t = M();
  if (we())
    return A(), { locked: !1, deviceId: t, skipped: !0 };
  const e = ft();
  if (ht(e))
    return A(), {
      locked: !1,
      deviceId: t,
      expiresAt: e.expiresAt
    };
  if (e != null && e.token) {
    const s = await bt(t, e.token);
    if ("ok" in s && s.ok && s.token && s.expiresAt)
      return ge({
        deviceId: t,
        token: s.token,
        expiresAt: s.expiresAt,
        boundCode: e.boundCode
      }), A(), {
        locked: !1,
        deviceId: t,
        expiresAt: s.expiresAt
      };
  }
  return { locked: !0, deviceId: t };
}
function xt(t) {
  z = null, m.handle("unlock:get-status", async () => Et()), m.handle("unlock:get-device-id", () => M()), m.handle("unlock:verify", async (e, s) => {
    if (we())
      return A(), { ok: !0, skipped: !0 };
    const n = String(s || "").trim();
    if (!n)
      return { ok: !1, message: "请输入验证码" };
    const r = M(), o = await vt(n, r);
    return !("ok" in o) || !o.ok || !o.token || !o.expiresAt ? {
      ok: !1,
      message: "message" in o ? o.message : "验证失败"
    } : (ge({
      deviceId: r,
      token: o.token,
      expiresAt: o.expiresAt,
      boundCode: n.toUpperCase()
    }), A(), {
      ok: !0,
      expiresAt: o.expiresAt
    });
  }), m.handle("unlock:clear", () => (mt(), { ok: !0 })), m.handle("unlock:open-external", async (e, s) => {
    const n = String(s || "").trim();
    if (!/^https:\/\//i.test(n))
      throw new Error("仅允许打开 https 链接");
    return await B.openExternal(n), { ok: !0 };
  });
}
const ae = Ie(Re), Tt = Ce(import.meta.url), W = c.dirname(Se(import.meta.url));
if (process.platform === "win32") {
  const t = g.isPackaged ? c.join(process.resourcesPath, "ffmpeg") : c.join(W, "../../resources/ffmpeg");
  process.env.PATH = `${t};${process.env.PATH}`;
}
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = "false";
process.env.NODE_ENV === "development" && (process.env.ELECTRON_LOG_LEVEL = "error");
process.env.APP_ROOT = c.join(W, "../..");
const Ht = c.join(process.env.APP_ROOT, "dist-electron"), ve = c.join(process.env.APP_ROOT, "dist"), O = process.env.VITE_DEV_SERVER_URL;
process.env.VITE_PUBLIC = O ? c.join(process.env.APP_ROOT, "public") : ve;
x.release().startsWith("6.1") && g.disableHardwareAcceleration();
process.platform === "win32" && g.setAppUserModelId(g.getName());
g.requestSingleInstanceLock() || (g.quit(), process.exit(0));
let d = null, S = null;
const V = c.join(W, "../preload/index.mjs"), be = c.join(ve, "index.html"), Ct = c.join(g.getPath("userData"), "data.db"), T = new De(Ct);
T.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moduleName TEXT NOT NULL,
    appName TEXT NOT NULL,
    operationTime INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL
  );
  PRAGMA page_size = 65536;
  PRAGMA encoding = 'UTF-8';
`);
const St = () => {
  T.prepare(`
    INSERT INTO history (moduleName, appName, operationTime, content, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const { count: t } = T.prepare("SELECT COUNT(*) as count FROM history").get();
};
process.env.NODE_ENV === "development" && St();
m.handle("history:add", async (t, e) => {
  var s, n;
  try {
    const { moduleName: r, appName: o, content: a, status: l } = e;
    console.log("Adding history record:"), console.log("Content length:", a == null ? void 0 : a.length), console.log("Content preview:", a == null ? void 0 : a.substring(0, 100));
    const f = T.prepare(`
      INSERT INTO history (moduleName, appName, operationTime, content, status) 
      VALUES (?, ?, ?, ?, ?)
    `).run(r, o, Date.now(), a, l), i = T.prepare("SELECT * FROM history WHERE id = ?").get(f.lastInsertRowid);
    return console.log("Stored record content length:", (s = i.content) == null ? void 0 : s.length), console.log("Stored content preview:", (n = i.content) == null ? void 0 : n.substring(0, 100)), i;
  } catch (r) {
    throw console.error("Failed to add history:", r), new Error("添加历史记录失败");
  }
});
m.handle("history:list", async (t, e) => {
  try {
    const { page: s = 1, pageSize: n = 10 } = e, r = (s - 1) * n, { total: o } = T.prepare("SELECT COUNT(*) as total FROM history").get();
    return {
      records: T.prepare(`
      SELECT * FROM history 
      ORDER BY operationTime DESC 
      LIMIT ? OFFSET ?
    `).all(n, r),
      pagination: {
        total: o,
        page: s,
        pageSize: n,
        totalPages: Math.ceil(o / n)
      }
    };
  } catch (s) {
    throw console.error("Failed to get history:", s), new Error("获取历史记录失败");
  }
});
m.handle("history:clear", async (t, e) => {
  try {
    return T.prepare("DELETE FROM history WHERE id = ?").run(e).changes > 0;
  } catch (s) {
    throw console.error("Failed to clear history:", s), new Error("清除历史记录失败");
  }
});
m.handle("history:clear-all", async () => {
  try {
    return { success: !0, deleted: T.prepare("DELETE FROM history").run().changes };
  } catch (t) {
    throw console.error("Failed to clear all history:", t), new Error("清除全部历史记录失败");
  }
});
function ee() {
  if (!d || d.isDestroyed()) {
    ke();
    return;
  }
  d.isMinimized() && d.restore(), d.isVisible() || d.show(), d.setSkipTaskbar(!1), d.focus();
}
async function ke() {
  d = new $({
    title: "CZTool",
    icon: c.join(process.env.VITE_PUBLIC, "favicon.ico"),
    minWidth: 1400,
    minHeight: 800,
    width: 1400,
    height: 800,
    show: !1,
    skipTaskbar: !1,
    minimizable: !0,
    maximizable: !0,
    webPreferences: {
      preload: V,
      nodeIntegration: !0,
      webSecurity: process.env.NODE_ENV !== "development",
      devTools: process.env.NODE_ENV === "development",
      allowRunningInsecureContent: !0
    },
    frame: !1
  }), d.once("ready-to-show", () => {
    d == null || d.show();
  }), d.on("restore", () => {
    d == null || d.show(), d == null || d.focus();
  }), d.on("close", (s) => {
    g.isQuiting || (g.isQuiting = !0);
  }), console.log(W), console.log(process.env.VITE_PUBLIC), S = new xe(c.join(process.env.VITE_PUBLIC, "logo.png")), S.setToolTip("cztool");
  const t = () => ee();
  S.on("click", t), S.on("double-click", t);
  const e = Te.buildFromTemplate([
    {
      label: "打开",
      click: t
    },
    {
      label: "退出",
      click: () => {
        g.isQuiting = !0, g.quit();
      }
    }
  ]);
  S.setContextMenu(e), O ? (d.loadURL(O), d.webContents.openDevTools(), d.webContents.on("devtools-opened", () => {
    setTimeout(() => {
      d == null || d.webContents.executeJavaScript(`
          // 禁用所有 CDP 警告
          if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__.consoleManagedByDevTools = true;
          }
        `).catch(console.error);
    }, 1e3);
  })) : d.loadFile(be), d.webContents.on("did-finish-load", () => {
    d == null || d.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString()), d == null || d.webContents.executeJavaScript(`
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister())
      });
    `).catch(console.error);
  }), d.webContents.setWindowOpenHandler(({ url: s }) => (s.startsWith("https:") && B.openExternal(s), { action: "deny" })), d.webContents.session.setPermissionRequestHandler((s, n, r) => {
    r(!1);
  }), d.webContents.session.setDevicePermissionHandler(() => !0);
}
g.whenReady().then(ke);
m.on("minimize-window", () => {
  d && !d.isDestroyed() && d.minimize();
});
m.on("maximize-window", () => {
  d && !d.isDestroyed() && (d.isMaximized() ? d.unmaximize() : d.maximize());
});
m.on("close-window", () => {
  g.isQuiting = !0, g.quit();
});
g.on("window-all-closed", () => {
  d = null, g.quit();
});
g.on("before-quit", () => {
  g.isQuiting = !0;
});
g.on("second-instance", () => {
  ee();
});
g.on("activate", () => {
  ee();
});
g.on("before-quit", () => {
  S && S.destroy(), g.exit();
});
m.handle("open-win", (t, e) => {
  const s = new $({
    webPreferences: {
      preload: V,
      nodeIntegration: !0,
      contextIsolation: !1
    }
  });
  O ? s.loadURL(`${O}#${e}`) : s.loadFile(be, { hash: e });
});
m.handle("show-message", async (t, e) => {
  const { type: s, title: n, message: r, width: o = 350, height: a = 250 } = e;
  if (d) {
    const l = new $({
      parent: d,
      modal: !0,
      width: o,
      height: a,
      webPreferences: {
        nodeIntegration: !1,
        contextIsolation: !0,
        preload: V
      },
      frame: !1,
      resizable: !1,
      backgroundColor: "#f5f5f5"
    }), u = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
              background: #fff;
            }
            .container {
              display: flex;
              flex-direction: column;
              gap: 15px;
            }
            .input-group {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .input-group label {
              font-size: 14px;
              color: #333;
            }
            .input-group input {
              padding: 8px 12px;
              border: 1px solid #dcdfe6;
              border-radius: 4px;
              font-size: 14px;
              width: 100%;
              box-sizing: border-box;
            }
            .input-group input:focus {
              outline: none;
              border-color: #409eff;
            }
            .button-group {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 10px;
            }
            .button {
              padding: 8px 15px;
              border: none;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              transition: background-color 0.3s;
            }
            .primary {
              background: #409eff;
              color: white;
            }
            .primary:hover {
              background: #66b1ff;
            }
            .default {
              background: #f4f4f5;
              color: #606266;
            }
            .default:hover {
              background: #e9e9eb;
            }
            .result {
              display: none;
              margin-top: 15px;
              padding: 15px;
              border-radius: 4px;
              background: #f8f9fa;
            }
            .result.show {
              display: ${s === "douyin" ? "none" : "block"};
            }
            .result-item {
              margin-bottom: 10px;
              font-size: 14px;
              line-height: 1.4;
            }
            .result-label {
              color: #606266;
              margin-right: 8px;
            }
            .result-value {
              color: #333;
            }
            .error-message {
              color: #f56c6c;
              font-size: 14px;
            }
            .placeholder-message {
              color: #909399;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="input-group">
              <label for="input">${r}</label>
              <input 
                type="text" 
                id="input" 
                value="" 
                placeholder="${s === "douyin" ? "请输入视频分享链接" : "请输入QQ号"}"
              >
            </div>
            <div id="result" class="result"></div>
            <div class="button-group">
              <button id="cancelBtn" class="button default">取消</button>
              <button id="okBtn" class="button primary">${s === "douyin" ? "获取无水印视频" : "查询"}</button>
            </div>
          </div>
          <script>
            const input = document.getElementById('input');
            const okBtn = document.getElementById('okBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const resultDiv = document.getElementById('result');
            
            // 显示初始结果区域
            if (resultDiv) {
              resultDiv.className = 'show';
            }

            async function submit() {
              if (!window.ipcRenderer) return;
　　 　 　 　
              const value = input.value.trim();
              if (type === 'default') {
                if (!/^\\d{5,11}$/.test(value)) {
                  if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">请输入正确的QQ号（5-11位数字）</div>';
                  }
                  return;
                }
              }

              okBtn.disabled = true;
              okBtn.textContent = type === 'douyin' ? '获取中...' : '查询中...';
　　 　 　 　
              if (resultDiv) {
                resultDiv.innerHTML = '<div class="placeholder-message">查询中...</div>';
              }

              try {
                if (type === 'default') {
                  const response = await fetch('https://api.xywlapi.cc/qqapi?qq=' + value);
                  const data = await response.json();
　　　　　　　
                  if (data.status === 200 && resultDiv) {
                    resultDiv.innerHTML = '<div class="result-item">' +
                      '<span class="result-label">查询状态：</span>' +
                      '<span class="result-value">' + data.message + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">QQ：</span>' +
                      '<span class="result-value">' + data.qq + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">归属地：</span>' +
                      '<span class="result-value">' + data.phonediqu + '</span>' +
                      '</div>';
                  } else if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">' + (data.message || '查询失败') + '</div>';
                  }
                } else {
                  window.ipcRenderer.invoke('submit-input', value);
                }
              } catch (error) {
                if (resultDiv) {
                  resultDiv.innerHTML = '<div class="error-message">查询失败，请稍后重试</div>';
                }
              } finally {
                okBtn.disabled = false;
                okBtn.textContent = type === 'douyin' ? '获取无水印视频' : '查询';
              }
            }

            function cancel() {
              if (window.ipcRenderer) {
                window.ipcRenderer.send('input-dialog-response', { type: 'cancel' });
              }
            }

            okBtn.addEventListener('click', submit);
            cancelBtn.addEventListener('click', cancel);

            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' && !okBtn.disabled) {
                submit();
              } else if (event.key === 'Escape') {
                cancel();
              }
            });

            input.focus();
            input.select();
          <\/script>
        </body>
      </html>
    `, f = c.join(g.getPath("temp"), "message-dialog.html");
    return await h.writeFile(f, u, "utf8"), await l.loadFile(f), new Promise((i) => {
      m.once("message-dialog-response", () => {
        l.close(), h.unlink(f).catch(console.error), i(0);
      }), l.on("closed", () => {
        i(0);
      });
    });
  }
  return 0;
});
m.handle("show-input", async (t, e) => {
  const { title: s, message: n, defaultValue: r, type: o = "default" } = e;
  if (d) {
    const a = new $({
      parent: d,
      modal: !0,
      width: 350,
      height: o === "douyin" ? 200 : 400,
      webPreferences: {
        nodeIntegration: !1,
        contextIsolation: !0,
        preload: V
      },
      frame: !1,
      resizable: !1,
      backgroundColor: "#f5f5f5"
    }), l = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
              background: #fff;
            }
            .container {
              display: flex;
              flex-direction: column;
              gap: 15px;
            }
            .input-group {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .input-group label {
              font-size: 14px;
              color: #333;
            }
            .input-group input {
              padding: 8px 12px;
              border: 1px solid #dcdfe6;
              border-radius: 4px;
              font-size: 14px;
              width: 100%;
              box-sizing: border-box;
            }
            .input-group input:focus {
              outline: none;
              border-color: #409eff;
            }
            .button-group {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 10px;
            }
            .button {
              padding: 8px 15px;
              border: none;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              transition: background-color 0.3s;
            }
            .primary {
              background: #409eff;
              color: white;
            }
            .primary:hover {
              background: #66b1ff;
            }
            .default {
              background: #f4f4f5;
              color: #606266;
            }
            .default:hover {
              background: #e9e9eb;
            }
            .result {
              display: none;
              margin-top: 15px;
              padding: 15px;
              border-radius: 4px;
              background: #f8f9fa;
            }
            .result.show {
              display: ${o === "douyin" ? "none" : "block"};
            }
            .result-item {
              margin-bottom: 10px;
              font-size: 14px;
              line-height: 1.4;
            }
            .result-label {
              color: #606266;
              margin-right: 8px;
            }
            .result-value {
              color: #333;
            }
            .error-message {
              color: #f56c6c;
              font-size: 14px;
            }
            .placeholder-message {
              color: #909399;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="input-group">
              <label for="input">${n}</label>
              <input 
                type="text" 
                id="input" 
                value="${r}" 
                placeholder="${o === "douyin" ? "请输入视频分享链接" : "请输入QQ号"}"
              >
            </div>
            <div id="result" class="result"></div>
            <div class="button-group">
              <button id="cancelBtn" class="button default">取消</button>
              <button id="okBtn" class="button primary">${o === "douyin" ? "获取无水印视频" : "查询"}</button>
            </div>
          </div>
          <script>
            const input = document.getElementById('input');
            const okBtn = document.getElementById('okBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const resultDiv = document.getElementById('result');
            
            // 显示初始结果区域
            if (resultDiv) {
              resultDiv.className = 'show';
            }

            async function submit() {
              if (!window.ipcRenderer) return;
　　 　 　 　
              const value = input.value.trim();
              if (type === 'default') {
                if (!/^\\d{5,11}$/.test(value)) {
                  if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">请输入正确的QQ号（5-11位数字）</div>';
                  }
                  return;
                }
              }

              okBtn.disabled = true;
              okBtn.textContent = type === 'douyin' ? '获取中...' : '查询中...';
　　 　 　 　
              if (resultDiv) {
                resultDiv.innerHTML = '<div class="placeholder-message">查询中...</div>';
              }

              try {
                if (type === 'default') {
                  const response = await fetch('https://api.xywlapi.cc/qqapi?qq=' + value);
                  const data = await response.json();
　　　　　　　
                  if (data.status === 200 && resultDiv) {
                    resultDiv.innerHTML = '<div class="result-item">' +
                      '<span class="result-label">查询状态：</span>' +
                      '<span class="result-value">' + data.message + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">QQ：</span>' +
                      '<span class="result-value">' + data.qq + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">归属地：</span>' +
                      '<span class="result-value">' + data.phonediqu + '</span>' +
                      '</div>';
                  } else if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">' + (data.message || '查询失败') + '</div>';
                  }
                } else {
                  window.ipcRenderer.invoke('submit-input', value);
                }
              } catch (error) {
                if (resultDiv) {
                  resultDiv.innerHTML = '<div class="error-message">查询失败，请稍后重试</div>';
                }
              } finally {
                okBtn.disabled = false;
                okBtn.textContent = type === 'douyin' ? '获取无水印视频' : '查询';
              }
            }

            function cancel() {
              if (window.ipcRenderer) {
                window.ipcRenderer.send('input-dialog-response', { type: 'cancel' });
              }
            }

            okBtn.addEventListener('click', submit);
            cancelBtn.addEventListener('click', cancel);

            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' && !okBtn.disabled) {
                submit();
              } else if (event.key === 'Escape') {
                cancel();
              }
            });

            input.focus();
            input.select();
          <\/script>
        </body>
      </html>
    `, u = c.join(g.getPath("temp"), "input-dialog.html");
    return await h.writeFile(u, l, "utf8"), await a.loadFile(u), new Promise((f) => {
      m.once("input-dialog-response", (i, p) => {
        a.close(), h.unlink(u).catch(console.error), f(p.type === "submit" ? p.value : null);
      }), a.on("closed", () => {
        f(null);
      });
    });
  }
  return null;
});
async function Rt() {
  try {
    if (process.platform === "win32") {
      const { stdout: e } = await ae(
        `wmic logicaldisk where "DeviceID='C:'" get Size,FreeSpace /format:value`
      ), s = e.match(/FreeSpace=(\d+)/), n = e.match(/Size=(\d+)/), r = Number((s == null ? void 0 : s[1]) || 0), o = Number((n == null ? void 0 : n[1]) || 0);
      return o ? {
        mount: "C:",
        total: o,
        free: r,
        used: Math.max(0, o - r)
      } : null;
    }
    const t = process.platform === "darwin" ? ["/System/Volumes/Data", "/"] : ["/"];
    for (const e of t)
      try {
        const { stdout: s } = await ae(`df -kP "${e}"`), n = s.trim().split(`
`);
        if (n.length < 2) continue;
        const r = n[n.length - 1].trim().split(/\s+/);
        if (r.length < 6) continue;
        const o = Number(r[1]), a = Number(r[2]), l = Number(r[3]);
        if (!o) continue;
        return {
          mount: r[5] || e,
          total: o * 1024,
          used: a * 1024,
          free: l * 1024
        };
      } catch {
      }
    return null;
  } catch (t) {
    return console.error("Failed to read disk usage:", t), null;
  }
}
m.handle("system:machine-info", async () => {
  var o;
  const t = x.totalmem(), e = x.freemem(), s = x.cpus(), n = {
    darwin: "macOS",
    win32: "Windows",
    linux: "Linux"
  }, r = await Rt();
  return {
    hostname: x.hostname(),
    username: x.userInfo().username,
    platform: process.platform,
    platformLabel: n[process.platform] || process.platform,
    arch: x.arch(),
    release: x.release(),
    cpuModel: (((o = s[0]) == null ? void 0 : o.model) || "").replace(/\s+/g, " ").trim(),
    cpuCores: s.length,
    totalMem: t,
    freeMem: e,
    usedMem: t - e,
    disk: r
  };
});
it();
ct(() => d);
xt();
const J = new Le({
  name: "CZTool",
  path: process.execPath,
  isHidden: !1
});
m.handle("settings:get-auto-launch", async () => {
  try {
    return await J.isEnabled();
  } catch (t) {
    return console.error("Failed to get auto launch status:", t), !1;
  }
});
m.handle("settings:set-auto-launch", async (t, e) => {
  try {
    return e ? await J.enable() : await J.disable(), !0;
  } catch (s) {
    return console.error("Failed to set auto launch:", s), !1;
  }
});
m.handle("douyin:parse", async (t, e) => {
  try {
    const s = await le("https://dd.oihome.dpdns.org/api/parse", {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "x-grey-version": "YBQ",
        Referer: "https://dd.oihome.dpdns.org/"
      },
      body: JSON.stringify({
        url: e,
        mobile: !1,
        timeout: 30
      })
    });
    if (!s.ok)
      throw new Error(`HTTP ${s.status}`);
    return await s.json();
  } catch (s) {
    throw console.error("Error parsing douyin url:", s), s;
  }
});
m.handle("fetch-qq-nickname", async (t, e) => {
  try {
    const s = Tt("https"), n = `https://v.api.aa1.cn/api/qqnicheng/index.php?qq=${e}&type=json`;
    return console.log("Fetching QQ nickname for:", e), console.log("Request URL:", n), new Promise((r, o) => {
      const a = s.get(n, {
        rejectUnauthorized: !1,
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      }, (l) => {
        let u = "";
        if (console.log("Response status:", l.statusCode), console.log("Response headers:", l.headers), l.statusCode !== 200) {
          console.error("HTTP Error:", l.statusCode), o(new Error(`HTTP Error: ${l.statusCode}`));
          return;
        }
        l.on("data", (f) => {
          u += f;
        }), l.on("end", () => {
          console.log("Raw response data:", u);
          try {
            const f = u.match(/(\{\"code\":.*\})/);
            if (!f) {
              console.error("No JSON data found in response"), console.error("Raw data:", u), r({ code: 500, error: "No JSON data found in response" });
              return;
            }
            const i = f[1];
            console.log("Extracted JSON:", i);
            const p = JSON.parse(i);
            console.log("Parsed JSON data:", p), r(p);
          } catch (f) {
            console.error("Parse error:", f), console.error("Raw data:", u), r({ code: 500, error: "Invalid JSON response" });
          }
        });
      });
      a.on("error", (l) => {
        console.error("Request error:", l), r({ code: 500, error: l.message });
      }), a.setTimeout(5e3, () => {
        console.error("Request timeout"), a.destroy(), r({ code: 500, error: "Request timeout" });
      }), a.end();
    });
  } catch (s) {
    return console.error("Error fetching QQ nickname:", s), { code: 500, error: s.message };
  }
});
export {
  Ht as MAIN_DIST,
  ve as RENDERER_DIST,
  O as VITE_DEV_SERVER_URL
};
