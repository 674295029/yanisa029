import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ========== Types ==========
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI?: any;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ADMIN_EMAILS: string;
  APP_URL: string;
  GEMINI_API_KEY?: string;
}

// ========== Helpers ==========
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, ...vals] = part.trim().split('=');
    if (key.trim() === name) {
      return vals.join('=').trim();
    }
  }
  return null;
}

// ========== App ==========
const app = new Hono<{ Bindings: Env; Variables: { user: any; userId: string } }>();

// CORS for local dev
app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// ========== Auth Middleware ==========
app.use('/api/*', async (c, next) => {
  const path = c.req.path;

  // Public routes - no auth needed
  if (
    path === '/api/auth/google' ||
    path === '/api/auth/google/callback' ||
    path === '/api/auth/status' ||
    path === '/api/auth/debug'
  ) {
    return next();
  }

  // Support both Authorization: Bearer TOKEN and Cookie: session=TOKEN
  const authHeader = c.req.header('Authorization');
  const cookieHeader = c.req.header('Cookie');
  const sessionId = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
    || getCookie(cookieHeader ?? null, 'session');

  if (!sessionId) {
    return c.json({ error: 'กรุณาเข้าสู่ระบบก่อน', code: 'UNAUTHORIZED' }, 401);
  }

  const now = Date.now();
  const sessionRow = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > ?'
  ).bind(sessionId, now).first();

  if (!sessionRow) {
    return c.json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', code: 'SESSION_EXPIRED' }, 401);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(sessionRow.user_id)
    .first();

  if (!user) {
    return c.json({ error: 'ไม่พบบัญชีผู้ใช้', code: 'USER_NOT_FOUND' }, 401);
  }

  c.set('user', user);
  c.set('userId', user.id as string);
  return next();
});

// ========== Auth Routes ==========

// Debug endpoint
app.get('/api/auth/debug', (c) => {
  return c.json({
    hasClientId: !!c.env.GOOGLE_CLIENT_ID,
    clientIdPrefix: c.env.GOOGLE_CLIENT_ID?.substring(0, 20),
    hasClientSecret: !!c.env.GOOGLE_CLIENT_SECRET,
    secretLength: c.env.GOOGLE_CLIENT_SECRET?.length,
    appUrl: c.env.APP_URL,
  });
});

// GET /api/auth/google - Redirect to Google OAuth
app.get('/api/auth/google', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const appUrl = c.env.APP_URL || 'https://homework-tracker.674295029.workers.dev';
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback
app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const appUrl = c.env.APP_URL || 'https://homework-tracker.674295029.workers.dev';

  if (error || !code) {
    return c.redirect(`${appUrl}/?auth_error=${error || 'no_code'}`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenBody = await tokenRes.text();
    if (!tokenRes.ok) {
      const errMsg = encodeURIComponent(tokenBody.substring(0, 200));
      return c.redirect(`${appUrl}/?auth_error=token_failed&detail=${errMsg}`);
    }

    const tokens: any = JSON.parse(tokenBody);

    // Fetch user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      return c.redirect(`${appUrl}/?auth_error=profile_failed`);
    }

    const profile: any = await profileRes.json();
    const email = (profile.email || '').toLowerCase();
    const name = profile.name || email;
    const avatar = profile.picture || '';

    // Determine role
    const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase());
    const isAdmin = adminEmails.includes(email);

    // Upsert user
    const existingUser = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email).first();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id as string;
      const newRole = isAdmin ? 'admin' : (existingUser.role as string);
      await c.env.DB.prepare(
        "UPDATE users SET name = ?, avatar = ?, role = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(name, avatar, newRole, userId).run();
    } else {
      userId = generateId('user');
      const role = isAdmin ? 'admin' : 'student';  // New users default to student
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, name, role, avatar) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, email, name, role, avatar).run();
    }

    // Create DB session (7 days)
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, expiresAt).run();

    // Return HTML that sets cookie and redirects
    const maxAge = 7 * 24 * 60 * 60;
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>กำลังเข้าสู่ระบบ...</title>
<script>
  var sid = '${sessionId}';
  // Store in localStorage so the React app can use it as Bearer token
  try { localStorage.setItem('hw_session', sid); } catch(e) {}
  // Also try cookie
  document.cookie = 'session=' + sid + '; path=/; max-age=${maxAge}; SameSite=Lax';
  
  // Poll until session is confirmed in DB, then redirect
  async function goHome() {
    for (var i = 0; i < 20; i++) {
      await new Promise(function(r){ setTimeout(r, 300); });
      try {
        var r = await fetch('/api/auth/status', {
          credentials: 'include',
          headers: { 'Authorization': 'Bearer ' + sid }
        });
        var d = await r.json();
        if (d.authenticated) {
          window.location.replace('/');
          return;
        }
      } catch(e) {}
    }
    // Last resort: redirect anyway
    window.location.replace('/');
  }
  goHome();
