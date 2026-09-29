# System Architecture & Design Specification
## ระบบเช็คและตรวจการบ้านออนไลน์ (Homework Tracking & Grading System)

---

### 1. บริบทของระบบและขอบเขต (System Context & Boundaries)

ระบบถูกออกแบบมาเพื่อเป็นศูนย์กลางการจัดการการบ้าน การตรวจงาน และการประเมินผลสำหรับสถานศึกษา โดยกำหนดบริบทและการปฏิสัมพันธ์กับผู้ใช้และระบบภายนอกดังนี้:

```mermaid
flowchart TD
    subgraph Users["กลุ่มผู้ใช้งาน (Actors)"]
        Teacher["👨‍🏫 ครูผู้สอน (Teacher)<br>[Desktop/Tablet Web]"]
        Student["👨‍🎓 นักเรียน (Student)<br>[Mobile/Web Responsive]"]
        Admin["🛠️ ผู้ดูแลระบบ (Admin)<br>[Web Console]"]
    end

    subgraph SystemBoundary["ขอบเขตระบบเช็คการบ้าน (Homework Management System Boundary)"]
        APIGateway["API Gateway & Reverse Proxy<br>(Nginx / Envoy / Cloudflare)"]
        CoreApp["Core Application Services<br>(REST API & Business Logic)"]
        TaskWorker["Background Worker<br>(Async Processing)"]
        RDBMS[("Primary Database<br>(PostgreSQL)")]
        Cache[("Cache & In-Memory Store<br>(Redis)")]
    end

    subgraph ExternalSystems["ระบบภายนอก (External Integrations)"]
        ObjectStorage[("Cloud Object Storage<br>(AWS S3 / GCS / MinIO)")]
        NotificationService["Notification Service<br>(SMTP / In-app / Push API)"]
        TimeServer["NTP Time Server<br>(Chrony / pool.ntp.org)"]
    end

    Teacher -->|HTTPS/TLS| APIGateway
    Student -->|HTTPS/TLS| APIGateway
    Admin -->|HTTPS/TLS| APIGateway

    APIGateway --> CoreApp
    CoreApp --> RDBMS
    CoreApp --> Cache
    CoreApp --> TaskWorker
    CoreApp -.->|Generate Presigned URL| ObjectStorage
    Student -.->|Direct Upload via Presigned URL| ObjectStorage
    Teacher -.->|Stream Preview via Signed URL| ObjectStorage
    TaskWorker --> NotificationService
    CoreApp --- TimeServer
```

#### Trust Boundaries (ขอบเขตความปลอดภัย):
1. **Public/Untrusted Zone:** Client Browser/Mobile App ของนักเรียนและครู
2. **DMZ / Ingress Zone:** Cloudflare WAF, TLS Termination, และ Rate Limiter
3. **Internal Trusted Zone:** Core Application Pods, Database Cluster, Background Workers, และ Redis Cache
4. **Third-Party / Managed Cloud Zone:** Object Storage (S3) ควบคุมการเข้าถึงด้วย IAM Role และ Presigned URL ชั่วคราว (TTL 15 นาที)

---

### 2. สถาปัตยกรรมภาพรวมระดับสูง (High-Level Architecture)

สถาปัตยกรรมของระบบเป็นแบบ **Modular Layered Architecture** ที่แยกส่วน Frontend, Backend API, Database, และ Asynchronous Processing เพื่อรองรับการสเกลแยกส่วนเมื่อเกิด Traffic Spike:

```mermaid
flowchart LR
    subgraph ClientTier["Client Tier"]
        WebClient["SPA Web Application<br>(React / TypeScript / Tailwind)"]
    end

    subgraph EdgeTier["Edge & Gateway Tier"]
        WAF["WAF & CDN<br>(DDoS Protection & SSL)"]
        Gateway["API Gateway / Nginx<br>(Rate Limiting & Routing)"]
    end

    subgraph ServiceTier["Service Tier (Stateless Application)"]
        AuthSvc["Auth Module<br>(JWT / Argon2)"]
        ClassSvc["Classroom Module<br>(Enrollment & Codes)"]
        AssignSvc["Assignment Module<br>(Deadlines & Rules)"]
        SubSvc["Submission Module<br>(Pre-signed URLs & Metadata)"]
        GradeSvc["Grading Module<br>(Rubrics & Scores)"]
        ExportSvc["Export Module<br>(Excel/CSV Generation)"]
    end

    subgraph DataAndQueueTier["Data, Cache & Worker Tier"]
        RedisQueue[("Redis Cache & Stream<br>(Rate Limit, Sessions, Task Queue)")]
        Worker["Async Worker<br>(Virus Scan & Excel Export)"]
        DB[(PostgreSQL Primary<br>ACID Compliant)]
        S3Bucket[("Object Storage (S3)<br>Encrypted at Rest")]
    end

    WebClient --> WAF
    WAF --> Gateway
    Gateway --> AuthSvc & ClassSvc & AssignSvc & SubSvc & GradeSvc & ExportSvc
    
    SubSvc -.->|Generate Upload URL| S3Bucket
    WebClient -->|Direct File Upload| S3Bucket

    AuthSvc & ClassSvc & AssignSvc & SubSvc & GradeSvc --> DB
    SubSvc & ExportSvc --> RedisQueue
    RedisQueue --> Worker
    Worker --> DB
    Worker --> S3Bucket
```

---

### 3. ส่วนประกอบสำคัญและความรับผิดชอบ (Component Responsibilities)

| ชื่อ Component | หน้าที่และความรับผิดชอบ (Responsibilities) | เทคโนโลยีที่แนะนำ |
|---|---|---|
| **Web Frontend (SPA)** | - นำเสนอ UI แบบ Responsive รองรับ Desktop & Mobile<br>- จัดการ Form Validation, File Picker, และแสดง Upload Progress Bar<br>- เรนเดอร์ File Preview (PDF/Image) ให้ครูตรวจงาน | React / Vite, Tailwind CSS, pdfjs |
| **API Gateway / Ingress** | - ทำ TLS Termination และบล็อกการโจมตี DDoS/Brute-force<br>- ตรวจสอบ Rate Limiting (จำกัด 60 req/min ต่อ IP สำหรับ Upload Request)<br>- Route traffic ไปยัง Application Instances | Nginx หรือ Traefik |
| **Core API Service** | - ประมวลผล Business Rules (เช่น ตรวจสอบ Deadline, คำนวณสถานะ Late)<br>- ควบคุมสิทธิ์การเข้าถึงข้อมูล (RBAC / Row-level permission)<br>- สร้าง Presigned URL สำหรับอัปโหลดและดาวน์โหลดไฟล์ | Node.js (NestJS/Express) หรือ Go / Python FastAPI |
| **PostgreSQL Database** | - จัดเก็บข้อมูลเชิงสัมพันธ์: ผู้ใช้, ห้องเรียน, การบ้าน, การส่งงาน, คะแนน<br>- รับประกันความสอดคล้องของข้อมูล (ACID Transaction) ในการบันทึกเวลาส่งงาน | PostgreSQL 16+ |
| **Redis In-Memory Store** | - บันทึก Blacklist Tokens / Session Cache<br>- ทำงานเป็น Distributed Rate Limiter<br>- ทำหน้าที่เป็น Message Queue / Job Queue สำหรับงาน Asynchronous | Redis 7+ |
| **Async Background Worker** | - ประมวลผลงานหนักที่ใช้เวลานาน: สร้างไฟล์ Excel Export สรุปคะแนน<br>- สแกนไวรัสไฟล์ที่อัปโหลดเข้า Bucket (ClamAV integration)<br>- ส่ง Notification หรืออีเมลแจ้งเตือน | BullMQ Worker / Celery |
| **Cloud Object Storage** | - จัดเก็บไฟล์การบ้านและไฟล์โจทย์อย่างปลอดภัย<br>- เข้ารหัสไฟล์ Server-Side Encryption (SSE-S3)<br>- รองรับ Lifecycle Rule เพื่อย้ายไฟล์เก่าเข้า Cold Storage | AWS S3 / MinIO |

