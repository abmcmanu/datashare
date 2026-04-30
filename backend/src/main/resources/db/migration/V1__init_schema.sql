-- ==========================================================
-- DataShare — Schéma initial (V1)
-- Reflète le MCD : USER, FILE, TAG, FILE_TAG, DOWNLOAD_LOG
-- ==========================================================

-- gen_random_uuid() vient du module pgcrypto (souvent déjà installé)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----- USERS -----
CREATE TABLE users (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(72)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----- FILES -----
CREATE TABLE files (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id           UUID         REFERENCES users(id) ON DELETE CASCADE,
    download_token     VARCHAR(64)  NOT NULL UNIQUE,
    original_filename  VARCHAR(255) NOT NULL,
    storage_key        VARCHAR(255) NOT NULL UNIQUE,
    mime_type          VARCHAR(100) NOT NULL,
    size_bytes         BIGINT       NOT NULL,
    password_hash      VARCHAR(72),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at         TIMESTAMPTZ  NOT NULL,
    CONSTRAINT chk_size_max_1gb     CHECK (size_bytes > 0 AND size_bytes <= 1073741824),
    CONSTRAINT chk_expires_max_7d   CHECK (expires_at <= created_at + INTERVAL '7 days')
);

CREATE INDEX idx_files_token       ON files (download_token);
CREATE INDEX idx_files_owner       ON files (owner_id);
CREATE INDEX idx_files_expires_at  ON files (expires_at);

-- ----- TAGS -----
CREATE TABLE tags (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       VARCHAR(30) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tag_owner_label UNIQUE (owner_id, label)
);

-- ----- FILE_TAGS (table pivot N..N) -----
CREATE TABLE file_tags (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

-- ----- DOWNLOAD_LOGS -----
CREATE TABLE download_logs (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id                     UUID        NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    downloaded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_hash                     CHAR(64)    NOT NULL,
    password_attempt_succeeded  BOOLEAN     NOT NULL
);

CREATE INDEX idx_logs_file ON download_logs (file_id);

-- Trigger : updated_at sur users
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
