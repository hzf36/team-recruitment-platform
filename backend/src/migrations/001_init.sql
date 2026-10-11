CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  weekly_hours INTEGER NOT NULL DEFAULT 0 CHECK (weekly_hours >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  progress TEXT NOT NULL DEFAULT '',
  expected_outcome TEXT NOT NULL DEFAULT '',
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_roles (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skill_requirements TEXT[] NOT NULL DEFAULT '{}',
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_roles_project ON project_roles(project_id);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role_id INTEGER REFERENCES project_roles(id),
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_project ON members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role_id);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES project_roles(id),
  applicant_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  contribution TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  reject_reason TEXT,
  snapshot_nickname TEXT NOT NULL,
  snapshot_bio TEXT NOT NULL DEFAULT '',
  snapshot_skills TEXT[] NOT NULL DEFAULT '{}',
  snapshot_weekly_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_project ON applications(project_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- At most one pending application per user per project
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_app_per_user_project
  ON applications(project_id, applicant_id)
  WHERE status = 'pending';