</script>
</head>
<body style="font-family:sans-serif;text-align:center;padding:50px">
  <p>กำลังเข้าสู่ระบบ กรุณารอสักครู่...</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `session=${sessionId}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`,
      },
    });
  } catch (err: any) {
    return c.redirect(`${appUrl}/?auth_error=server_error&msg=${encodeURIComponent(String(err?.message || err))}`);
  }
});

// GET /api/auth/status
app.get('/api/auth/status', async (c) => {
  const authHeader = c.req.header('Authorization');
  const cookieHeader = c.req.header('Cookie');
  const sessionId = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
    || getCookie(cookieHeader ?? null, 'session');

  if (!sessionId) {
    return c.json({ authenticated: false });
  }

  const now = Date.now();
  const sessionRow = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > ?'
  ).bind(sessionId, now).first();

  if (!sessionRow) {
    return c.json({ authenticated: false });
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(sessionRow.user_id).first();

  if (!user) {
    return c.json({ authenticated: false });
  }

  return c.json({ authenticated: true, user });
});

// GET /api/auth/me
app.get('/api/auth/me', (c) => {
  const user = c.get('user');
  return c.json({ user });
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const sessionId = getCookie(cookieHeader ?? null, 'session');
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; Path=/; Max-Age=0; SameSite=Lax; Secure',
    },
  });
});

// ========== Classrooms Routes ==========

app.get('/api/classrooms', async (c) => {
  const user = c.get('user');
  let classrooms;
  if (user.role === 'admin') {
    classrooms = await c.env.DB.prepare('SELECT * FROM classrooms ORDER BY created_at DESC').all();
  } else if (user.role === 'teacher') {
    classrooms = await c.env.DB.prepare(
      'SELECT * FROM classrooms WHERE teacher_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();
  } else {
    classrooms = await c.env.DB.prepare(
      `SELECT c.* FROM classrooms c
       INNER JOIN classroom_members cm ON c.id = cm.classroom_id
       WHERE cm.student_id = ?
       ORDER BY c.created_at DESC`
    ).bind(user.id).all();
  }

  const results = [];
  for (const cls of classrooms.results) {
    const members = await c.env.DB.prepare(
      'SELECT student_id FROM classroom_members WHERE classroom_id = ?'
    ).bind(cls.id).all();
    results.push({
      id: cls.id,
      title: cls.title,
      subjectCode: cls.subject_code,
      description: cls.description,
      classCode: cls.class_code,
      teacherId: cls.teacher_id,
      teacherName: cls.teacher_name,
      academicYear: cls.academic_year,
      semester: cls.semester,
      memberStudentIds: members.results.map((m: any) => m.student_id),
    });
  }
  return c.json({ classrooms: results });
});

app.post('/api/classrooms', async (c) => {
  const user = c.get('user');
  if (user.role === 'student') return c.json({ error: 'นักเรียนไม่สามารถสร้างห้องเรียนได้' }, 403);

  const body = await c.req.json();
  const { title, subjectCode, description, academicYear, semester } = body;
  if (!title || !subjectCode) return c.json({ error: 'กรุณากรอกชื่อวิชาและรหัสวิชา' }, 400);

  const id = generateId('cls');
  const classCode = generateClassCode();
  await c.env.DB.prepare(
    `INSERT INTO classrooms (id, title, subject_code, description, class_code, teacher_id, teacher_name, academic_year, semester)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, title, subjectCode, description || '', classCode, user.id, user.name, academicYear || '2568', semester || 1).run();

  const classroom = await c.env.DB.prepare('SELECT * FROM classrooms WHERE id = ?').bind(id).first();
  return c.json({
    classroom: classroom ? {
      id: classroom.id,
      title: classroom.title,
      subjectCode: classroom.subject_code,
      description: classroom.description,
      classCode: classroom.class_code,
      teacherId: classroom.teacher_id,
      teacherName: classroom.teacher_name,
      academicYear: classroom.academic_year,
      semester: classroom.semester,
      memberStudentIds: [],
    } : null
  });
});

app.post('/api/classrooms/join', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { classCode } = body;
  if (!classCode) return c.json({ error: 'กรุณากรอกรหัสห้องเรียน' }, 400);

  const classroom = await c.env.DB.prepare(
    'SELECT * FROM classrooms WHERE UPPER(class_code) = UPPER(?)'
  ).bind(classCode.trim()).first();

  if (!classroom) return c.json({ error: 'ไม่พบรหัสห้องเรียนนี้' }, 404);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM classroom_members WHERE classroom_id = ? AND student_id = ?'
  ).bind(classroom.id, user.id).first();

  if (existing) return c.json({ error: 'คุณได้เข้าร่วมห้องเรียนนี้ไปแล้ว' }, 400);

  await c.env.DB.prepare(
    'INSERT INTO classroom_members (classroom_id, student_id) VALUES (?, ?)'
  ).bind(classroom.id, user.id).run();

  const members = await c.env.DB.prepare(
    'SELECT student_id FROM classroom_members WHERE classroom_id = ?'
  ).bind(classroom.id).all();

  return c.json({
    classroom: {
      id: classroom.id,
      title: classroom.title,
      subjectCode: classroom.subject_code,
      description: classroom.description,
      classCode: classroom.class_code,
      teacherId: classroom.teacher_id,
      teacherName: classroom.teacher_name,
      academicYear: classroom.academic_year,
      semester: classroom.semester,
      memberStudentIds: members.results.map((m: any) => m.student_id),
    },
  });
});

// GET /api/classrooms/:id/students - Enrolled students for a classroom
app.get('/api/classrooms/:id/students', async (c) => {
  const classroomId = c.req.param('id');
  const students = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.avatar, u.student_number
     FROM users u
     INNER JOIN classroom_members cm ON u.id = cm.student_id
     WHERE cm.classroom_id = ?
     ORDER BY u.name`
  ).bind(classroomId).all();

  const results = students.results.map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatar: u.avatar,
    studentNumber: u.student_number,
  }));

  return c.json({ students: results });
});

