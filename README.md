# Cymor School CBC

A multi-tenant school management system built for Kenya's Competency-Based
Curriculum (CBC) — registration, subject-level assessment, and CBC rating
computation (EE/ME/AE/BE), with the marking scheme fully configurable per
school.

## What's built (Phase 1 + Phase 2 + Frontend)

- **Multi-tenancy**: every school's data (students, staff, marks, etc.) is
  isolated by `schoolId`, enforced automatically from the logged-in user's
  own account — no route trusts a client-supplied school ID.
- **Auth**: school signup (creates the school + its first admin account +
  a default marking scheme), login, JWT-based sessions, three roles
  (`super_admin`, `school_admin`, `teacher`).
- **Curriculum config**: Grade Levels → Subjects, defined by each school
  rather than hardcoded — see "Why curriculum isn't hardcoded" below.
- **Student registration**: admission number, grade, stream (class),
  guardian info.
- **Assessment**: one overall mark (0-100) per student per subject per
  term — matches how most schools actually run CBC reporting in practice.
- **CBC rating engine**: converts a mark to EE/ME/AE/BE — **unit tested
  directly** against every boundary value (75%, 74%, 41%, 40%, 21%, 20%,
  0%), not just assumed correct.
- **Configurable marking scheme**: each school can edit its own
  EE/ME/AE/BE percentage thresholds; a validator catches gaps/overlaps
  before they'd silently produce ungraded marks.
- **Auto-suggested comments**: if a teacher doesn't type a comment, it
  falls back to the marking scheme band's default comment.
- **Teacher assignments**: a teacher can only enter marks for
  subject+class combinations they're actually assigned to (checked
  server-side, not just hidden in the UI).
- **Gradebook view**: a whole class's marks for one subject/term in one call.
- **Report cards** (PDF): per-student, every subject, mark, CBC band,
  comment, rating key, signature line.
- **Class ranking report (PDF + JSON)**: every student's per-subject
  marks, total, mean mark, mean grade (CBC band of the mean), and class
  **position** — using proper competition ranking (tied means share a
  position; the next distinct position skips accordingly, e.g. 1, 2, 2, 4
  — not 1, 2, 2, 3). **Tested directly** against a tie case and a
  no-marks-at-all case before shipping. Available to teachers, not just
  school_admin, per your request.
- **Frontend**: a single self-contained `public/index.html` (no build
  step, no folder-path deploy risk) covering the full flow — login/school
  registration, setup (grade levels, streams, subjects, marking scheme),
  students, staff, teacher assignments, marks entry (gradebook), and
  report cards (both the individual PDF and the class ranking PDF).
  **Every single API call in the frontend was cross-checked
  programmatically against the actual backend routes** — all 25+ calls
  matched exactly, no path/method mismatches.

## A note on PDF download links and auth

The PDF endpoints (`/api/reports/.../pdf`) are opened as plain `<a href>`
links (so the browser handles the file download/viewer natively), which
means they can't carry a custom `Authorization` header the way `fetch()`
calls elsewhere in the app do. To make this work, `requireAuth` accepts
the JWT as a `?token=` query parameter as a fallback, used only for these
download links. **Trade-off, stated plainly**: this means the token
briefly appears in the URL for that one request (and so potentially in
server access logs). For a school records system this is a reasonable
trade-off for now, but if this ever needs tightening, the fix is having
the frontend `fetch()` the PDF with a proper header and trigger the
download from a Blob instead — more code, slightly better hygiene.


## Why curriculum isn't hardcoded

Official KICD curriculum designs define the specific subjects taught at
each grade level, but the exact set can vary and I don't have verified,
comprehensive access to every subject across every grade band. This is a
tool real teachers will use to assess real children, so guessing wrong
would be actively harmful, not just inconvenient. Subjects are configured
per school. What *is* hardcoded is the CBC rating **structure**
(EE/ME/AE/BE) and its **default percentage thresholds**, which come
directly from KNEC's own published grading table — that part is
verifiable and stable.

## CBC rating bands — source

Seeded from KNEC's own published grading table (confirmed via multiple
2025-2026 news reports on the KJSEA results, not guessed):

| Band | Range | Notes |
|---|---|---|
| EE — Exceeding Expectation | 75-100% | EE1: 90-100, EE2: 75-89 |
| ME — Meeting Expectation | 41-74% | ME1: 58-74, ME2: 41-57 |
| AE — Approaching Expectation | 21-40% | AE1: 31-40, AE2: 21-30 |
| BE — Below Expectation | 0-20% | BE1: 11-20, BE2: 0-10 |

These are only the *default* — each school can edit them freely via
`PUT /api/marking-scheme`.

## Testing note

I don't have a MongoDB instance or network access in my environment, so
the Express/Mongoose routes themselves are **not** end-to-end tested —
they're careful, syntax-checked code following Mongoose/Express patterns
correctly, but please test the actual API flows once deployed. The one
piece I could and did fully verify is the CBC rating engine itself
(`utils/cbcGradingEngine.js`) — tested directly against every boundary
value and against gap/overlap detection in a custom marking scheme, since
that's the part where a silent bug would be worst (wrong grades). All of
that passed.

## Data model

