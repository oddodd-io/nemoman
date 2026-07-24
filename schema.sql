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
