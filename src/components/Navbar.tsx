import React from 'react';
import { User, Classroom } from '../types';
import { BookOpen, Users, RefreshCw, PlusCircle, LogIn } from 'lucide-react';

interface NavbarProps {
  users: User[];
  activeUser: User;
  onSelectUser: (user: User) => void;
  classrooms: Classroom[];
  activeClassroom: Classroom | null;
  onSelectClassroom: (classroom: Classroom) => void;
  onOpenCreateClass: () => void;
  onOpenJoinClass: () => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  users,
  activeUser,
  onSelectUser,
  classrooms,
  activeClassroom,
  onSelectClassroom,
  onOpenCreateClass,
  onOpenJoinClass,
  onResetData,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & App Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-800 flex items-center gap-1.5">
                ระบบเช็คการบ้านออนไลน์
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                  Phase 1 MVP
                </span>
              </span>
              <p className="text-xs text-slate-500 hidden sm:block">
                Homework Tracking &amp; Grading System
              </p>
            </div>
          </div>

          {/* Center: Classroom Selector */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 mr-2 font-medium">ห้องเรียน:</span>
              <select
                aria-label="เลือกห้องเรียน"
                value={activeClassroom?.id || ''}
                onChange={(e) => {
                  const selected = classrooms.find((c) => c.id === e.target.value);
                  if (selected) onSelectClassroom(selected);
                }}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.classCode})
                  </option>
                ))}
              </select>
            </div>

            {activeUser.role === 'teacher' ? (
              <button
                onClick={onOpenCreateClass}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                สร้างห้องเรียน
              </button>
            ) : (
              <button
                onClick={onOpenJoinClass}
                className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                เข้าห้องเรียน
              </button>
            )}
          </div>

          {/* Right: Role Switcher & User Profile */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
              <label htmlFor="user-switcher-select" className="text-xs text-slate-400 pl-2 pr-1 font-medium hidden sm:inline">
                สลับบทบาท:
              </label>
              <select
                id="user-switcher-select"
                aria-label="สลับบทบาทผู้ใช้งาน"
                value={activeUser.id}
                onChange={(e) => {
                  const user = users.find((u) => u.id === e.target.value);
                  if (user) onSelectUser(user);
                }}
                className="bg-white text-xs font-semibold text-slate-700 py-1 px-2 rounded-lg border border-slate-200 shadow-2xs focus:outline-indigo-500 cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.avatar} {u.name} ({u.role === 'teacher' ? 'ครู' : 'นักเรียน'})
                  </option>
                ))}
              </select>
            </div>

            {/* Reset mock data button */}
            <button
              onClick={onResetData}
              title="รีเซ็ตข้อมูลเริ่มต้น"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