```
School (tenant)
 └─ User (school_admin | teacher, schoolId scoped)
 └─ AcademicYear → Term
 └─ GradeLevel (e.g. "Grade 4", educationLevel: lower-primary/upper-primary/junior-school/...)
     └─ Stream (a specific class, e.g. "Grade 4 Blue")
         └─ Student (admissionNumber, guardian info, current stream)
     └─ Subject (e.g. "Mathematics")
 └─ MarkingScheme (bands: EE/ME/AE/BE with editable min/max % + default comments)
 └─ TeacherAssignment (teacher ↔ subject ↔ stream — controls who can grade what)
 └─ AssessmentRecord (studentId, subjectId, termId, mark, comment) — one per student/subject/term
```

## API reference

All routes except `/health` and `/api/auth/*` require
`Authorization: Bearer <token>`.

### Auth

**POST `/api/auth/register-school`** — creates a school + its first admin.
```json
{
  "schoolName": "Greenfield Academy",
  "county": "Nairobi",
  "subCounty": "Westlands",
  "adminName": "Jane Wanjiru",
  "adminEmail": "jane@greenfield.ac.ke",
  "adminPassword": "at-least-8-chars",
  "adminPhone": "0712345678"
}
```

**POST `/api/auth/login`**
```json
{ "email": "jane@greenfield.ac.ke", "password": "..." }
```

### Staff (school_admin only)

- `POST /api/staff` — create a teacher account
- `GET /api/staff` — list all teachers
- `PATCH /api/staff/:id` — `{ "isActive": false }` to deactivate

### Curriculum

- `POST /api/curriculum/grade-levels` — `{ name, educationLevel, order }`
- `GET /api/curriculum/grade-levels`
- `POST /api/curriculum/streams` — `{ name, gradeLevelId, academicYearId, classTeacherId }`
- `GET /api/curriculum/streams?gradeLevelId=...`
- `POST /api/curriculum/subjects` — `{ name, code, gradeLevelId }`
- `GET /api/curriculum/subjects?gradeLevelId=...`

### Students

- `POST /api/students` — `{ admissionNumber, firstName, lastName, dateOfBirth, gender, gradeLevelId, streamId, guardianName, guardianPhone }`
- `GET /api/students?streamId=...&gradeLevelId=...&status=active`
- `GET /api/students/:id`
- `PATCH /api/students/:id`

### Academic years / terms

- `POST /api/academics/academic-years` — `{ name, isCurrent }`
- `GET /api/academics/academic-years`
- `POST /api/academics/terms` — `{ academicYearId, name, startDate, endDate, isCurrent }`
- `GET /api/academics/terms?academicYearId=...`

### Marking scheme

- `GET /api/marking-scheme`
- `PUT /api/marking-scheme` — `{ bands: [{ code, label, minPercent, maxPercent, defaultComment }, ...] }` (validated for gaps/overlaps before saving)

### Teacher assignments

- `POST /api/teacher-assignments` — `{ teacherId, subjectId, streamId }`
- `GET /api/teacher-assignments` (teachers see only their own; admins see all, or filter with `?teacherId=`)
- `DELETE /api/teacher-assignments/:id`

### Assessments (the core of the system)

**POST `/api/assessments`** — enter one mark:
```json
{
  "studentId": "...",
  "subjectId": "...",
  "termId": "...",
  "mark": 82,
  "comment": "Strong grasp of the concept."
}
```
`comment` is optional — omit it and the system fills in the marking
scheme's default comment for whichever band the mark falls into.

**POST `/api/assessments/bulk`** — enter marks for a whole class at once:
```json
{
  "subjectId": "...",
  "termId": "...",
  "entries": [
    { "studentId": "...", "mark": 82, "comment": "Great work" },
    { "studentId": "...", "mark": 55 }
  ]
}
```

**GET `/api/assessments/class/:subjectId/:streamId/:termId`** — the
gradebook view: every student in that class, their mark, band, and
comment for that subject/term.

**GET `/api/assessments/report/:studentId/:termId`** — full report card
data: every subject for that student's grade, each with its mark and CBC
band. PDF rendering is Phase 2 — this returns the complete underlying data.

### Reports (PDF)

- `GET /api/reports/student/:studentId/:termId/pdf` — downloadable report card PDF
- `GET /api/reports/class/:subjectId/:streamId/:termId/pdf` — one-subject class mark sheet PDF
- `GET /api/reports/class-ranking/:streamId/:termId` — JSON: every student's per-subject marks, total, mean mark, mean grade, and position
- `GET /api/reports/class-ranking/:streamId/:termId/pdf` — the downloadable version of the above

All PDF endpoints accept the JWT either as the usual `Authorization: Bearer` header, or as `?token=...` for plain `<a href>` download links (see the auth note above).

## Setup

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET
npm run dev
```

## Deploying to Render

Standard Node web service — no Docker needed (unlike the TikTok
downloader/Movie API projects, this has no system-level dependencies like
ffmpeg/yt-dlp). Build command: `npm install`. Start command: `npm start`.
Set `MONGODB_URI`, `JWT_SECRET`, and `CORS_ORIGIN` as environment
variables in Render's dashboard.

## Roadmap

- **Done**: Phase 1 (core system), Phase 2 (report card + class ranking
  PDFs), and a full frontend.
- **Next**: Timetable, attendance tracking.
- **Later**: Parent/student portal login, SMS notifications (fits your
  existing Daraja/M-Pesa integration patterns from other projects),
  multi-school access for teachers who work at more than one school,
  optional per-strand assessment for schools that want that level of
  detail.
