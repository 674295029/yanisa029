import { User, Classroom, Assignment, Submission } from '../types';

export const initialUsers: User[] = [
  {
    id: 'teacher-1',
    name: 'ครูวิภาดา สอนเก่ง',
    email: 'wipada.s@school.ac.th',
    role: 'teacher',
    avatar: '👩‍🏫',
  },
  {
    id: 'student-1',
    name: 'ด.ช. สมชาย รักเรียน',
    email: 'somchai.r@school.ac.th',
    role: 'student',
    studentNumber: '660101',
    avatar: '👦',
  },
  {
    id: 'student-2',
    name: 'ด.ญ. สมหญิง ขยันดี',
    email: 'somying.k@school.ac.th',
    role: 'student',
    studentNumber: '660102',
    avatar: '👧',
  },
  {
    id: 'student-3',
    name: 'นาย นพดล ตั้งใจ',
    email: 'nopadol.t@school.ac.th',
    role: 'student',
    studentNumber: '660103',
    avatar: '🧑',
  },
  {
    id: 'student-4',
    name: 'น.ส. กัญญารัตน์ สดใส',
    email: 'kanyarat.s@school.ac.th',
    role: 'student',
    studentNumber: '660104',
    avatar: '👩',
  }
];

export const initialClassrooms: Classroom[] = [
  {
    id: 'cls-1',
    title: 'วิทยาศาสตร์ชีวภาพ ม.3/1',
    subjectCode: 'ว23101',
    description: 'ศึกษาโครงสร้างเซลล์ การถ่ายทอดทางพันธุกรรม และระบบนิเวศ',
    classCode: 'SCI301',
    teacherId: 'teacher-1',
    teacherName: 'ครูวิภาดา สอนเก่ง',
    academicYear: '2569',
    semester: 1,
    memberStudentIds: ['student-1', 'student-2', 'student-3', 'student-4'],
  },
  {
    id: 'cls-2',
    title: 'โครงงานวิทยาศาสตร์และเทคโนโลยี',
    subjectCode: 'ว23102',
    description: 'การสืบเสาะหาความรู้และสะเต็มศึกษา (STEM Education)',
    classCode: 'STEM302',
    teacherId: 'teacher-1',
    teacherName: 'ครูวิภาดา สอนเก่ง',
    academicYear: '2569',
    semester: 1,
    memberStudentIds: ['student-1', 'student-2'],
  }
];

// Helper to calculate relative ISO dates
const now = new Date();
const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago (for testing late submission)
const futureDate1 = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(); // 2 days ahead
const futureDate2 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ahead

export const initialAssignments: Assignment[] = [
  {
    id: 'asg-1',
    classroomId: 'cls-1',
    title: 'ใบงานที่ 1: โครงสร้างเซลล์พืชและเซลล์สัตว์',
    description: 'ให้นักเรียนวาดรูปเปรียบเทียบออร์แกเนลล์ที่พบในเซลล์พืชและเซลล์สัตว์ พร้อมอธิบายหน้าที่สำคัญของ คลอโรพลาสต์ และ ไมโทคอนเดรีย มาอย่างละเอียด',
    dueDate: pastDate, // Past deadline to demonstrate Late submission feature
    maxScore: 10,
    allowLate: true,
    status: 'published',
    attachmentName: 'โจทย์_ใบงานที่1_เซลล์.pdf',
    createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'asg-2',
    classroomId: 'cls-1',
    title: 'แบบฝึกหัดที่ 2: ปฏิกิริยาการสังเคราะห์ด้วยแสง (Photosynthesis)',
    description: 'ตอบคำถามท้ายบทเรียนข้อ 1-5 ในหนังสือเรียนหน้า 42 ถ่ายรูปภาพคำตอบหรือพิมพ์คำตอบแนบส่ง',
    dueDate: futureDate1,
    maxScore: 20,
    allowLate: false,
    status: 'published',
    attachmentName: 'สรุปการสังเคราะห์ด้วยแสง.pdf',
    createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'asg-3',
    classroomId: 'cls-1',
    title: 'รายงานการทดลอง: การแบ่งเซลล์แบบไมโทซิส',
    description: 'ส่งรายงานผลการทดลองส่องกล้องจุลทรรศน์ดูเซลล์ปลายรากหอม พร้อมภาพประกอบบันทึกผล',
    dueDate: futureDate2,
    maxScore: 15,
    allowLate: true,
    status: 'published',
    attachmentName: 'คู่มือการทดลอง_ไมโทซิส.docx',
    createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

export const initialSubmissions: Submission[] = [
  {
    id: 'sub-1',
    assignmentId: 'asg-1',
    studentId: 'student-1',
    studentName: 'ด.ช. สมชาย รักเรียน',
    studentNumber: '660101',
    status: 'graded',
    submittedAt: new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString(),
    textResponse: 'ส่งงานใบงานที่ 1 ครับ ผมแนบภาพวาดเปรียบเทียบเซลล์และสรุปหน้าที่ออร์แกเนลล์ครบทั้ง 8 ชนิดครับ',
    files: [
      {
        id: 'file-1',
        fileName: 'สมชาย_ใบงานเซลล์พืชสัตว์.pdf',
        fileSize: 2450000,
        fileUrl: '#',
        mimeType: 'application/pdf',
      }
    ],
    version: 1,
    grade: {
      id: 'grd-1',
      submissionId: 'sub-1',
      graderId: 'teacher-1',
      score: 9.5,
      feedback: 'วาดภาพประกอบและจำแนกออร์แกเนลล์ได้ชัดเจนมาก ลายมือสวยงาม ชื่นชมครับ',
      gradedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    }
  },
  {
    id: 'sub-2',
    assignmentId: 'asg-1',
    studentId: 'student-2',
    studentName: 'ด.ญ. สมหญิง ขยันดี',
    studentNumber: '660102',
    status: 'late',
    submittedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // After deadline
    textResponse: 'ขออภัยที่ส่งช้าค่ะคุณครู พอดีคอมพิวเตอร์ขัดข้อง แต่ทำการบ้านเสร็จเรียบร้อยแล้วค่ะ',
    files: [
      {
        id: 'file-2',
        fileName: 'สมหญิง_เซลล์พืชและสัตว์.png',
        fileSize: 1840000,
        fileUrl: '#',
        mimeType: 'image/png',
      }
    ],
    version: 1,
  },
  {
    id: 'sub-4',
    assignmentId: 'asg-1',
    studentId: 'student-4',
    studentName: 'น.ส. กัญญารัตน์ สดใส',
    studentNumber: '660104',
    status: 'submitted',
    submittedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
    textResponse: 'ส่งใบงานที่ 1 เรียบร้อยค่ะ ตรวจสอบไฟล์แนบได้เลยค่ะ',
    files: [
      {
        id: 'file-4',
        fileName: 'กัญญารัตน์_งานเซลล์.pdf',
        fileSize: 3100000,
        fileUrl: '#',
        mimeType: 'application/pdf',
      }
    ],
    version: 1,
  }
  // student-3 hasn't submitted yet -> status: Missing
];
