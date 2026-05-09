import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".moc3": "application/octet-stream",
};

export function createStaticServer({ root = defaultRoot } = {}) {
  return createServer((request, response) => {
    if (request.method === "POST" && request.url === "/api/analyze") {
      handleAnalyze(request, response);
      return;
    }

    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad Request");
      return;
    }

    const relativePath = normalize(pathname.replace(/^\/+/, ""));
    const absolutePath = resolve(join(root, relativePath || "index.html"));

    if (absolutePath !== root && !absolutePath.startsWith(root + sep)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const filePath = resolveFilePath(absolutePath);
    if (!filePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  createStaticServer().listen(port, host, () => {
    console.log(`Live2D Face & Voice: http://${host}:${port}/`);
  });
}

function resolveFilePath(absolutePath) {
  if (!existsSync(absolutePath)) return null;

  const stats = statSync(absolutePath);
  if (stats.isDirectory()) {
    const indexPath = join(absolutePath, "index.html");
    return existsSync(indexPath) ? indexPath : null;
  }

  return stats.isFile() ? absolutePath : null;
}

const MAX_BODY_BYTES = 256 * 1024;
const ANALYZE_TIMEOUT_MS = 60_000;

function handleAnalyze(request, response) {
  readBody(request, MAX_BODY_BYTES)
    .then(async (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString("utf8"));
      } catch {
        return sendJson(response, 400, { error: "invalid JSON" });
      }
      const segments = Array.isArray(payload?.segments) ? payload.segments : null;
      if (!segments || segments.length === 0) {
        return sendJson(response, 400, { error: "segments required" });
      }
      const cleaned = segments
        .map((s) => ({
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          text: typeof s.text === "string" ? s.text.slice(0, 800) : "",
        }))
        .filter((s) => s.text);
      if (cleaned.length === 0) {
        return sendJson(response, 400, { error: "no usable text in segments" });
      }
      const expressionList = normalizeExpressionList(payload?.expressions);
      const prompt = buildAnalyzePrompt(cleaned, expressionList);
      try {
        const claudeOutput = await runClaude(prompt);
        const events = extractEvents(claudeOutput, expressionList);
        return sendJson(response, 200, { events });
      } catch (error) {
        console.error("[/api/analyze]", error?.message || error);
        return sendJson(response, 500, { error: error?.message || String(error) });
      }
    })
    .catch((error) => {
      console.error("[/api/analyze body]", error?.message || error);
      sendJson(response, 400, { error: error?.message || String(error) });
    });
}

function readBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("payload too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

// Claude へ渡す表情ヒント。src/app.js の MODELS で表情を増やしたら、ここにも
// 同じ id でヒント文を追加すると解析精度が上がります。未登録の id は
// クライアントから送られたラベル（または id 自体）がそのまま使われます。
const EXPRESSION_HINTS = {
  smile: "笑顔（楽しい、嬉しい、親しみ）",
  angry: "怒り（苛立ち、不満、強い否定）",
  sad: "悲しみ（落胆、寂しさ、気落ち）",
  surprise: "驚き（驚愕、急変への反応）",
  cheek: "照れ（恥じらい、嬉しさ、はにかみ）",
};

function normalizeExpressionList(raw) {
  if (!Array.isArray(raw)) {
    return [
      { id: "smile", label: "笑顔" },
      { id: "angry", label: "怒り" },
      { id: "sad", label: "悲しみ" },
      { id: "surprise", label: "驚き" },
      { id: "cheek", label: "照れ" },
    ];
  }
  return raw
    .map((item) => {
      if (typeof item === "string") return { id: item, label: item };
      if (item && typeof item.id === "string") {
        return { id: item.id, label: typeof item.label === "string" ? item.label : item.id };
      }
      return null;
    })
    .filter(Boolean);
}

function buildAnalyzePrompt(segments, expressions) {
  const lines = expressions.map((e) => {
    const hint = EXPRESSION_HINTS[e.id] || e.label || e.id;
    return `- "${e.id}" ${hint}`;
  });
  return `あなたは Live2D キャラクター演出ディレクターです。
日本語の発話を、表情とジェスチャのタイムラインに翻訳してください。

## 利用できる表情（次の切替まで持続。下記以外は使わないこと）
${lines.join("\n")}
- null：中立／表情解除

## 利用できるジェスチャ（0.5〜1.5秒の一出し）
- "nod" 頷き（同意、強調、相槌）
- "headTilt" 首かしげ（疑問、戸惑い）
- "shake" 首振り（否定、拒絶）
- "bounce" 跳ね（驚き、テンション急上昇）
- "pullback" 頭引き（衝撃、驚愕）
- "leanIn" 前のめり（興味、強い関心）

## ルール
- 感情/強調が本当に変わるときだけイベントを出す（多発させない）
- ジェスチャは 1.5 秒以上の間隔をあける
- time は秒（小数2桁まで）。発話セグメントの開始から終わりの間で、感情が立ち上がる位置に置く
- intensity は 0.4〜1.0
- 出力は JSON のみ。コードフェンスや説明文は付けない

## 出力スキーマ
{"events":[{"time":1.20,"expression":"smile","gesture":null,"intensity":0.7}]}

## 入力（発話セグメント）
${JSON.stringify(segments)}
`;
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "json"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGTERM");
      } catch {}
      reject(new Error(`claude timed out after ${ANALYZE_TIMEOUT_MS}ms`));
    }, ANALYZE_TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`failed to spawn claude: ${error.message}`));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(prompt);
  });
}

function extractEvents(claudeOutput, expressions) {
  let envelope;
  try {
    envelope = JSON.parse(claudeOutput);
  } catch {
    throw new Error("claude output is not JSON");
  }
  const result = typeof envelope?.result === "string" ? envelope.result : "";
  if (!result) {
    throw new Error("claude returned empty result");
  }
  const inner = parseLooseJson(result);
  const events = Array.isArray(inner?.events) ? inner.events : null;
  if (!events) {
    throw new Error("events array missing in claude response");
  }
  const allowedExpr = new Set([...expressions.map((e) => e.id), null]);
  const allowedGesture = new Set([
    "nod",
    "headTilt",
    "shake",
    "bounce",
    "pullback",
    "leanIn",
    null,
  ]);
  return events
    .map((ev) => {
      const time = Number(ev?.time);
      if (!Number.isFinite(time) || time < 0) return null;
      const expression = ev?.expression === undefined ? undefined : (ev.expression ?? null);
      const gesture = ev?.gesture === undefined ? null : (ev.gesture ?? null);
      const intensity = Math.min(1, Math.max(0, Number(ev?.intensity) || 0.7));
      if (expression !== undefined && !allowedExpr.has(expression)) return null;
      if (!allowedGesture.has(gesture)) return null;
      return { time, expression, gesture, intensity };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function parseLooseJson(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("no JSON object found in result");
  }
  return JSON.parse(match[0]);
}
