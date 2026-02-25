-- Phase 1 & 2 Migration: Auto-linking and Advanced Schema

-- 1. Create seo_keywords table
CREATE TABLE IF NOT EXISTS seo_keywords (
  id CHAR(36) NOT NULL PRIMARY KEY,
  keyword VARCHAR(100) NOT NULL UNIQUE,
  target_url VARCHAR(500) NOT NULL,
  link_limit INT DEFAULT 1 CHECK (link_limit >= 1),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by CHAR(36) NULL,
  CONSTRAINT fk_seo_keywords_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for optimization
CREATE INDEX idx_seo_keywords_keyword ON seo_keywords(keyword);

-- 2. Add schema_data JSON column to posts table
ALTER TABLE posts ADD COLUMN schema_data JSON NULL;