---

### 4. การไหลของข้อมูล (Data Flow Architecture)

#### 4.1 ข้อมูลการสร้างและการส่งการบ้าน (Assignment & Submission Lifecycle)

```mermaid
stateDiagram-v2
    [*] --> Draft: ครูสร้างแบบร่าง
    Draft --> Published: ครูเผยแพร่การบ้าน
    
    Published --> Pending: นักเรียนได้รับมอบหมาย
    Pending --> Submitted: ส่งงานก่อน Deadline
    Pending --> Late: ส่งงานหลัง Deadline (เปิด Allow Late)
    Pending --> Missing: ไม่ได้ส่งงานจนเลย Deadline (ปิด Allow Late)
    
    Submitted --> Graded: ครูตรวจและบันทึกคะแนน
    Late --> Graded: ครูตรวจและบันทึกคะแนน
    
    Graded --> Resubmitted: ครูสั่งให้แก้ไข (Request Revision)
    Resubmitted --> Graded: ส่งงานแก้ไขแล้วครูตรวจซ้ำ
    
    Graded --> [*]
```

---

### 5. ลำดับการทำงานของ Use Case สำคัญ (Sequence Diagrams)

#### 5.1 Use Case: การส่งการบ้านด้วย Direct-to-Storage Upload (รองรับ Peak Load)
แนวทางนี้ป้องกันเซิร์ฟเวอร์ล่มเมื่อนักเรียนแห่ส่งงานพร้อมกันก่อน Deadline โดยให้เบราว์เซอร์อัปโหลดไฟล์ตรงเข้า S3:

```mermaid
sequenceDiagram
    autonumber
    actor Student as 👨‍🎓 นักเรียน (Browser)
    participant API as 🖥️ Backend API
    participant DB as 🗄️ PostgreSQL
    participant S3 as 🪣 Object Storage (S3)
    participant Queue as 📬 Redis Queue
    participant Worker as ⚙️ Async Worker

    Student->>API: 1. POST /api/submissions/prepare-upload<br>{assignment_id, file_name, file_size, mime_type}
    API->>DB: 2. ตรวจสอบสิทธิ์ & วันที่เทียบ Deadline (Server Time)
    API->>S3: 3. สร้าง Pre-signed Upload URL (TTL: 15 นาที)
    API-->>Student: 4. ส่งกลับ {upload_url, file_key, is_late}
    
    Student->>S3: 5. PUT File Payload โดยตรงผ่าน Pre-signed URL (พร้อม Progress Bar)
    S3-->>Student: 6. 200 OK (Upload สำเร็จ)
    
    Student->>API: 7. POST /api/submissions/confirm<br>{assignment_id, file_key, checksum}
    API->>DB: 8. บันทึก Submission Record (Status: Submitted หรือ Late, Timestamp)
    API->>Queue: 9. ส่ง Job เข้าคิวสแกนไฟล์และตรวจสอบความปลอดภัย
    API-->>Student: 10. 201 Created: ส่งการบ้านสำเร็จ
    
    Worker->>Queue: 11. ดึง Job ไปสแกนความปลอดภัยของไฟล์ใน S3
    Worker->>DB: 12. อัปเดตสถานะไฟล์ว่า Scan Passed
```

