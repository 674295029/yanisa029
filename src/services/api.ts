import { User, Classroom, Assignment, Submission } from '../types';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const sessionId = localStorage.getItem('hw_session');
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { 'Authorization': `Bearer ${sessionId}` } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'เกิดข้อผิดพลาด' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const ApiService = {
  // ========== Auth ==========
  async checkAuth(): Promise<{ authenticated: boolean; user?: User }> {
    return fetchJSON('/auth/status');
  },

  async getCurrentUser(): Promise<User> {
    const data = await fetchJSON<{ user: User }>('/auth/me');
    return data.user;
  },

  getLoginUrl(): string {
    return `${API_BASE}/auth/google`;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('hw_session');
    await fetchJSON('/auth/logout', { method: 'POST' });
  },

  // ========== Classrooms ==========
  async getClassrooms(): Promise<Classroom[]> {
    const data = await fetchJSON<{ classrooms: Classroom[] }>('/classrooms');
    return data.classrooms;
  },

  async createClassroom(cls: {
    title: string;
    subjectCode: string;
    description: string;
    academicYear: string;
    semester: number;
  }): Promise<Classroom> {
    const data = await fetchJSON<{ classroom: Classroom }>('/classrooms', {
      method: 'POST',
      body: JSON.stringify(cls),
    });
    return data.classroom;
  },

  async joinClassroom(classCode: string): Promise<Classroom> {
    const data = await fetchJSON<{ classroom: Classroom }>('/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ classCode }),
    });
    return data.classroom;
  },

  async getClassroomStudents(classroomId: string): Promise<User[]> {
    const data = await fetchJSON<{ students: User[] }>(`/classrooms/${classroomId}/students`);
    return data.students;
  },

  // ========== Assignments ==========
  async getAssignments(classroomId?: string): Promise<Assignment[]> {
    const query = classroomId ? `?classroomId=${classroomId}` : '';
    const data = await fetchJSON<{ assignments: Assignment[] }>(`/assignments${query}`);
    return data.assignments;
  },

  async createAssignment(assignment: {
    classroomId: string;
    title: string;
    description: string;
    dueDate: string;
    maxScore: number;
    allowLate: boolean;
    status: string;
    attachmentName?: string;
  }): Promise<Assignment> {
    const data = await fetchJSON<{ assignment: Assignment }>('/assignments', {
      method: 'POST',
      body: JSON.stringify(assignment),
    });
    return data.assignment;
  },

  // ========== Submissions ==========
  async getSubmissions(assignmentId?: string): Promise<Submission[]> {
    const query = assignmentId ? `?assignmentId=${assignmentId}` : '';
    const data = await fetchJSON<{ submissions: Submission[] }>(`/submissions${query}`);
    return data.submissions;
  },

  async submitHomework(payload: {
    assignmentId: string;
    textResponse?: string;
    fileName?: string;
    fileSize?: number;
  }): Promise<{ success: boolean; isLate: boolean; submissionId: string }> {
    return fetchJSON('/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async gradeSubmission(
    submissionId: string,
    score: number,
    feedback: string
  ): Promise<{ success: boolean }> {
    return fetchJSON(`/submissions/${submissionId}/grade`, {
      method: 'POST',
      body: JSON.stringify({ score, feedback }),
    });
  },

  // ========== Users ==========
  async getUsers(): Promise<User[]> {
    const data = await fetchJSON<{ users: User[] }>('/users');
    return data.users;
  },

  async updateUserRole(userId: string, role: string): Promise<void> {
    await fetchJSON(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async switchRole(role: 'teacher' | 'student'): Promise<{ success: boolean; user: User }> {
    return fetchJSON<{ success: boolean; user: User }>('/users/me/role', {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  // ========== AI Chatbot ==========
  async getChatQuota(): Promise<{
    limit: number;
    usedToday: number;
    remaining: number;
    hasServerKey: boolean;
  }> {
    return fetchJSON('/chat/quota');
  },

  async sendChatMessage(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    context?: { classroom?: string; assignment?: string },
    apiKey?: string
  ): Promise<{
    reply: string;
    limit?: number;
    usedToday?: number;
    remaining?: number;
    needsKey?: boolean;
    invalidKey?: boolean;
    quotaExceeded?: boolean;
  }> {
    return fetchJSON('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, context, apiKey }),
    });
  },
};