// ========== Assignments Routes ==========

app.get('/api/assignments', async (c) => {
  const classroomId = c.req.query('classroomId');
  let assignments;
  if (classroomId) {
    assignments = await c.env.DB.prepare(
      'SELECT * FROM assignments WHERE classroom_id = ? ORDER BY created_at DESC'
    ).bind(classroomId).all();
  } else {
    assignments = await c.env.DB.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all();
  }

  const results = assignments.results.map((a: any) => ({
    id: a.id,
    classroomId: a.classroom_id,
    title: a.title,
    description: a.description,
    dueDate: a.due_date,
    maxScore: a.max_score,
    allowLate: a.allow_late === 1,
    status: a.status,
    attachmentName: a.attachment_name,
    createdAt: a.created_at,
  }));
  return c.json({ assignments: results });
});

app.post('/api/assignments', async (c) => {
  const user = c.get('user');
  if (user.role === 'student') return c.json({ error: 'นักเรียนไม่สามารถสร้างการบ้านได้' }, 403);

  const body = await c.req.json();
  const { classroomId, title, description, dueDate, maxScore, allowLate, status, attachmentName } = body;
  if (!classroomId || !title || !dueDate) return c.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, 400);

  const id = generateId('asg');
  await c.env.DB.prepare(
    `INSERT INTO assignments (id, classroom_id, title, description, due_date, max_score, allow_late, status, attachment_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, classroomId, title, description || '', dueDate, maxScore || 10, allowLate ? 1 : 0, status || 'published', attachmentName || null).run();

  return c.json({
    assignment: { id, classroomId, title, description: description || '', dueDate, maxScore: maxScore || 10, allowLate: !!allowLate, status: status || 'published', attachmentName: attachmentName || null, createdAt: new Date().toISOString() },
  });
});

// ========== Submissions Routes ==========

app.get('/api/submissions', async (c) => {
  const user = c.get('user');
  const assignmentId = c.req.query('assignmentId');
  let submissions;

  if (assignmentId) {
    if (user.role === 'student') {
      submissions = await c.env.DB.prepare(
        'SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? ORDER BY submitted_at DESC'
      ).bind(assignmentId, user.id).all();
    } else {
      submissions = await c.env.DB.prepare(
        'SELECT * FROM submissions WHERE assignment_id = ? ORDER BY submitted_at DESC'
      ).bind(assignmentId).all();
    }
  } else {
    if (user.role === 'student') {
      submissions = await c.env.DB.prepare(
        'SELECT * FROM submissions WHERE student_id = ? ORDER BY submitted_at DESC'
      ).bind(user.id).all();
    } else {
      submissions = await c.env.DB.prepare('SELECT * FROM submissions ORDER BY submitted_at DESC').all();
    }
  }

  const results = [];
  for (const sub of submissions.results) {
    const files = await c.env.DB.prepare('SELECT * FROM submission_files WHERE submission_id = ?').bind(sub.id).all();
    const grade = await c.env.DB.prepare('SELECT * FROM grades WHERE submission_id = ?').bind(sub.id).first();
    results.push({
      id: sub.id,
      assignmentId: sub.assignment_id,
      studentId: sub.student_id,
      studentName: sub.student_name,
      studentNumber: sub.student_number,
      status: sub.status,
      submittedAt: sub.submitted_at,
      textResponse: sub.text_response,
      version: sub.version,
      files: files.results.map((f: any) => ({ id: f.id, fileName: f.file_name, fileSize: f.file_size, fileUrl: f.file_url, mimeType: f.mime_type })),
      grade: grade ? { id: grade.id, submissionId: grade.submission_id, graderId: grade.grader_id, score: grade.score, feedback: grade.feedback, gradedAt: grade.graded_at } : undefined,
    });
  }
  return c.json({ submissions: results });
});

app.post('/api/submissions', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { assignmentId, textResponse, fileName, fileSize } = body;
  if (!assignmentId) return c.json({ error: 'กรุณาระบุรหัสการบ้าน' }, 400);

  const assignment = await c.env.DB.prepare('SELECT * FROM assignments WHERE id = ?').bind(assignmentId).first();
  if (!assignment) return c.json({ error: 'ไม่พบการบ้านรายการนี้' }, 404);

  const now = new Date();
  const dueDate = new Date(assignment.due_date as string);
  const isLate = now.getTime() > dueDate.getTime();

  if (isLate && !(assignment.allow_late as number)) {
    return c.json({ error: 'หมดเขตส่งการบ้านแล้ว และไม่อนุญาตให้ส่งช้า' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(assignmentId, user.id).first();

  const status = isLate ? 'late' : 'submitted';

  if (existing) {
    const newVersion = (existing.version as number) + 1;
    await c.env.DB.prepare(
      `UPDATE submissions SET status = ?, submitted_at = datetime('now'), text_response = ?, version = ? WHERE id = ?`
    ).bind(status, textResponse || null, newVersion, existing.id).run();

    if (fileName) {
      const fileId = generateId('file');
      await c.env.DB.prepare(
        'INSERT INTO submission_files (id, submission_id, file_name, file_size, file_url, mime_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(fileId, existing.id, fileName, fileSize || 0, '#', fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream').run();
    }
    return c.json({ success: true, isLate, submissionId: existing.id });
  } else {
    const subId = generateId('sub');
    await c.env.DB.prepare(
      `INSERT INTO submissions (id, assignment_id, student_id, student_name, student_number, status, text_response, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(subId, assignmentId, user.id, user.name, user.student_number || null, status, textResponse || null).run();

    if (fileName) {
      const fileId = generateId('file');
      await c.env.DB.prepare(
        'INSERT INTO submission_files (id, submission_id, file_name, file_size, file_url, mime_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(fileId, subId, fileName, fileSize || 0, '#', fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream').run();
    }
    return c.json({ success: true, isLate, submissionId: subId });
  }
});

app.post('/api/submissions/:id/grade', async (c) => {
  const user = c.get('user');
  if (user.role === 'student') return c.json({ error: 'นักเรียนไม่สามารถให้คะแนนได้' }, 403);

  const submissionId = c.req.param('id');
  const body = await c.req.json();
  const { score, feedback } = body;
  if (score === undefined || score === null) return c.json({ error: 'กรุณาระบุคะแนน' }, 400);

  const submission = await c.env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(submissionId).first();
  if (!submission) return c.json({ error: 'ไม่พบรายการส่งงานนี้' }, 404);

  const assignment = await c.env.DB.prepare('SELECT * FROM assignments WHERE id = ?').bind(submission.assignment_id).first();
  if (assignment && score > (assignment.max_score as number)) {
    return c.json({ error: `คะแนนต้องไม่เกินคะแนนเต็ม (${assignment.max_score} คะแนน)` }, 400);
  }

  const existingGrade = await c.env.DB.prepare('SELECT * FROM grades WHERE submission_id = ?').bind(submissionId).first();
  if (existingGrade) {
    await c.env.DB.prepare(
      `UPDATE grades SET score = ?, feedback = ?, grader_id = ?, graded_at = datetime('now') WHERE id = ?`
    ).bind(score, feedback || '', user.id, existingGrade.id).run();
  } else {
    const gradeId = generateId('grd');
    await c.env.DB.prepare(
      'INSERT INTO grades (id, submission_id, grader_id, score, feedback) VALUES (?, ?, ?, ?, ?)'
    ).bind(gradeId, submissionId, user.id, score, feedback || '').run();
  }

  await c.env.DB.prepare("UPDATE submissions SET status = 'graded' WHERE id = ?").bind(submissionId).run();
  return c.json({ success: true });
});

// ========== Users Routes ==========

app.get('/api/users', async (c) => {
  const user = c.get('user');
  let users;
  if (user.role === 'admin') {
    users = await c.env.DB.prepare('SELECT id, email, name, role, avatar, student_number FROM users ORDER BY created_at DESC').all();
  } else {
    users = await c.env.DB.prepare(
      `SELECT DISTINCT u.id, u.email, u.name, u.role, u.avatar, u.student_number
       FROM users u
       INNER JOIN classroom_members cm ON u.id = cm.student_id
       INNER JOIN classrooms c ON cm.classroom_id = c.id
       WHERE c.teacher_id = ?
       ORDER BY u.name`
    ).bind(user.id).all();
  }

  const results = users.results.map((u: any) => ({
    id: u.id, email: u.email, name: u.name, role: u.role, avatar: u.avatar, studentNumber: u.student_number,
  }));
  return c.json({ users: results });
});

app.patch('/api/users/:id/role', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, 403);

  const userId = c.req.param('id');
  const body = await c.req.json();
  const { role } = body;
  if (!['teacher', 'student', 'admin'].includes(role)) return c.json({ error: 'บทบาทไม่ถูกต้อง' }, 400);

  await c.env.DB.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(role, userId).run();
  return c.json({ success: true });
});

