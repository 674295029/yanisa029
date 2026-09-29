import React, { useState, useEffect } from 'react';
import { User, Classroom, Assignment, Submission } from './types';
import { StorageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { CreateAssignmentModal } from './components/CreateAssignmentModal';
import { ClassroomModal } from './components/ClassroomModal';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [activeClassroom, setActiveClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Modals state
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [classroomModalMode, setClassroomModalMode] = useState<'create' | 'join' | null>(null);

  // Toast Notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Load Initial State
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedUsers = StorageService.getUsers();
    const loadedUser = StorageService.getActiveUser();
    const loadedClasses = StorageService.getClassrooms();
    const loadedClass = StorageService.getActiveClassroom();
    const loadedAssignments = StorageService.getAssignments();
    const loadedSubmissions = StorageService.getSubmissions();

    setUsers(loadedUsers);
    setActiveUser(loadedUser);
    setClassrooms(loadedClasses);
    setActiveClassroom(loadedClass);
    setAssignments(loadedAssignments);
    setSubmissions(loadedSubmissions);
  };

  // Switch User
  const handleSelectUser = (user: User) => {
    setActiveUser(user);
    StorageService.setActiveUser(user);
    showToast(`สลับบทบาทเป็น: ${user.name} (${user.role === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'})`, 'info');
  };

  // Switch Classroom
  const handleSelectClassroom = (classroom: Classroom) => {
    setActiveClassroom(classroom);
    StorageService.setActiveClassroom(classroom.id);
  };

  // Create Assignment
  const handleCreateAssignment = (newAssignment: Omit<Assignment, 'id' | 'createdAt'>) => {
    const created = StorageService.createAssignment(newAssignment);
    setAssignments(StorageService.getAssignments());
    showToast(`มอบหมาย "${created.title}" เรียบร้อยแล้ว`, 'success');
  };

  // Submit Homework
  const handleSubmitHomework = (payload: {
    assignmentId: string;
    studentId: string;
    studentName: string;
    studentNumber?: string;
    textResponse?: string;
    fileName?: string;
    fileSize?: number;
  }) => {
    const result = StorageService.submitHomework(payload);
    if (result.success) {
      setSubmissions(StorageService.getSubmissions());
      if (result.isLate) {
        showToast('ส่งการบ้านสำเร็จ (ประทับเวลา: ส่งช้า)', 'info');
      } else {
        showToast('ส่งการบ้านสำเร็จตรงเวลา เรียบร้อยแล้ว!', 'success');
      }
    } else {
      showToast(result.error || 'ไม่สามารถส่งการบ้านได้', 'error');
    }
  };

  // Grade Submission
  const handleGradeSubmission = (submissionId: string, score: number, feedback: string) => {
    if (!activeUser) return;
    const result = StorageService.gradeSubmission(submissionId, activeUser.id, score, feedback);
    if ('error' in result) {
      showToast(result.error, 'error');
    } else {
      setSubmissions(StorageService.getSubmissions());
      showToast(`บันทึกคะแนน ${score} คะแนนเรียบร้อยแล้ว`, 'success');
    }
  };

  // Create Classroom
  const handleCreateClassroom = (cls: Omit<Classroom, 'id' | 'memberStudentIds'>) => {
    const created = StorageService.createClassroom(cls);
    const updated = StorageService.getClassrooms();
    setClassrooms(updated);
    setActiveClassroom(created);
    showToast(`สร้างห้องเรียน "${created.title}" รหัส: ${created.classCode} สำเร็จ`, 'success');
  };

  // Join Classroom
  const handleJoinClassroom = (classCode: string) => {
    if (!activeUser) return;
    const result = StorageService.joinClassroom(classCode, activeUser.id);
    if ('error' in result) {
      showToast(result.error, 'error');
    } else {
      setClassrooms(StorageService.getClassrooms());
      setActiveClassroom(result);
      showToast(`เข้าร่วมห้องเรียน "${result.title}" สำเร็จ`, 'success');
    }
  };

  // Reset Mock Data
  const handleResetData = () => {
    if (window.confirm('คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      StorageService.resetData();
      loadData();
      showToast('รีเซ็ตข้อมูลเริ่มต้นเรียบร้อยแล้ว', 'info');
    }
  };

  if (!activeUser) {
    return <div className="p-8 text-center text-slate-500">กำลังโหลดระบบ...</div>;
  }

  // Filter assignments for the active classroom
  const currentClassAssignments = assignments.filter(
    (a) => a.classroomId === activeClassroom?.id
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce-short">
          <div className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-sm font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500 shadow-rose-200'
              : 'bg-slate-900 text-white border-slate-800 shadow-slate-300'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        users={users}
        activeUser={activeUser}
        onSelectUser={handleSelectUser}
        classrooms={classrooms}
        activeClassroom={activeClassroom}
        onSelectClassroom={handleSelectClassroom}
        onOpenCreateClass={() => setClassroomModalMode('create')}
        onOpenJoinClass={() => setClassroomModalMode('join')}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {activeClassroom ? (
          activeUser.role === 'teacher' ? (
            <TeacherDashboard
              classroom={activeClassroom}
              assignments={currentClassAssignments}
              submissions={submissions}
              students={users.filter((u) => u.role === 'student')}
              onOpenCreateAssignment={() => setIsCreateAssignmentOpen(true)}
              onGradeSubmission={handleGradeSubmission}
            />
          ) : (
            <StudentDashboard
              student={activeUser}
              classrooms={classrooms}
              assignments={currentClassAssignments}
              submissions={submissions}
              onSubmitHomework={handleSubmitHomework}
            />
          )
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-2xs max-w-md mx-auto my-12">
            <h3 className="font-bold text-lg text-slate-800 mb-2">ยังไม่มีห้องเรียน</h3>
            <p className="text-sm text-slate-500 mb-4">
              {activeUser.role === 'teacher'
                ? 'กรุณาสร้างห้องเรียนแรกเพื่อเริ่มต้นมอบหมายการบ้าน'
                : 'กรุณากรอกรหัส Class Code เพื่อเข้าร่วมห้องเรียน'}
            </p>
            <button
              onClick={() => setClassroomModalMode(activeUser.role === 'teacher' ? 'create' : 'join')}
              className="px-5 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-xl"
            >
              {activeUser.role === 'teacher' ? 'สร้างห้องเรียน' : 'เข้าร่วมห้องเรียน'}
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {activeClassroom && (
        <CreateAssignmentModal
          isOpen={isCreateAssignmentOpen}
          onClose={() => setIsCreateAssignmentOpen(false)}
          classroomId={activeClassroom.id}
          onCreate={handleCreateAssignment}
        />
      )}

      <ClassroomModal
        isOpen={classroomModalMode !== null}
        onClose={() => setClassroomModalMode(null)}
        mode={classroomModalMode || 'create'}
        teacherId={activeUser.id}
        teacherName={activeUser.name}
        studentId={activeUser.id}
        onCreateClass={handleCreateClassroom}
        onJoinClass={handleJoinClassroom}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        ระบบเช็คและตรวจการบ้านออนไลน์ &copy; 2026 — พัฒนาตาม SDLC (Requirements, System Design, Database Design)
      </footer>

    </div>
  );
};

export default App;
