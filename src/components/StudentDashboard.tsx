import React, { useState } from 'react';
import { Classroom, Assignment, Submission, User } from '../types';
import { 
  CheckCircle2, Clock, AlertCircle, Award, Upload, 
  FileText, Calendar, MessageSquare, ArrowRight, X, RefreshCw
} from 'lucide-react';

interface StudentDashboardProps {
  student: User;
  classrooms: Classroom[];
  assignments: Assignment[];
  submissions: Submission[];
  onSubmitHomework: (payload: {
    assignmentId: string;
    studentId: string;
    studentName: string;
    studentNumber?: string;
    textResponse?: string;
    fileName?: string;
    fileSize?: number;
  }) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  classrooms,
  assignments,
  submissions,
  onSubmitHomework,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  
  // Submit Modal state
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Grade Modal state
  const [viewingSubmission, setViewingSubmission] = useState<{
    assignment: Assignment;
    submission: Submission;
  } | null>(null);

  // Match student submissions
  const studentSubmissions = submissions.filter((s) => s.studentId === student.id);

  // Group assignments with submission status
  const assignmentItems = assignments.map((asg) => {
    const sub = studentSubmissions.find((s) => s.assignmentId === asg.id);
    const now = new Date().getTime();
    const dueDate = new Date(asg.dueDate).getTime();
    const isPastDue = now > dueDate;

    let statusKey: 'missing' | 'submitted' | 'late' | 'graded' = 'missing';
    if (sub) {
      statusKey = sub.status as 'submitted' | 'late' | 'graded';
    } else if (isPastDue) {
      statusKey = 'missing';
    }

    return {
      assignment: asg,
      submission: sub,
      isPastDue,
      statusKey,
      classroom: classrooms.find((c) => c.id === asg.classroomId),
    };
  });