#### 5.2 Use Case: ครูตรวจงานและให้คะแนน (Grading & Preview Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as 👨‍🏫 ครูผู้สอน
    participant API as 🖥️ Backend API
    participant DB as 🗄️ PostgreSQL
    participant S3 as 🪣 Object Storage (S3)
    actor Student as 👨‍🎓 นักเรียน

    Teacher->>API: 1. GET /api/submissions/{id}
    API->>DB: 2. ตรวจสอบสิทธิ์ความเป็นครูประจำวิชา & ดึง Submission Meta
    API->>S3: 3. สร้าง Pre-signed Read URL (TTL: 30 นาที)
    API-->>Teacher: 4. ส่งข้อมูล Submission + Secure Preview URL
    
    Teacher->>S3: 5. โหลดไฟล์พรีวิวผ่าน Secure URL แสดงในหน้าเว็บ
    Teacher->>API: 6. POST /api/submissions/{id}/grade<br>{score: 9.0, feedback: "ดีมาก"}
    API->>DB: 7. บันทึกผลคะแนน, ปรับสถานะเป็น Graded
    API-->>Teacher: 8. 200 OK (บันทึกสำเร็จ)
    API--)Student: 9. ส่ง In-App Notification "การบ้านได้รับการตรวจแล้ว ได้คะแนน 9/10"
