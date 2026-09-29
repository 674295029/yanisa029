import React, { useState } from 'react';
import { X, School, Plus, LogIn } from 'lucide-react';
import { Classroom } from '../types';

interface ClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'join';
  teacherId: string;
  teacherName: string;
  studentId: string;
  onCreateClass: (cls: Omit<Classroom, 'id' | 'memberStudentIds'>) => void;
  onJoinClass: (classCode: string) => void;
}

export const ClassroomModal: React.FC<ClassroomModalProps> = ({
  isOpen,
  onClose,
  mode,
  teacherId,
  teacherName,
  onCreateClass,
  onJoinClass,
}) => {
  const [title, setTitle] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [description, setDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subjectCode.trim()) return;

    // Generate class code e.g. SCI891
    const randomCode = subjectCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900);

    onCreateClass({
      title: title.trim(),
      subjectCode: subjectCode.trim(),
      description: description.trim(),
      classCode: randomCode,
      teacherId,
      teacherName,
      academicYear: '2569',
      semester: 1,
    });

    setTitle('');
    setSubjectCode('');
    setDescription('');
    onClose();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinClass(joinCode.trim());
    setJoinCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between text-white ${
          mode === 'create' ? 'bg-indigo-600' : 'bg-emerald-600'
        }`}>
          <div className="flex items-center gap-2">
            <School className="w-5 h-5" />
            <h3 className="font-bold text-lg">
              {mode === 'create' ? 'สร้างห้องเรียนใหม่' : 'เข้าร่วมห้องเรียน'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                ชื่อวิชา / ห้องเรียน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น วิทยาศาสตร์กายภาพ ม.3/2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                รหัสวิชา <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ว23101"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                รายละเอียดห้องเรียน
              </label>
              <textarea
                rows={2}
                placeholder="คำอธิบายสั้นๆ เกี่ยวกับวิชาหรือห้องเรียน..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200"
              >
                <Plus className="w-4 h-4" />
                สร้างห้องเรียน
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                รหัสห้องเรียน (Class Code) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="กรอกรหัส เช่น SCI301"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 text-center tracking-widest uppercase font-mono font-bold text-lg rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                ขอรับรหัส 6 หลักจากคุณครูผู้สอนเพื่อเข้าร่วมห้องเรียน
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200"
              >
                <LogIn className="w-4 h-4" />
                เข้าร่วมห้องเรียน
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
