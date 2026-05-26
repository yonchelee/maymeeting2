-- 5.27초 멈추기 — Supabase 설정 SQL
-- 사용법: Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 "Run".
-- 여러 번 실행해도 안전하도록 작성됨 (idempotent).

-- 1) 점수 테이블
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 16),
  time_sec    double precision not null,
  error_sec   double precision not null,
  created_at  timestamptz not null default now()
);

-- 2) 순위표 조회 속도용 인덱스 (오차 오름차순)
create index if not exists scores_error_idx on public.scores (error_sec asc);

-- 3) RLS 켜기
alter table public.scores enable row level security;

-- 4) 정책: 누구나 읽기(순위표 표시) / 추가(플레이 결과 저장)
--    삭제·수정 정책은 두지 않음 → anon 은 기록을 지우거나 바꿀 수 없음
drop policy if exists "public read"   on public.scores;
drop policy if exists "public insert" on public.scores;

create policy "public read"
  on public.scores for select
  to anon using (true);

create policy "public insert"
  on public.scores for insert
  to anon with check (true);

-- 5) 실시간(Realtime) 켜기 — 모든 폰의 순위표가 즉시 갱신되도록
--    이미 추가돼 있으면 에러가 날 수 있는데, 그 경우 이 줄은 무시해도 됨.
do $$
begin
  alter publication supabase_realtime add table public.scores;
exception
  when duplicate_object then null;  -- 이미 추가됨
  when undefined_object then null;  -- publication 이 없으면 무시
end $$;