// PATCH /api/users/me/role - User can choose/switch their role (teacher <-> student)
app.patch('/api/users/me/role', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { role } = body;

  if (!['teacher', 'student'].includes(role) && user.role !== 'admin') {
    return c.json({ error: 'บทบาทไม่ถูกต้อง (ต้องเป็น teacher หรือ student)' }, 400);
  }

  // Admin can switch to admin, teacher, or student
  if (user.role === 'admin' && !['teacher', 'student', 'admin'].includes(role)) {
    return c.json({ error: 'บทบาทไม่ถูกต้อง' }, 400);
  }

  await c.env.DB.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(role, user.id).run();

  const updatedUser: any = await c.env.DB.prepare('SELECT id, email, name, role, avatar, student_number FROM users WHERE id = ?')
    .bind(user.id).first();

  return c.json({
    success: true,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      studentNumber: updatedUser.student_number,
    },
  });
});

// Helper for educational fallback response
function generateSmartEducationalReply(prompt: string, role: string, context?: any): string {
  const q = prompt.toLowerCase();
  const isTeacher = role === 'teacher' || role === 'admin';

  if (isTeacher) {
    if (q.includes('เกณฑ์') || q.includes('rubric') || q.includes('คะแนน')) {
      return `📋 **แนวทางการตั้งเกณฑ์การให้คะแนน (Rubric) แนะนำ:**

1. **ความถูกต้องของเนื้อหา (40%)**: คำตอบถูกต้อง ครบถ้วนตามโจทย์ มีการอ้างอิงหรือเหตุผลที่ชัดเจน
2. **กระบวนการคิดและวิธีทำ (30%)**: แสดงขั้นตอนการคิดอย่างเป็นระบบ และเข้าใจหลักการ
3. **ความเรียบร้อยและการจัดรูปแบบ (15%)**: การจัดวางสะอาด ชัดเจน ลายมือหรือฟอนต์อ่านง่าย
4. **ความตรงต่อเวลา (15%)**: ส่งตามกำหนดเวลาที่กำหนดไว้

💡 *คำแนะนำ:* คุณครูสามารถปรับสัดส่วนคะแนนตามความยากง่ายของใบงานนี้ได้เลยครับ`;
    }

    if (q.includes('โจทย์') || q.includes('การบ้าน') || q.includes('สร้าง')) {
      return `✍️ **ไอเดียการตั้งโจทย์การบ้านที่กระตุ้นการคิด:**

1. **เชื่อมโยงกับชีวิตจริง**: เช่น "ให้นักเรียนเลือกสินค้าในชีวิตประจำวัน 1 ชิ้น แล้ววิเคราะห์ต้นทุน/กำไร"
2. **มีตัวเลือกให้นักเรียนแสดงออก**: เช่น อนุญาตให้ส่งเป็นไฟล์สรุป แผนผังความคิด (Mind Map) หรือวิดีโอสั้น
3. **คำถามปลายเปิด**: "ถ้าหากเกิดสถานการณ์... นักเรียนจะมีแนวทางแก้ไขปัญหาอย่างไร เพราะเหตุใด?"

🎯 คุณครูสามารถกดปุ่ม **"+ มอบหมายการบ้านใหม่"** ที่หน้าจอเพื่อตั้งโจทย์ได้ทันทีครับ!`;
    }

    return `👨‍🏫 **สวัสดีครับคุณครู! AI ผู้ช่วยยินดีให้บริการครับ**

ผมสามารถช่วยคุณครูได้ดังนี้ครับ:
- 📝 **ช่วยคิดโจทย์การบ้าน**: ระบุวิชาและระดับชั้นที่ต้องการได้เลย
- 📊 **ออกแบบเกณฑ์ให้คะแนน (Rubric)**: ช่วยแบ่งคะแนนตามความสามารถ
- 💬 **ร่างข้อความ Feedback**: แนะนำคำชมและข้อปรับปรุงเชิงบวกสำหรับตรวจงานนักเรียน

พิมพ์คำถามหรือเนื้อหาที่ต้องการให้ช่วยได้เลยครับ! 😊`;
  }

  // Student mode
  if (q.includes('คณิต') || q.includes('บวก') || q.includes('ลบ') || q.includes('คูณ') || q.includes('หาร') || q.includes('สมการ')) {
    return `🔢 **เคล็ดลับการแก้โจทย์คณิตศาสตร์:**

1. **อ่านโจทย์และแยกสิ่งที่โจทย์บอก & สิ่งที่โจทย์ถาม**
2. **กำหนดตัวแปรหรือวาดรูปจำลอง** เพื่อให้เห็นภาพรวม
3. **เขียนสูตรและขั้นตอนทีละบรรทัด** เพื่อป้องกันการคิดเลขตกหล่น
4. **ตรวจทานคำตอบย้อนกลับ** โดยลองแทนค่าลงในสมการเดิม

💡 *พิมพ์โจทย์มาให้ผมช่วยอธิบายขั้นตอนวิธีคิดได้เลยนะครับ!*`;
  }

  if (q.includes('สรุป') || q.includes('อ่าน') || q.includes('จำ')) {
    return `📖 **เทคนิคการสรุปบทเรียนและจำแม่น:**

1. **วิธี Feynman Technique**: ลองอธิบายเนื้อหาที่อ่านให้เข้าใจในภาษาของตัวเอง เสมือนกำลังสอนเพื่อน
2. **ใช้ Mind Map หรือตารางเปรียบเทียบ**: ช่วยให้เห็นความเชื่อมโยงของแต่ละหัวข้อ
3. **ทบทวนแบบ Active Recall**: ปิดหนังสือแล้วลองเขียนหรือพูดสิ่งที่จำได้ออกมาทันที

ส่งเนื้อหาหรือหัวข้อที่อยากให้ผมช่วยสรุปมาได้เลยนะครับ! 🌟`;
  }

  return `🎓 **สวัสดีครับ! พี่ AI ผู้ช่วยการบ้านยินดีต้อนรับครับ**

น้องๆ สามารถปรึกษาพี่ AI ได้ทุกเรื่องเลยนะ:
- 💡 **อธิบายโจทย์ยากๆ**: ไม่ว่าจะเป็นคณิตศาสตร์, วิทยาศาสตร์, ภาษาไทย, ภาษาอังกฤษ
- ✍️ **ตรวจทานเนื้อหา**: ช่วยดูแกรมม่า หรือเรียบเรียงประโยค
- 📚 **สรุปเนื้อหาบทเรียน**: ทำความเข้าใจเนื้อหายากๆ ให้กลายเป็นเรื่องง่าย

ลองพิมพ์คำถามหรือโจทย์การบ้านมาได้เลยครับ! สู้ๆ นะครับ ✌️`;
}

