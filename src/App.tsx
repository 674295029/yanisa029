import React, { useState, useEffect } from 'react';
import { User, Classroom, Assignment, Submission } from './types';
import { ApiService } from './services/api';
import { Navbar } from './components/Navbar';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { CreateAssignmentModal } from './components/CreateAssignmentModal';
import { ClassroomModal } from './components/ClassroomModal';
import { ChatbotWidget } from './components/ChatbotWidget';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const GOOGLE_LOGIN_URL = '/api/auth/google';

export const App: React.FC = () => {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [activeClassroom, setActiveClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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

  useEffect(() => {
    // Check URL parameters for auth errors from Google OAuth
    const params = new URLSearchParams(window.location.search);
    const error = params.get('auth_error');
    const detail = params.get('detail');
    const msg = params.get('msg');
    if (error) {
      let errText = '';
      if (error === 'denied' || error === 'access_denied') errText = 'คุณปฏิเสธการเข้าสู่ระบบ หรือยกเลิก';
      else if (error === 'token_failed') errText = `Token exchange ล้มเหลว: ${detail || ''}`;
      else if (error === 'profile_failed') errText = 'ไม่สามารถดึงข้อมูลโปรไฟล์จาก Google ได้';
      else if (error === 'server_error') errText = `Server error: ${msg || ''}`;
      else errText = `เกิดข้อผิดพลาด: ${error} ${detail || msg || ''}`;
      setAuthError(errText);
      // Don't clean URL yet - keep it for debugging
    }

    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    setIsLoading(true);
    try {
      const auth = await ApiService.checkAuth();
      if (auth.authenticated && auth.user) {
        setActiveUser(auth.user);
        await loadInitialData(auth.user);
      } else {
        setActiveUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInitialData = async (user: User) => {
    try {
      const loadedClasses = await ApiService.getClassrooms();
      setClassrooms(loadedClasses);
      
      if (loadedClasses.length > 0) {
        setActiveClassroom(loadedClasses[0]);
        await loadClassroomData(loadedClasses[0].id);
      }
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถโหลดข้อมูลห้องเรียนได้', 'error');
    }
  };

  const loadClassroomData = async (classroomId: string) => {
    try {
      const [loadedAssignments, loadedSubmissions, loadedStudents] = await Promise.all([
        ApiService.getAssignments(classroomId),
        ApiService.getSubmissions(),
        ApiService.getClassroomStudents(classroomId).catch(() => []),
      ]);
      setAssignments(loadedAssignments);
      setSubmissions(loadedSubmissions);
      setStudents(loadedStudents);
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถโหลดข้อมูลการบ้านได้', 'error');
    }
  };

  const handleLogin = () => {
    window.location.href = ApiService.getLoginUrl();
  };

  const handleLogout = async () => {
    try {
      await ApiService.logout();
      setActiveUser(null);
      setClassrooms([]);
      setActiveClassroom(null);
      setAssignments([]);
      setSubmissions([]);
      setStudents([]);
      showToast('ออกจากระบบสำเร็จ', 'info');
    } catch (error: any) {
      showToast(error.message || 'เกิดข้อผิดพลาดในการออกจากระบบ', 'error');
    }
  };

  const handleSelectClassroom = (classroom: Classroom) => {
    setActiveClassroom(classroom);
    loadClassroomData(classroom.id);
  };

  const handleCreateAssignment = async (newAssignment: Omit<Assignment, 'id' | 'createdAt'>) => {
    try {
      const created = await ApiService.createAssignment({
        classroomId: newAssignment.classroomId,
        title: newAssignment.title,
        description: newAssignment.description,
        dueDate: newAssignment.dueDate,
        maxScore: newAssignment.maxScore,
        allowLate: newAssignment.allowLate,
        status: newAssignment.status,
        attachmentName: newAssignment.attachmentName
      });
      setAssignments([created, ...assignments]);
      showToast(`มอบหมาย "${created.title}" เรียบร้อยแล้ว`, 'success');
      setIsCreateAssignmentOpen(false);
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถสร้างการบ้านได้', 'error');
    }
  };

  const handleSubmitHomework = async (payload: {
    assignmentId: string;
    studentId: string;
    studentName: string;
    studentNumber?: string;
    textResponse?: string;
    fileName?: string;
    fileSize?: number;
  }) => {
    try {
      const result = await ApiService.submitHomework({
        assignmentId: payload.assignmentId,
        textResponse: payload.textResponse,
        fileName: payload.fileName,
        fileSize: payload.fileSize
      });
      
      // Refresh submissions
      const updatedSubmissions = await ApiService.getSubmissions();
      setSubmissions(updatedSubmissions);
      
      if (result.isLate) {
        showToast('ส่งการบ้านสำเร็จ (ประทับเวลา: ส่งช้า)', 'info');
      } else {
        showToast('ส่งการบ้านสำเร็จตรงเวลา เรียบร้อยแล้ว!', 'success');
      }
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถส่งการบ้านได้', 'error');
    }
  };

  const handleGradeSubmission = async (submissionId: string, score: number, feedback: string) => {
    try {
      await ApiService.gradeSubmission(submissionId, score, feedback);
      
      // Refresh submissions
      const updatedSubmissions = await ApiService.getSubmissions();
      setSubmissions(updatedSubmissions);
      
      showToast(`บันทึกคะแนน ${score} คะแนนเรียบร้อยแล้ว`, 'success');
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถบันทึกคะแนนได้', 'error');
    }
  };

  const handleCreateClassroom = async (cls: Omit<Classroom, 'id' | 'memberStudentIds'>) => {
    try {
      const created = await ApiService.createClassroom({
        title: cls.title,
        subjectCode: cls.subjectCode,
        description: cls.description,
        academicYear: cls.academicYear,
        semester: cls.semester
      });
      setClassrooms([created, ...classrooms]);
      setActiveClassroom(created);
      showToast(`สร้างห้องเรียน "${created.title}" รหัส: ${created.classCode} สำเร็จ`, 'success');
      setClassroomModalMode(null);
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถสร้างห้องเรียนได้', 'error');
    }
  };

  const handleJoinClassroom = async (classCode: string) => {
    try {
      const joined = await ApiService.joinClassroom(classCode);
      setClassrooms([joined, ...classrooms]);
      setActiveClassroom(joined);
      showToast(`เข้าร่วมห้องเรียน "${joined.title}" สำเร็จ`, 'success');
      setClassroomModalMode(null);
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถเข้าร่วมห้องเรียนได้', 'error');
    }
  };

  const handleSwitchRole = async (newRole: 'teacher' | 'student') => {
    try {
      const res = await ApiService.switchRole(newRole);
      if (res.user) {
        setActiveUser(res.user);
        setClassrooms([]);
        setActiveClassroom(null);
        setAssignments([]);
        setSubmissions([]);
        setStudents([]);
        await loadInitialData(res.user);
        showToast(
          `เปลี่ยนบทบาทเป็น "${newRole === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน/นักศึกษา'}" เรียบร้อยแล้ว`,
          'success'
        );
      }
    } catch (error: any) {
      showToast(error.message || 'ไม่สามารถเปลี่ยนบทบาทได้', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">กำลังโหลดระบบ...</p>
        </div>
      </div>
    );
  }

  if (!activeUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-xl border border-slate-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
            <CheckCircle2 className="w-10 h-10 text-indigo-600 -rotate-3" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Homework Tracker</h1>
          <p className="text-slate-500 mb-8 font-medium">ระบบเช็คและตรวจการบ้านออนไลน์</p>
          
          {authError && (
            <div className="mb-6 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium border border-rose-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-left">{authError}</span>
            </div>
          )}
          
          <button
            onClick={() => {
              const clientId = '402996143343-cu2usdu7k66r0qhq47ultl36eg7fsgt1.apps.googleusercontent.com';
              const redirectUri = 'https://homework-tracker.674295029.workers.dev/api/auth/google/callback';
              const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;
              
              window.location.href = googleAuthUrl;
            }}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            เข้าสู่ระบบด้วย Google
          </button>
          
          <p className="mt-8 text-xs text-slate-400">
            ระบบรองรับสิทธิ์ ครูผู้สอน, นักเรียน และ ผู้ดูแลระบบ
          </p>
        </div>
      </div>
    );
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
        activeUser={activeUser}
        classrooms={classrooms}
        activeClassroom={activeClassroom}
        onSelectClassroom={handleSelectClassroom}
        onOpenCreateClass={() => setClassroomModalMode('create')}
        onOpenJoinClass={() => setClassroomModalMode('join')}
        onSwitchRole={handleSwitchRole}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {activeClassroom ? (
          activeUser.role === 'teacher' || activeUser.role === 'admin' ? (
            <TeacherDashboard
              classroom={activeClassroom}
              assignments={currentClassAssignments}
              submissions={submissions}
              students={students}
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
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-12">
            <h3 className="font-bold text-xl text-slate-800 mb-2">ยังไม่มีห้องเรียน</h3>
            <p className="text-slate-500 mb-8 font-medium">
              {activeUser.role === 'teacher' || activeUser.role === 'admin'
                ? 'กรุณาสร้างห้องเรียนแรกเพื่อเริ่มต้นใช้งานระบบ'
                : 'กรุณากรอกรหัส Class Code เพื่อเข้าร่วมห้องเรียน'}
            </p>
            <button
              onClick={() => setClassroomModalMode(activeUser.role === 'teacher' || activeUser.role === 'admin' ? 'create' : 'join')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 active:scale-95 w-full"
            >
              {activeUser.role === 'teacher' || activeUser.role === 'admin' ? 'สร้างห้องเรียนใหม่' : 'เข้าร่วมห้องเรียน'}
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

      {/* AI Chatbot Assistant Widget */}
      <ChatbotWidget
        user={activeUser}
        activeClassroom={activeClassroom}
        assignments={currentClassAssignments}
      />

    </div>
  );
};

export default App;
