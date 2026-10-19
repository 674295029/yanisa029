-- =============================================
-- Homework Tracker - Cloudflare D1 Schema
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('teacher', 'student', 'admin')),
  avatar TEXT,
  student_number TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Classrooms table
CREATE TABLE IF NOT EXISTS classrooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  description TEXT,
  class_code TEXT UNIQUE NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  teacher_name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Classroom members (many-to-many)
CREATE TABLE IF NOT EXISTS classroom_members (
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (classroom_id, student_id)
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT NOT NULL,
  max_score REAL NOT NULL DEFAULT 10,
  allow_late INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published', 'closed')),
  attachment_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  student_name TEXT NOT NULL,
  student_number TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'late', 'graded', 'resubmitted')),
  submitted_at TEXT DEFAULT (datetime('now')),
  text_response TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(assignment_id, student_id)
);

-- Submission files
CREATE TABLE IF NOT EXISTS submission_files (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_url TEXT NOT NULL,
  mime_type TEXT
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  submission_id TEXT UNIQUE NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  grader_id TEXT NOT NULL REFERENCES users(id),
  score REAL NOT NULL,
  feedback TEXT,
  graded_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_student ON classroom_members(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_submission ON grades(submission_id);

-- Seed admin user
INSERT OR IGNORE INTO users (id, email, name, role)
VALUES ('admin-1', 'seree999@gmail.com', 'Admin (seree999)', 'admin');