// Helper to get today's date in GMT+7 (Bangkok)
function getTodayDateString(): string {
  const bangkokTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return bangkokTime.toISOString().slice(0, 10);
}

// GET /api/chat/quota - Get today's remaining quota for current user
app.get('/api/chat/quota', async (c) => {
  const user = c.get('user');
  const today = getTodayDateString();
  const DAILY_LIMIT = 50;

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        usage_date TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, usage_date)
      )
    `).run();

    const usageRow: any = await c.env.DB.prepare(
      'SELECT count FROM ai_usage WHERE user_id = ? AND usage_date = ?'
    ).bind(user.id, today).first();

    const usedToday = usageRow?.count || 0;
    return c.json({
      limit: DAILY_LIMIT,
      usedToday,
      remaining: Math.max(0, DAILY_LIMIT - usedToday),
      hasServerKey: !!c.env.GEMINI_API_KEY,
    });
  } catch (e: any) {
    return c.json({
      limit: DAILY_LIMIT,
      usedToday: 0,
      remaining: DAILY_LIMIT,
      hasServerKey: !!c.env.GEMINI_API_KEY,
    });
  }
});

// POST /api/chat - AI Assistant endpoint using Google AI Studio (Gemini API) with 50/day quota
app.post('/api/chat', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { messages, context, apiKey: clientApiKey } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: 'ข้อความไม่ถูกต้อง' }, 400);
  }

  const today = getTodayDateString();
  const DAILY_LIMIT = 50;

  // 1. Ensure ai_usage table exists
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        usage_date TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, usage_date)
      )
    `).run();
  } catch (e) {
    console.error('Error creating ai_usage table:', e);
  }

  // 2. Check 50 queries/day quota
  const usageRow: any = await c.env.DB.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND usage_date = ?'
  ).bind(user.id, today).first();

  const usedToday = usageRow?.count || 0;

  if (usedToday >= DAILY_LIMIT) {
    return c.json({
      reply: `⚠️ **คุณได้ใช้งานโควตาถาม AI ครบ ${DAILY_LIMIT} ครั้งสำหรับวันนี้แล้วครับ**\n\n📌 โควตาฟรีจาก Google AI Studio (50 ครั้ง/วัน) จะรีเซ็ตอัตโนมัติในวันพรุ่งนี้เวลา 00:00 น.\n\nพรุ่งนี้กลับมาถามและปรึกษาโจทย์การบ้านใหม่ได้เลยนะครับ! 🌟`,
      limit: DAILY_LIMIT,
      usedToday,
      remaining: 0,
      quotaExceeded: true,
    });
  }

  // 3. Resolve Gemini API Key (client provided, DB settings, or server env)
  let apiKey = (clientApiKey || c.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    try {
      await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`).run();
      const dbKey: any = await c.env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('gemini_api_key').first();
      if (dbKey?.value) apiKey = dbKey.value.trim();
    } catch (e) {
      console.warn('Could not read settings table:', e);
    }
  }

  // If a valid key was provided by client, also persist to settings table as shared fallback
  if (clientApiKey && clientApiKey.trim()) {
    try {
      await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`).run();
      await c.env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).bind('gemini_api_key', clientApiKey.trim()).run();
    } catch (e) {
      console.warn('Could not save shared key:', e);
    }
  }

  const roleName = user.role === 'teacher' ? 'คุณครู' : user.role === 'admin' ? 'ผู้ดูแลระบบ/คุณครู' : 'นักเรียน/นักศึกษา';
  const systemPrompt = `คุณคือ "AI ผู้ช่วยการบ้าน (Homework AI Assistant)" ขับเคลื่อนด้วยโมเดล Gemini จาก Google AI Studio ประจำระบบ Homework Tracker
- ผู้ใช้งาน: ${user.name || 'คุณ'} บทบาท: "${roleName}"
${context?.classroom ? `- วิชาเรียน: ${context.classroom}` : ''}
${context?.assignment ? `- การบ้านปัจจุบัน: ${context.assignment}` : ''}

หน้าที่และแนวทางของคุณ:
1. หากเป็นนักเรียน/นักศึกษา: ช่วยอธิบายวิธีคิด คอนเซปต์ ชี้แนะทีละขั้นตอนอย่างใจเย็น ให้กำลังใจ (ไม่เฉลยคำตอบตรงๆ แบบสุ่มสี่สุ่มห้า แต่สอนให้เด็กคิดเป็น)
2. หากเป็นคุณครู: ช่วยตั้งโจทย์การบ้าน ออกแบบเกณฑ์คะแนน (Rubric) แนะนำกิจกรรม ช่วยคิดคำติชมและคำแนะนำ (Feedback)
3. ตอบเป็นภาษาไทยด้วยน้ำเสียงสุภาพ สดใส เข้าใจง่าย จัดรูปแบบด้วย Markdown (หัวข้อ, รายการ, ตัวหนา) ให้อ่านสบายตา`;

  // 4. If no API key provided, prompt user to add Google AI Studio API key
  if (!apiKey) {
    return c.json({
      reply: `🔑 **ยังไม่ได้ตั้งค่า Google AI Studio API Key ครับ**\n\nระบบรองรับการถามตอบฟรี 50 ครั้ง/วัน ด้วย Google Gemini API\n\n**วิธีรับ API Key ฟรี (ใช้เวลาไม่ถึง 1 นาที):**\n1. เข้าเว็บไซต์ [Google AI Studio](https://aistudio.google.com/app/apikey)\n2. กดปุ่ม **"Create API Key"**\n3. คัดลอก API Key แล้วกดปุ่ม **⚙️ ตั้งค่า API Key** ที่มุมขวาบนของหน้าต่างแชทนี้ เพื่อวางและบันทึกได้ทันทีครับ!`,
      limit: DAILY_LIMIT,
      usedToday,
      remaining: Math.max(0, DAILY_LIMIT - usedToday),
      needsKey: true,
    });
  }

  // 5. Call Google Gemini API (try gemini-3.8-flash, gemini-3.5-flash, gemini-2.5-flash, gemini-flash-latest)
  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ];

  try {
    // Format conversation history for Gemini API (user & model)
    const geminiContents = messages.slice(-10).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1200,
      },
    };

    let replyText = '';
    let lastErrorText = '';

    for (const model of candidateModels) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
          }
        );

        if (geminiRes.ok) {
          const data: any = await geminiRes.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && typeof text === 'string' && text.trim().length > 0) {
            replyText = text.trim();
            break;
          }
        } else {
          lastErrorText = await geminiRes.text();
          console.warn(`Model ${model} failed:`, geminiRes.status, lastErrorText);
          if (lastErrorText.includes('API_KEY_INVALID') || geminiRes.status === 400 && lastErrorText.includes('API key not valid')) {
            return c.json({
              reply: `⚠️ **Google AI Studio API Key ไม่ถูกต้อง หรือหมดอายุ**\n\nกรุณาตรวจสอบและตั้งค่าใหม่อีกครั้งที่ปุ่ม **⚙️ ตั้งค่า API Key** ที่มุมขวาบนของหน้าต่างแชทนี้ครับ (หรือรับคีย์ใหม่ได้ฟรีที่ [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey))`,
              limit: DAILY_LIMIT,
              usedToday,
              remaining: Math.max(0, DAILY_LIMIT - usedToday),
              invalidKey: true,
            });
          }
        }
      } catch (errLoop: any) {
        console.warn(`Model ${model} fetch exception:`, errLoop);
      }
    }

    if (replyText) {
      // Increment quota usage in DB
      const newCount = usedToday + 1;
      await c.env.DB.prepare(`
        INSERT INTO ai_usage (id, user_id, usage_date, count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + 1, updated_at = datetime('now')
      `).bind(`${user.id}_${today}`, user.id, today).run();

      return c.json({
        reply: replyText,
        limit: DAILY_LIMIT,
        usedToday: newCount,
        remaining: Math.max(0, DAILY_LIMIT - newCount),
      });
    }
  } catch (err: any) {
    console.error('Gemini general exception:', err);
  }

  // 6. If Gemini had temporary issue or offline, fallback to smart helper without deducting quota
  const lastUserMsg = messages[messages.length - 1]?.content || '';
  const fallback = generateSmartEducationalReply(lastUserMsg, user.role, context);
  return c.json({
    reply: fallback,
    limit: DAILY_LIMIT,
    usedToday,
    remaining: Math.max(0, DAILY_LIMIT - usedToday),
  });
});

// ========== Fallback to static assets ==========
app.all('*', async (c) => {
  try {
    return await c.env.ASSETS.fetch(c.req.raw);
  } catch {
    return await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url), c.req.raw));
  }
});

export default app;
