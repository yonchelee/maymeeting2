import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xetzgpvyiwnwuzhephpl.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldHpncHZ5aXdud3V6aGVwaHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDQxNzUsImV4cCI6MjA5NTM4MDE3NX0.TCX-_CSZHhhkXboIuVi0GZfbybKmomh7q9ZsAMAx--c";

const sb = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0;
function ok(label, cond, extra = "") {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✓" : "✗"} ${label}${extra ? "  " + extra : ""}`);
}

console.log("=== 실환경 Supabase 검증: 사용자 랭킹이 잘 쌓이는가 ===\n");

// 1) 연결 + 테이블 존재
const init = await sb.from("scores")
  .select("id,name,time_sec,error_sec")
  .order("error_sec", { ascending: true })
  .limit(50);
ok("연결 + scores 테이블 접근", !init.error,
   init.error ? JSON.stringify(init.error) : `현재 누적 행=${init.data.length}`);
if (init.error) { console.log("중단: 테이블/연결 문제"); process.exit(1); }

const before = init.data.length;

// 2) 게임과 동일한 모양으로 3개 삽입 (오차 다양 → 정렬 검증)
const TAG = "🔬검증";
const tests = [
  { name: `${TAG}_가`, time: 5.27 + 0.42, error: 0.42 },
  { name: `${TAG}_나`, time: 5.27 + 0.05, error: 0.05 },   // 가장 작은 오차
  { name: `${TAG}_다`, time: 5.27 + 0.18, error: 0.18 },
];

const insertedIds = [];
for (const t of tests) {
  const { data, error } = await sb.from("scores")
    .insert({ name: t.name, time_sec: t.time, error_sec: t.error })
    .select("id")
    .single();
  ok(`insert ${t.name}`,
     !error && data && typeof data.id !== "undefined",
     error ? JSON.stringify(error) : `id=${data.id}`);
  if (data && data.id) insertedIds.push(data.id);
}

// 3) 누적 확인
const after = await sb.from("scores")
  .select("id,name,time_sec,error_sec")
  .order("error_sec", { ascending: true })
  .limit(50);
ok("랭킹 누적 (count 증가)",
   after.data.length === before + tests.length,
   `before=${before} → after=${after.data.length}`);

// 4) 오차 오름차순 정렬 (전체 + 방금 삽입한 행들 내부)
const allErrs = after.data.map(r => Number(r.error_sec));
const allSorted = [...allErrs].sort((a, b) => a - b);
ok("전체 순위표 오차 오름차순",
   JSON.stringify(allErrs) === JSON.stringify(allSorted));

const mine = after.data.filter(r => r.name && r.name.startsWith(TAG));
const myErrs = mine.map(r => Number(r.error_sec));
ok("삽입 행 정렬 = 0.05 → 0.18 → 0.42",
   JSON.stringify(myErrs) === JSON.stringify([0.05, 0.18, 0.42]),
   `got=${JSON.stringify(myErrs)}`);

// 5) RLS: anon 은 삭제/수정 불가 — 보안 검증
const delRes = await sb.from("scores").delete().in("id", insertedIds);
const afterDel = await sb.from("scores").select("id").limit(60);
ok("RLS: anon 삭제 차단 (개수 유지)",
   afterDel.data.length === after.data.length,
   `len=${afterDel.data.length}`);

const updRes = await sb.from("scores").update({ error_sec: 99 }).in("id", insertedIds);
const afterUpd = await sb.from("scores")
  .select("id,error_sec")
  .in("id", insertedIds);
const anyUpdated = afterUpd.data.some(r => Number(r.error_sec) === 99);
ok("RLS: anon 수정 차단", !anyUpdated);

// 6) 사용자 가시 순위표 (상위 12 미리보기)
console.log("\n=== 현재 순위표(상위 12) — 게임 화면과 동일 모양 ===");
after.data.slice(0, 12).forEach((r, i) => {
  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
  console.log(`  ${medal}  ${r.name}   멈춘시간 ${Number(r.time_sec).toFixed(2)}초   오차 ±${Number(r.error_sec).toFixed(2)}초`);
});

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
console.log("\n[테스트 데이터 정리] Supabase SQL Editor 에서 한 줄:");
console.log("  delete from public.scores where name like '🔬%';");

process.exit(fail ? 1 : 0);