  // Filter tabs
  const filteredItems = assignmentItems.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return item.statusKey === 'missing';
    if (activeTab === 'submitted') return item.statusKey === 'submitted' || item.statusKey === 'late';
    if (activeTab === 'graded') return item.statusKey === 'graded';
    return true;
  });

  const handleOpenFileModal = (asg: Assignment) => {
    const existing = studentSubmissions.find((s) => s.assignmentId === asg.id);
    setSubmittingAssignment(asg);
    setTextAnswer(existing?.textResponse || '');
    setSelectedFile(null);
    setFileError('');
    setUploadProgress(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check 25 MB max size
      if (file.size > 26214400) {
        setFileError('ขนาดไฟล์เกิน 25 MB กรุณาเลือกไฟล์ใหม่');
        setSelectedFile(null);
        return;
      }
      setFileError('');
      setSelectedFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment) return;

    setIsSubmitting(true);
    setUploadProgress(15);

    // Simulate progress bar (2-step direct to S3 ingestion)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (!prev) return 30;
        if (prev >= 90) {
          clearInterval(interval);
          return 100;
        }
        return prev + 35;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      onSubmitHomework({
        assignmentId: submittingAssignment.id,
        studentId: student.id,
        studentName: student.name,
        studentNumber: student.studentNumber,
        textResponse: textAnswer.trim(),
        fileName: selectedFile ? selectedFile.name : undefined,
        fileSize: selectedFile ? selectedFile.size : undefined,
      });

      setIsSubmitting(false);
      setSubmittingAssignment(null);
    }, 900);
  };

  // Metrics
  const totalCount = assignmentItems.length;
  const gradedCount = assignmentItems.filter((i) => i.statusKey === 'graded').length;
  const pendingCount = assignmentItems.filter((i) => i.statusKey === 'missing').length;

  return (
    <div className="space-y-6">
      
      {/* Student Welcome Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
            {student.avatar && (student.avatar.startsWith('http') || student.avatar.startsWith('/')) ? (
              <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">{student.avatar || '👦'}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono font-semibold">
                เลขที่ {student.studentNumber ? student.studentNumber.slice(-2) : '1'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              รหัสนักเรียน: {student.studentNumber || '-'} | ห้องเรียนที่เข้าร่วม {classrooms.length} ห้อง
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-2xs uppercase text-slate-400 font-bold">การบ้านทั้งหมด</span>
            <p className="text-lg font-bold text-slate-800">{totalCount}</p>
          </div>
          <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-2xs uppercase text-emerald-600 font-bold">ตรวจแล้ว</span>
            <p className="text-lg font-bold text-emerald-700">{gradedCount}</p>
          </div>
          <div className="text-center px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-2xs uppercase text-amber-600 font-bold">ค้างส่ง</span>
            <p className="text-lg font-bold text-amber-700">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          ทั้งหมด ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          ยังไม่ส่ง ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('submitted')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
            activeTab === 'submitted'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          ส่งแล้ว (รอตรวจ) ({assignmentItems.filter((i) => i.statusKey === 'submitted' || i.statusKey === 'late').length})
        </button>
        <button
          onClick={() => setActiveTab('graded')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
            activeTab === 'graded'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          ตรวจแล้ว ({gradedCount})
        </button>
      </div>

      {/* Assignments Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map(({ assignment, submission, isPastDue, statusKey, classroom }) => {
          const isClosed = isPastDue && !assignment.allowLate;

          return (
            <div
              key={assignment.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Header tag */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {classroom?.subjectCode || 'วิชาเรียน'}
                  </span>

                  {/* Status Badge */}
                  {statusKey === 'missing' && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isPastDue
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {isPastDue ? (assignment.allowLate ? 'ส่งช้าได้ (Late allowed)' : 'หมดเวลาส่ง') : 'รอการส่ง'}
                    </span>
                  )}
                  {statusKey === 'submitted' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ส่งตรงเวลา (รอตรวจ)
                    </span>
                  )}
                  {statusKey === 'late' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3.5 h-3.5" />
                      ส่งช้า (รอตรวจ)
                    </span>
                  )}
                  {statusKey === 'graded' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Award className="w-3.5 h-3.5" />
                      ตรวจแล้ว ({submission?.grade?.score}/{assignment.maxScore})
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-800 text-base line-clamp-1">{assignment.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {assignment.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                </p>

                {/* Due Date & Score info */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      กำหนดส่ง: {new Date(assignment.dueDate).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-700">
                    คะแนนเต็ม: {assignment.maxScore} คะแนน
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {statusKey === 'graded' && submission ? (
                  <button
                    onClick={() => setViewingSubmission({ assignment, submission })}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    <Award className="w-4 h-4" />
                    ดูคะแนนและ Feedback
                  </button>
                ) : statusKey === 'submitted' || statusKey === 'late' ? (
                  <button
                    onClick={() => handleOpenFileModal(assignment)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    ส่งแก้ไขใหม่ (Resubmit v{submission ? submission.version + 1 : 2})
                  </button>
                ) : (
                  <button
                    disabled={isClosed}
                    onClick={() => handleOpenFileModal(assignment)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold shadow-xs transition ${
                      isClosed
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isPastDue
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    {isClosed ? 'ปิดรับงานแล้ว' : isPastDue ? 'ส่งการบ้านล่าช้า' : 'ส่งการบ้าน'}
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 font-semibold">ไม่มีรายการการบ้านในหมวดนี้</p>
        </div>
      )}

      {/* Submission Modal */}
      {submittingAssignment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            
            <div className="bg-linear-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-base">ส่งการบ้าน</h3>
                <p className="text-xs text-white/80">{submittingAssignment.title}</p>
              </div>
              <button
                onClick={() => setSubmittingAssignment(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* Due Date & Server Check alert */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>กำหนดส่ง: {new Date(submittingAssignment.dueDate).toLocaleString('th-TH')}</span>
                  <span className="text-indigo-600">คะแนนเต็ม {submittingAssignment.maxScore} คะแนน</span>
                </div>
                <div className="pt-1 flex items-center gap-1.5 font-medium">
                  {new Date().getTime() > new Date(submittingAssignment.dueDate).getTime() ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      เลยกำหนดส่งแล้ว — ระบบจะประทับเวลา "ส่งช้า (Late Submission)"
                    </span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ส่งก่อนกำหนด — ประทับเวลา "ส่งตรงเวลา (On-Time)"
                    </span>
                  )}
                </div>
              </div>

              {/* Text Response */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  ข้อความคำตอบ / สรุปเนื้อหางาน
                </label>
                <textarea
                  rows={3}
                  placeholder="พิมพ์ข้อความตอบกลับ อธิบายคำตอบ หรือเขียนลิงก์งานที่ต้องการส่ง..."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* File Attachment Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  แนบไฟล์การบ้าน (PDF, PNG, JPG, DOCX สูงสุด 25 MB)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition bg-slate-50/50">
                  <input
                    type="file"
                    id="file-upload"
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-1" />
                    {selectedFile ? (
                      <div>
                        <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                        <p className="text-2xs text-slate-400">
                          ขนาด: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB (คลิกเพื่อเปลี่ยนไฟล์)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-indigo-600">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</p>
                        <p className="text-2xs text-slate-400">รองรับ PDF, รูปภาพ, Word เอกสาร</p>
                      </div>
                    )}
                  </label>
                </div>
                {fileError && <p className="text-xs text-rose-500 mt-1 font-medium">{fileError}</p>}
              </div>

              {/* Upload Progress Bar */}
              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-2xs font-semibold text-slate-500">
                    <span>กำลังอัปโหลดตรงเข้า Secure Storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 transition-all duration-200 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSubmittingAssignment(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!textAnswer.trim() && !selectedFile)}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-xl shadow-md shadow-indigo-100 transition"
                >
                  <Upload className="w-4 h-4" />
                  {isSubmitting ? 'กำลังส่งงาน...' : 'ยืนยันการส่งการบ้าน'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* View Grade & Feedback Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            
            <div className="bg-linear-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                <h3 className="font-bold text-base">ผลคะแนนและ Feedback</h3>
              </div>
              <button
                onClick={() => setViewingSubmission(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">
                {viewingSubmission.assignment.title}
              </h4>

              {/* Big Score Card */}
              <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">คะแนนที่ได้</span>
                <p className="text-4xl font-extrabold text-emerald-700 my-1">
                  {viewingSubmission.submission.grade?.score}
                  <span className="text-base font-normal text-emerald-600 ml-1">
                    / {viewingSubmission.assignment.maxScore}
                  </span>
                </p>
                <p className="text-2xs text-emerald-600">
                  ตรวจเมื่อ: {viewingSubmission.submission.grade && new Date(viewingSubmission.submission.grade.gradedAt).toLocaleString('th-TH')}
                </p>
              </div>

              {/* Feedback Comment */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  ข้อเสนอแนะจากคุณครู:
                </label>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  {viewingSubmission.submission.grade?.feedback || 'ไม่มีข้อเสนอแนะเพิ่มเติม'}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setViewingSubmission(null)}
                  className="px-5 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl"
                >
                  รับทราบ
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
