import React from 'react';
import { User, Classroom } from '../types';
import { BookOpen, LogOut, ShieldAlert, GraduationCap, ArrowLeftRight } from 'lucide-react';
import { ApiService } from '../services/api';

interface NavbarProps {
  activeUser: User;
  classrooms: Classroom[];
  activeClassroom: Classroom | null;
  onSelectClassroom: (classroom: Classroom) => void;
  onOpenCreateClass: () => void;
  onOpenJoinClass: () => void;
  onSwitchRole: (role: 'teacher' | 'student') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeUser,
  classrooms,
  activeClassroom,
  onSelectClassroom,
  onOpenCreateClass,
  onOpenJoinClass,
  onSwitchRole,
  onLogout
}) => {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-800 tracking-tight">HW Tracker</span>
            </div>

            {/* Classrooms Dropdown */}
            <div className="hidden sm:flex items-center gap-4">
              <select
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-64 p-2.5 outline-hidden transition-colors cursor-pointer"
                value={activeClassroom?.id || ''}
                onChange={(e) => {
                  const cls = classrooms.find(c => c.id === e.target.value);
                  if (cls) onSelectClassroom(cls);
                }}
              >
                <option value="" disabled>เลือกห้องเรียน...</option>
                {classrooms.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.title} ({cls.classCode})
                  </option>
                ))}
              </select>
              {/* Teacher/Admin: Create + Join; Student: Join only */}
              {(activeUser.role === 'teacher' || activeUser.role === 'admin') ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenCreateClass}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    + สร้างห้องเรียน
                  </button>
                  <button
                    onClick={onOpenJoinClass}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    + เข้าร่วมห้องเรียน
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenJoinClass}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
                >
                  + เข้าร่วมห้องเรียน
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Role Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-200 px-2.5 py-1.5 rounded-xl transition-colors">
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={activeUser.role}
                onChange={(e) => onSwitchRole(e.target.value as 'teacher' | 'student')}
                className="bg-transparent text-xs font-bold text-slate-700 hover:text-indigo-700 cursor-pointer outline-hidden py-0.5"
                title="คลิกเพื่อสลับบทบาทเป็น ครู หรือ นักเรียน/นักศึกษา"
              >
                <option value="student">🎓 นักเรียน/นักศึกษา</option>
                <option value="teacher">👨‍🏫 ครูผู้สอน</option>
                {activeUser.role === 'admin' && <option value="admin">🛡️ ผู้ดูแลระบบ</option>}
              </select>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              {activeUser.avatar ? (
                <img src={activeUser.avatar} alt="avatar" className="w-8 h-8 rounded-full border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                  {activeUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-bold text-slate-700 leading-none">{activeUser.name}</span>
                <span className="text-xs font-medium text-slate-500 mt-1 capitalize">
                  {activeUser.role === 'admin' ? (
                    <span className="flex items-center gap-1 text-rose-600"><ShieldAlert className="w-3 h-3"/> ผู้ดูแลระบบ</span>
                  ) : activeUser.role === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน/นักศึกษา'}
                </span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="text-slate-400 hover:text-rose-600 transition-colors p-2 rounded-lg hover:bg-rose-50"
              title="ออกจากระบบ"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

