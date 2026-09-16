-- 견적 신청 저장 테이블 (Cloudflare D1)
-- 생성: wrangler d1 execute nemoman-db --file=schema.sql
CREATE TABLE IF NOT EXISTS estimates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT    NOT NULL,        -- ISO 8601
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL,
  region        TEXT    NOT NULL,
  wish_date     TEXT,                    -- 희망 시공일
  building_type TEXT,                    -- store/office/factory/house
  category      TEXT,                    -- food/retail/service/office/other
  size          REAL,                    -- 평수
  scope         TEXT,                    -- partial/full
  est_min       INTEGER,                 -- 예상 견적 최소(만원)
  est_max       INTEGER,                 -- 예상 견적 최대(만원)
  interior      TEXT,                    -- yes/no/maybe
  memo          TEXT
);

CREATE INDEX IF NOT EXISTS idx_estimates_created ON estimates (created_at DESC);

-- 상담 신청 저장 테이블 (consult.html → /api/consult · 욕실/철거/기타)
CREATE TABLE IF NOT EXISTS consult_inquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT    NOT NULL,        -- ISO 8601
  kind       TEXT    NOT NULL,        -- bath/demo/etc (욕실·화장실 / 점포·상가 철거 / 기타 인테리어)
  name       TEXT,
  phone      TEXT    NOT NULL,
  region     TEXT    NOT NULL,
  scope      TEXT,                    -- 공사 희망 범위 (쉼표 구분)
  memo       TEXT,                    -- 예산·스타일 등
  photos     TEXT,                    -- R2 키 JSON 배열 ["consult/2026/09/uuid.jpg", ...]
  source     TEXT                     -- 유입 경로 (utm_source / src / referrer)
);

CREATE INDEX IF NOT EXISTS idx_consult_inquiries_created ON consult_inquiries (created_at DESC);