```

---

### 6. กลยุทธ์การรองรับโหลดสูง (Scalability Strategy)

ช่วงเวลา 15–30 นาทีก่อนกำหนดส่งการบ้าน (Deadline) มักเกิดปรากฏการณ์ **Traffic Spike** ระบบจึงมีกลยุทธ์รองรับดังนี้:

1. **Decoupled File Ingestion (การแยกภาระการรับไฟล์):**
   - ไฟล์การบ้านขนาด 5–25 MB จะไม่ไหลผ่าน API Gateway หรือ Application Server แต่จะถูกส่งตรงเข้า Object Storage ผ่าน Pre-signed URL ช่วยประหยัด Network Bandwidth และ RAM ของ Application Pods ได้มากกว่า 90%
2. **Stateless Core API Instances:**
   - เซิร์ฟเวอร์ API ไม่มีสถานะผูกติดในเครื่อง (Stateless) ทำให้สามารถตั้ง **Kubernetes HPA (Horizontal Pod Autoscaler)** เพิ่ม Pod อัตโนมัติเมื่อ CPU เกิน 70% หรือ Network Request สูงขึ้น
3. **Database Read/Write Optimization:**
   - ใช้ Connection Pooling (เช่น PgBouncer) เพื่อควบคุมปริมาณ Database Connections ในช่วง Peak
   - ดัชนีฐานข้อมูล (Indexes) สำหรับการค้นหาสำคัญ เช่น `(assignment_id, student_id)`, `(classroom_id, status)`
4. **Caching Strategy (Redis):**
   - แคชข้อมูลรายละเอียดการบ้าน (Assignment Details) และรายชื่อนักเรียนในห้อง เพราะเป็นข้อมูลที่อ่านซ้ำ ๆ (Read-heavy) แต่เปลี่ยนแปลงน้อย

---

### 7. แผนความพร้อมใช้งานและการรับมือข้อผิดพลาด (Availability & Resilience Plan)

| กรณีเกิดความล้มเหลว (Failure Scenario) | ผลกระทบที่อาจเกิด | กลไกป้องกันและกู้คืน (Resilience Strategy) |
|---|---|---|
| **อินเทอร์เน็ตของนักเรียนหลุดระหว่างอัปโหลดไฟล์** | อัปโหลดไม่เสร็จ ไฟล์ค้างใน S3 | - Client ทำ Resumable / Chunked Upload สำหรับไฟล์ขนาดใหญ่<br>- ตั้ง S3 Lifecycle Rule ลบ Multipart Upload ที่ไม่สมบูรณ์ทิ้งภายใน 24 ชม.<br>- การบันทึกสถานะใน Database จะเกิดขึ้นเฉพาะเมื่อยืนยัน Confirmation สำเร็จเท่านั้น |
| **ฐานข้อมูล Primary Database ล่ม** | ระบบไม่สามารถบันทึกข้อมูลได้ | - ใช้ Multi-AZ Replication (Primary-Standby) พร้อม Automatic Failover ภายในไม่เกิน 60 วินาที<br>- ทำ Automated Daily Backup พร้อม Point-in-Time Recovery (PITR) 7 วัน |
| **Object Storage ชั่วคราวไม่ตอบสนอง** | ขอ Pre-signed URL ไม่ได้ | - ทำ Circuit Breaker (Resilience4j / Opossum) แจ้งเตือนข้อความที่เป็นมิตรแก่นักเรียนและให้ลองใหม่อัตโนมัติ (Exponential Backoff Retry) |
| **เวลาเครื่อง Server คลาดเคลื่อน** | การตัดสินสถานะส่งช้าผิดพลาด | - บังคับใช้งาน NTP Daemon (Chrony) ซิงก์เวลาจาก Time Server กลาง และใช้ฟังก์ชัน `NOW() AT TIME ZONE 'UTC'` ใน Database เท่านั้น |

---

### 8. ขอบเขตความปลอดภัย (Security Architecture)

1. **การป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต (IDOR Defense):**
   - ทุก Endpoint ที่เข้าถึง Submission ต้องมี Authorization Middleware ตรวจสอบ:
     - ถ้านักเรียนเรียกดู ต้องเป็น `submission.student_id == current_user.id` เท่านั้น
     - ถ้าครูเรียกดู ต้องเป็น `classroom.teacher_id == current_user.id` เท่านั้น
2. **ความปลอดภัยของไฟล์แนบ (File Storage Security):**
   - ตั้งค่า S3 Bucket เป็น **Private 100%** (Block Public Access)
   - ไฟล์จะถูกเข้าถึงได้เฉพาะผ่าน Temporary Pre-signed URL ที่มีอายุสั้นเท่านั้น (Upload URL: 15 นาที, Preview URL: 30 นาที)
   - ตรวจสอบ Content-Length และ Magic Bytes ป้องกันการเปลี่ยนนามสกุลไฟล์
3. **Audit Trail & Non-repudiation:**
   - บันทึกตาราง `audit_logs` สำหรับการเปลี่ยนสถานะการส่งงาน การแก้ไขคะแนน และการตรวจงาน เพื่อใช้เป็นหลักฐานกรณีมีข้อโต้แย้ง

---

### 9. การเปรียบเทียบทางเลือกในการออกแบบ (Design Trade-offs)

| มิติการตัดสินใจ | ทางเลือกที่ 1 (เลือกใช้) | ทางเลือกที่ 2 (ไม่เลือก) | เหตุผลและข้อพิจารณา (Rationale & Trade-off) |
|---|---|---|---|
| **รูปแบบการอัปโหลดไฟล์** | **Direct to S3 via Pre-signed URL** | อัปโหลดผ่าน Backend API Server | ทางเลือกที่ 1 ซับซ้อนกว่าเล็กน้อยเพราะต้องมี 2-step (ขอ URL -> ยืนยัน) แต่แก้ปัญหาคอขวด Bandwidth และป้องกัน Server ล่มช่วง Peak Load ได้เด็ดขาด |
| **รูปแบบสถาปัตยกรรม** | **Modular Monolith (แยก Service Tier ได้)** | Microservices เต็มรูปแบบ | Modular Monolith ง่ายต่อการพัฒนาและ Deployment ในระยะแรก ไม่เพิ่มความซับซ้อนของ Distributed Tracing และ Network Latency แต่ยังรองรับการแยก Worker ได้ |
| **ระบบฐานข้อมูล** | **Relational Database (PostgreSQL)** | NoSQL (MongoDB) | การจัดการคะแนน สถานะการส่ง และการลงทะเบียนต้องการ ACID Transaction และความถูกต้องทางการเงิน/การศึกษาอย่างเคร่งครัด จึงเลือก RDBMS |

---
*เอกสารนี้จัดทำตามมาตรฐาน **02-system-design** เพื่อใช้เชื่อมต่อกับ **04-database-design** และ **05-api-design** ในขั้นตอนต่อไป*
