export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  studentNumber?: string;
}

export interface Classroom {
  id: string;
  title: string;
  subjectCode: string;
  description: string;
  classCode: string;
  teacherId: string;
  teacherName: string;
  academicYear: string;
  semester: number;
  memberStudentIds: string[];
}

export type AssignmentStatus = 'draft' | 'published' | 'closed';

export interface Assignment {
  id: string;
  classroomId: string;
  title: string;
  description: string;
  dueDate: string; // ISO 8601 string
  maxScore: number;
  allowLate: boolean;
  status: AssignmentStatus;
  attachmentName?: string;
  createdAt: string;
}

export type SubmissionStatus = 'submitted' | 'late' | 'graded' | 'resubmitted';

export interface SubmissionFile {
  id: string;
  fileName: string;
  fileSize: number; // in bytes
  fileUrl: string;
  mimeType: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentNumber?: string;
  status: SubmissionStatus;
  submittedAt: string; // ISO 8601 string
  textResponse?: string;
  files: SubmissionFile[];
  version: number;
  grade?: Grade;
}

export interface Grade {
  id: string;
  submissionId: string;
  graderId: string;
  score: number;
  feedback: string;
  gradedAt: string;
}

export interface ClassroomSummary {
  totalStudents: number;
  submittedCount: number;
  lateCount: number;
  gradedCount: number;
  missingCount: number;
}
