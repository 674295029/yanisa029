import { User, Classroom, Assignment, Submission, Grade } from '../types';
import { initialUsers, initialClassrooms, initialAssignments, initialSubmissions } from '../data/mockData';

const STORAGE_KEYS = {
  USERS: 'hw_users_v1',
  CLASSROOMS: 'hw_classrooms_v1',
  ASSIGNMENTS: 'hw_assignments_v1',
  SUBMISSIONS: 'hw_submissions_v1',
  ACTIVE_USER: 'hw_active_user_v1',
  ACTIVE_CLASS: 'hw_active_class_v1',
};

export const StorageService = {
  getUsers(): User[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
      return initialUsers;
    }
    return JSON.parse(data);
  },

  getActiveUser(): User {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    if (data) return JSON.parse(data);
    const users = this.getUsers();
    const defaultUser = users[0]; // Default to teacher
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(defaultUser));
    return defaultUser;
  },

  setActiveUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));
  },

  getClassrooms(): Classroom[] {
    const data = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(initialClassrooms));
      return initialClassrooms;
    }
    return JSON.parse(data);
  },

  getActiveClassroom(): Classroom | null {
    const classrooms = this.getClassrooms();
    const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_CLASS);
    if (savedId) {
      const found = classrooms.find((c) => c.id === savedId);
      if (found) return found;
    }
    return classrooms[0] || null;
  },

  setActiveClassroom(classroomId: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CLASS, classroomId);
  },

  createClassroom(newClass: Omit<Classroom, 'id' | 'memberStudentIds'>): Classroom {
    const classrooms = this.getClassrooms();
    const created: Classroom = {
      ...newClass,
      id: `cls-${Date.now()}`,
      memberStudentIds: ['student-1', 'student-2', 'student-3', 'student-4'],
    };
    classrooms.push(created);
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classrooms));
    return created;
  },

  joinClassroom(classCode: string, studentId: string): Classroom | { error: string } {
    const classrooms = this.getClassrooms();
    const classroom = classrooms.find((c) => c.classCode.toUpperCase() === classCode.trim().toUpperCase());
    if (!classroom) {
      return { error: 'ไม่พบรหัสห้องเรียนนี้ กรุณาตรวจสอบรหัสอีกครั้ง' };
    }
    if (classroom.memberStudentIds.includes(studentId)) {
      return { error: 'คุณได้เข้าร่วมห้องเรียนนี้ไปแล้ว' };
    }
    classroom.memberStudentIds.push(studentId);
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classrooms));
    return classroom;
  },

  getAssignments(classroomId?: string): Assignment[] {
    const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    const list: Assignment[] = data ? JSON.parse(data) : initialAssignments;
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(initialAssignments));
    }
    if (classroomId) {
      return list.filter((a) => a.classroomId === classroomId);
    }
    return list;
  },

  createAssignment(newAssignment: Omit<Assignment, 'id' | 'createdAt'>): Assignment {
    const list = this.getAssignments();
    const created: Assignment = {
      ...newAssignment,
      id: `asg-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    list.unshift(created);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(list));
    return created;
  },

  getSubmissions(assignmentId?: string): Submission[] {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    const list: Submission[] = data ? JSON.parse(data) : initialSubmissions;
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(initialSubmissions));
    }
    if (assignmentId) {
      return list.filter((s) => s.assignmentId === assignmentId);
    }
    return list;
  },

  submitHomework(payload: {
    assignmentId: string;
    studentId: string;
    studentName: string;
    studentNumber?: string;
    textResponse?: string;
    fileName?: string;
    fileSize?: number;
  }): { success: boolean; submission: Submission; isLate: boolean; error?: string } {
    const assignments = this.getAssignments();
    const assignment = assignments.find((a) => a.id === payload.assignmentId);
    if (!assignment) {
      return { success: false, submission: {} as Submission, isLate: false, error: 'ไม่พบการบ้านรายการนี้' };
    }

    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    const isLate = now.getTime() > dueDate.getTime();

    if (isLate && !assignment.allowLate) {
      return { success: false, submission: {} as Submission, isLate: true, error: 'หมดเขตส่งการบ้านแล้ว และไม่อนุญาตให้ส่งช้า' };
    }

    const submissions = this.getSubmissions();
    const existingIndex = submissions.findIndex(
      (s) => s.assignmentId === payload.assignmentId && s.studentId === payload.studentId
    );

    const submissionFile = payload.fileName
      ? [
          {
            id: `file-${Date.now()}`,
            fileName: payload.fileName,
            fileSize: payload.fileSize || 1024000,
            fileUrl: '#',
            mimeType: payload.fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png',
          },
        ]
      : [];

    let submission: Submission;

    if (existingIndex >= 0) {
      // Resubmit
      const existing = submissions[existingIndex];
      submission = {
        ...existing,
        status: isLate ? 'late' : 'submitted',
        submittedAt: now.toISOString(),
        textResponse: payload.textResponse,
        files: submissionFile.length > 0 ? submissionFile : existing.files,
        version: existing.version + 1,
      };
      submissions[existingIndex] = submission;
    } else {
      submission = {
        id: `sub-${Date.now()}`,
        assignmentId: payload.assignmentId,
        studentId: payload.studentId,
        studentName: payload.studentName,
        studentNumber: payload.studentNumber,
        status: isLate ? 'late' : 'submitted',
        submittedAt: now.toISOString(),
        textResponse: payload.textResponse,
        files: submissionFile,
        version: 1,
      };
      submissions.push(submission);
    }

    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    return { success: true, submission, isLate };
  },

  gradeSubmission(submissionId: string, graderId: string, score: number, feedback: string): Submission | { error: string } {
    const submissions = this.getSubmissions();
    const index = submissions.findIndex((s) => s.id === submissionId);
    if (index === -1) {
      return { error: 'ไม่พบรายการส่งงานนี้' };
    }

    const sub = submissions[index];
    const assignments = this.getAssignments();
    const assignment = assignments.find((a) => a.id === sub.assignmentId);
    if (assignment && score > assignment.maxScore) {
      return { error: `คะแนนต้องไม่เกินคะแนนเต็ม (${assignment.maxScore} คะแนน)` };
    }

    const grade: Grade = {
      id: `grd-${Date.now()}`,
      submissionId,
      graderId,
      score,
      feedback,
      gradedAt: new Date().toISOString(),
    };

    sub.grade = grade;
    sub.status = 'graded';
    submissions[index] = sub;
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    return sub;
  },

  resetData(): void {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CLASSROOMS);
    localStorage.removeItem(STORAGE_KEYS.ASSIGNMENTS);
    localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CLASS);
  }
};
