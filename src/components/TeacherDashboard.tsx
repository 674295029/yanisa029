import React, { useState } from 'react';
import { Classroom, Assignment, Submission, User } from '../types';
import { 
  Users, CheckCircle2, Clock, AlertCircle, Award, 
  Download, Plus, Search, FileText, Check, Edit3, X
} from 'lucide-react';

interface TeacherDashboardProps {
  classroom: Classroom;
  assignments: Assignment[];
  submissions: Submission[];
  students: User[];
  onOpenCreateAssignment: () => void;
  onGradeSubmission: (submissionId: string, score: number, feedback: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  classroom,
  assignments,
  submissions,
  students,
  onOpenCreateAssignment,
  onGradeSubmission,
}) => {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    assignments[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  // Grading Modal State
  const [gradingSubmission, setGradingSubmission] = useState<{
    submission: Submission | null;
    student: User;
    assignment: Assignment;
  } | null>(null);
  const [scoreInput, setScoreInput] = useState<number | ''>('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [gradeError, setGradeError] = useState('');

  const currentAssignment = assignments.find((a) => a.id === selectedAssignmentId) || assignments[0];

  // Combine students enrolled in this classroom + students who submitted work
  const studentMap = new Map<string, User>();
  students.forEach((s) => {
    if (!classroom.memberStudentIds || classroom.memberStudentIds.length === 0 || classroom.memberStudentIds.includes(s.id)) {
      studentMap.set(s.id, s);
    }
  });

  submissions.forEach((sub) => {
    if (!studentMap.has(sub.studentId)) {
      studentMap.set(sub.studentId, {
        id: sub.studentId,
        name: sub.studentName,
        email: '',
        role: 'student',
        studentNumber: sub.studentNumber,
      });
    }
  });

  const enrolledStudents = Array.from(studentMap.values());

  // Submissions for currently selected assignment
  const currentSubmissions = submissions.filter((s) => s.assignmentId === currentAssignment?.id);

  // Compute metrics
  const submittedCount = currentSubmissions.filter((s) => s.status === 'submitted').length;
  const lateCount = currentSubmissions.filter((s) => s.status === 'late').length;
  const gradedCount = currentSubmissions.filter((s) => s.status === 'graded').length;
  const missingCount = enrolledStudents.length - currentSubmissions.length;

  const handleOpenGradeModal = (student: User, submission: Submission | null) => {
    if (!currentAssignment) return;
    setGradingSubmission({
      submission,
      student,
      assignment: currentAssignment,
    });
    setScoreInput(submission?.grade ? submission.grade.score : '');
    setFeedbackInput(submission?.grade ? submission.grade.feedback : '');
    setGradeError('');
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission || !gradingSubmission.submission) return;
    if (scoreInput === '' || Number(scoreInput) < 0) {
      setGradeError('กรุณากรอกคะแนนที่ถูกต้อง');
      return;
    }
    if (Number(scoreInput) > gradingSubmission.assignment.maxScore) {
      setGradeError(`คะแนนต้องไม่เกินคะแนนเต็ม (${gradingSubmission.assignment.maxScore} คะแนน)`);
      return;
    }

    onGradeSubmission(
      gradingSubmission.submission.id,
      Number(scoreInput),
      feedbackInput.trim()
    );
    setGradingSubmission(null);
  };

  // Export CSV Functionality
  const handleExportCSV = () => {
    if (!currentAssignment) return;

    const headers = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'สถานะการส่ง', 'วันเวลาที่ส่ง', 'คะแนนที่ได้', 'คะแนนเต็ม', 'ข้อเสนอแนะ'];
    const rows = enrolledStudents.map((st, idx) => {
      const sub = currentSubmissions.find((s) => s.studentId === st.id);
      let statusText = 'ยังไม่ส่ง (Missing)';
      if (sub) {
        if (sub.status === 'graded') statusText = 'ตรวจแล้ว (Graded)';
        else if (sub.status === 'late') statusText = 'ส่งช้า (Late)';
        else statusText = 'ส่งตรงเวลา (Submitted)';
      }

      const submittedDate = sub ? new Date(sub.submittedAt).toLocaleString('th-TH') : '-';
      const score = sub?.grade ? sub.grade.score : '-';
      const feedback = sub?.grade?.feedback ? `"${sub.grade.feedback.replace(/"/g, '""')}"` : '-';

      return [
        idx + 1,
        st.studentNumber || '-',
        `"${st.name}"`,
        `"${statusText}"`,
        `"${submittedDate}"`,
        score,
        currentAssignment.maxScore,
        feedback,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `คะแนน_${classroom.classCode}_${currentAssignment.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = enrolledStudents.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.studentNumber && s.studentNumber.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-md">
              {classroom.subjectCode}
            </span>
            <span className="text-slate-400 text-sm">รหัสเข้าห้อง:</span>
            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-sm border border-slate-200 tracking-wider">
              {classroom.classCode}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-2">{classroom.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{classroom.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCreateAssignment}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-100 transition"
          >
            <Plus className="w-4 h-4" />
            มอบหมายการบ้านใหม่
          </button>
          <button
            onClick={handleExportCSV}
            title="Export เป็นไฟล์ Excel/CSV"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-sm rounded-xl transition"
          >
            <Download className="w-4 h-4" />
            Export คะแนน (CSV)
          </button>
        </div>
      </div>

      {/* Assignment Selector Tabs */}
      {assignments.length > 0 ? (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              เลือกการบ้านที่ต้องการตรวจ:
            </label>
            {currentAssignment && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                new Date().getTime() > new Date(currentAssignment.dueDate).getTime()
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {new Date().getTime() > new Date(currentAssignment.dueDate).getTime() ? 'เลยกำหนดส่งแล้ว' : 'กำลังเปิดรับงาน'}
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {assignments.map((asg) => (
              <button
                key={asg.id}
                onClick={() => setSelectedAssignmentId(asg.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-left whitespace-nowrap transition flex items-center gap-2 ${
                  (currentAssignment?.id === asg.id)
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{asg.title}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                  currentAssignment?.id === asg.id ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {asg.maxScore} คะแนน
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 font-semibold">ยังไม่มีการบ้านในห้องเรียนนี้</p>
          <button
            onClick={onOpenCreateAssignment}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> มอบหมายการบ้านแรก
          </button>
        </div>
      )}

      {currentAssignment && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">นักเรียนในห้อง</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{enrolledStudents.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">คนทั้งหมด</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-blue-500 mb-1">
                <span className="text-xs font-medium text-slate-500">ส่งตรงเวลา</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{submittedCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">On-time</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-amber-500 mb-1">
                <span className="text-xs font-medium text-slate-500">ส่งช้า</span>
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-amber-600">{lateCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Late submission</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-500 mb-1">
                <span className="text-xs font-medium text-slate-500">ตรวจแล้ว</span>
                <Award className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">{gradedCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Graded</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-rose-400 mb-1">
                <span className="text-xs font-medium text-slate-500">ยังไม่ส่ง</span>
                <AlertCircle className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-rose-600">{missingCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Missing</p>
            </div>
          </div>

          {/* Submissions List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            
            {/* Table Filter Bar */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">รายชื่อนักเรียนและสถานะการส่งงาน</h3>
                <p className="text-xs text-slate-500">
                  กำหนดส่ง: {new Date(currentAssignment.dueDate).toLocaleString('th-TH')} | คะแนนเต็ม {currentAssignment.maxScore} คะแนน
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ หรือเลขประจำตัว..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">เลขที่</th>
                    <th className="px-4 py-3">นักเรียน</th>
                    <th className="px-4 py-3">สถานะการส่ง</th>
                    <th className="px-4 py-3">เวลาที่ส่ง</th>
                    <th className="px-4 py-3">คะแนน</th>
                    <th className="px-4 py-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student, index) => {
                    const sub = currentSubmissions.find((s) => s.studentId === student.id);
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">
                          {student.studentNumber ? student.studentNumber.slice(-2) : index + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {student.avatar && (student.avatar.startsWith('http') || student.avatar.startsWith('/')) ? (
                              <img
                                src={student.avatar}
                                alt={student.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                                {student.avatar || student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-slate-800">{student.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{student.studentNumber || student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {!sub && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                              ยังไม่ส่ง
                            </span>
                          )}
                          {sub && sub.status === 'submitted' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                              ส่งตรงเวลา
                            </span>
                          )}
                          {sub && sub.status === 'late' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              ส่งช้า (Late)
                            </span>
                          )}
                          {sub && sub.status === 'graded' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ตรวจแล้ว
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {sub ? new Date(sub.submittedAt).toLocaleString('th-TH') : '-'}
                        </td>
                        <td className="px-4 py-3.5">
                          {sub?.grade ? (
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {sub.grade.score} / {currentAssignment.maxScore}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {sub ? (
                            <button
                              onClick={() => handleOpenGradeModal(student, sub)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                sub.status === 'graded'
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {sub.status === 'graded' ? 'ดู/แก้ไขคะแนน' : 'ตรวจงาน'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">ยังไม่มีงานส่ง</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </>
      )}

      {/* Grading Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            
            <div className="bg-linear-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-base">ตรวจและให้คะแนนการบ้าน</h3>
                <p className="text-xs text-white/80">{gradingSubmission.assignment.title}</p>
              </div>
              <button
                onClick={() => setGradingSubmission(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-6 space-y-4">
              
              {/* Student info box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {gradingSubmission.student.avatar && (gradingSubmission.student.avatar.startsWith('http') || gradingSubmission.student.avatar.startsWith('/')) ? (
                    <img
                      src={gradingSubmission.student.avatar}
                      alt={gradingSubmission.student.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-sm">
                      {gradingSubmission.student.avatar || gradingSubmission.student.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{gradingSubmission.student.name}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      เลขประจำตัว: {gradingSubmission.student.studentNumber || '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                    gradingSubmission.submission?.status === 'late'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {gradingSubmission.submission?.status === 'late' ? 'ส่งช้า' : 'ส่งตรงเวลา'}
                  </span>
                  <p className="text-2xs text-slate-400 mt-1">
                    {gradingSubmission.submission && new Date(gradingSubmission.submission.submittedAt).toLocaleTimeString('th-TH')}
                  </p>
                </div>
              </div>

              {/* Student submission preview */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  เนื้อหาที่นักเรียนส่ง:
                </label>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm text-slate-800 min-h-[60px] whitespace-pre-line">
                  {gradingSubmission.submission?.textResponse || 'ไม่มีข้อความตอบกลับ'}
                </div>
              </div>

              {/* Attached file preview */}
              {gradingSubmission.submission?.files && gradingSubmission.submission.files.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    ไฟล์แนบของนักเรียน:
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {gradingSubmission.submission.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="text-xs font-semibold text-indigo-900 truncate">
                            {file.fileName}
                          </span>
                          <span className="text-2xs text-slate-400">
                            ({(file.fileSize / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <span className="text-2xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          สแกนปลอดภัย
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Score Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  คะแนนที่ได้ (คะแนนเต็ม {gradingSubmission.assignment.maxScore}) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={gradingSubmission.assignment.maxScore}
                    required
                    placeholder="เช่น 9.5"
                    value={scoreInput}
                    onChange={(e) => {
                      setScoreInput(e.target.value === '' ? '' : Number(e.target.value));
                      setGradeError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    / {gradingSubmission.assignment.maxScore} คะแนน
                  </span>
                </div>
                {gradeError && (
                  <p className="text-xs text-rose-500 font-medium mt-1">{gradeError}</p>
                )}
              </div>

              {/* Feedback Textarea */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  คำแนะนำและข้อเสนอแนะ (Feedback)
                </label>
                <textarea
                  rows={3}
                  placeholder="พิมพ์ข้อเสนอแนะเพื่อให้นักเรียนนำไปปรับปรุง เช่น อธิบายเพิ่มเติมในหัวข้อ..."
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200"
                >
                  <Award className="w-4 h-4" />
                  บันทึกผลการตรวจ
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
