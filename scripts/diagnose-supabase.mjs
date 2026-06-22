// 진단: DNS, TCP, HTTP, 그리고 GoTrue health 까지 단계별로 확인
import dns from "node:dns/promises";
import https from "node:https";

const HOST = "xetzgpvyiwnwuzhephpl.supabase.co";
const URLS = [
  `https://${HOST}/`,
  `https://${HOST}/rest/v1/`,
  `https://${HOST}/auth/v1/health`,
];

console.log("=== Supabase 프로젝트 상태 진단 ===");
console.log("Host:", HOST);
console.log("시간(UTC):", new Date().toISOString());

try {
  const a = await dns.resolve4(HOST);
  console.log("✓ DNS A 레코드:", a);
} catch (e) {
  console.log("✗ DNS A 해석 실패:", e.code, e.message);
}
try {
  const aaaa = await dns.resolve6(HOST).catch(() => null);
  if (aaaa) console.log("  DNS AAAA:", aaaa);
} catch {}
try {
  const cname = await dns.resolveCname(HOST).catch(() => null);
  if (cname) console.log("  CNAME:", cname);
} catch {}

function head(url) {
  return new Promise(resolve => {
    const req = https.request(url, { method: "GET", timeout: 8000 }, res => {
      let body = "";
      res.on("data", c => { if (body.length < 400) body += c.toString(); });
      res.on("end", () => resolve({ ok: true, status: res.statusCode, headers: res.headers, body: body.slice(0, 300) }));
    });
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error", err => resolve({ ok: false, error: err.code + " " + err.message }));
    req.end();
  });
}

for (const u of URLS) {
  const r = await head(u);
  if (r.ok) {
    console.log(`✓ GET ${u} → HTTP ${r.status}`);
    console.log("  본문(앞 300자):", r.body.replace(/\s+/g, " ").trim());
  } else {
    console.log(`✗ GET ${u} → ${r.error}`);
  }
}
