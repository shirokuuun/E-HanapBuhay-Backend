# e-HanapBuhay Backend API

Node.js + Express + PostgreSQL REST API for the e-HanapBuhay Flutter app.

---

## Project Structure

```
ehanapbuhay-backend/
├── src/
│   ├── config/
│   │   └── db.js                  # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── authController.js      # register, login, google auth
│   │   ├── jobsController.js      # list & get jobs
│   │   ├── applicationsController.js
│   │   ├── savedJobsController.js
│   │   └── profileController.js
│   ├── middleware/
│   │   ├── auth.js                # JWT verification
│   │   ├── errorHandler.js        # Global error + response helpers
│   │   └── upload.js              # Multer file upload config
│   ├── routes/
│   │   ├── auth.js
│   │   ├── jobs.js
│   │   ├── applications.js
│   │   ├── savedJobs.js
│   │   └── profile.js
│   ├── utils/
│   │   └── jwt.js
│   ├── app.js                     # Express app setup
│   └── server.js                  # Entry point
├── sql/
│   └── schema.sql                 # All tables + seed data
├── api_service.dart               # Drop this into your Flutter project
├── .env.example
└── package.json
```

---

## Setup

### 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 2. Create the Database

```bash
psql -U postgres
CREATE DATABASE ehanapbuhay;
\q
```

### 3. Run the Schema

```bash
psql -U postgres -d ehanapbuhay -f sql/schema.sql
```

This creates all tables and inserts seed data including a test user:
- **Email:** test@gmail.com
- **Password:** test123

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ehanapbuhay
DB_USER=postgres
DB_PASSWORD=your_actual_password
JWT_SECRET=change_this_to_something_long_and_random
JWT_EXPIRES_IN=7d
```

### 5. Install & Run

```bash
npm install
npm run dev      # development (auto-restart on save)
npm start        # production
```

You should see:
```
✅ Connected to PostgreSQL
✅ Database connection verified
🚀 e-HanapBuhay API running on http://localhost:3000
```

---

## API Reference

All responses follow this shape:
```json
{ "success": true, "message": "...", "data": { ... } }
{ "success": false, "message": "Error description" }
```

### AUTH

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| POST | `/api/auth/google` | ❌ | Google OAuth |
| GET  | `/api/auth/me` | ✅ | Current user info |

**Register body:**
```json
{
  "full_name": "Juan Dela Cruz",
  "email": "juan@email.com",
  "password": "secret123",
  "location": "Quezon City",
  "phone": "+63 917 123 4567"
}
```

**Login body:**
```json
{ "email": "juan@email.com", "password": "secret123" }
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": { "id": "...", "full_name": "Juan Dela Cruz", "email": "...", "role": "jobseeker" }
  }
}
```

---

### JOBS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/jobs` | Optional | List jobs |
| GET | `/api/jobs/:id` | Optional | Job detail |

**Query params for GET /api/jobs:**
- `work_setup` — `Remote`, `Onsite`, or `Hybrid`
- `search` — search by title or company name
- `page` — pagination (default 1)

---

### APPLICATIONS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/applications` | ✅ | My applications |
| POST | `/api/applications` | ✅ | Submit application (multipart) |
| PATCH | `/api/applications/:id/status` | ✅ | Update status |

**GET query params:**
- `status` — `applied`, `viewed`, `accepted`, `rejected`

**POST** is `multipart/form-data` with these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `job_id` | ✅ | Job UUID |
| `applicant_first_name` | ✅ | |
| `applicant_last_name` | ✅ | |
| `applicant_phone` | ✅ | |
| `applicant_email` | ✅ | |
| `applicant_location` | ✅ | |
| `resume` | ✅ | PDF/DOC/DOCX file |
| `cover_letter` | ❌ | PDF/DOC/DOCX file |
| `job_title` | ✅ | Applicant's current/past title |
| `company_name` | ❌ | |
| `work_from` | ❌ | YYYY-MM-DD |
| `work_to` | ❌ | YYYY-MM-DD |
| `currently_working` | ❌ | `true`/`false` |
| `school_name` | ✅ | |
| `edu_from` | ❌ | YYYY-MM-DD |
| `edu_to` | ❌ | YYYY-MM-DD |

---

### SAVED JOBS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/saved-jobs` | ✅ | My saved jobs |
| POST | `/api/saved-jobs` | ✅ | Save a job |
| DELETE | `/api/saved-jobs/:jobId` | ✅ | Remove saved job |

**POST body:** `{ "job_id": "uuid-here" }`

---

### PROFILE

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/profile` | ✅ | Get profile |
| PUT | `/api/profile` | ✅ | Update profile |
| POST | `/api/profile/avatar` | ✅ | Upload avatar (multipart) |

**PUT body:**
```json
{ "full_name": "...", "location": "...", "phone": "..." }
```

---

## Integrating with Flutter

### 1. Copy the service file

Copy `api_service.dart` → `your_flutter_project/lib/services/api_service.dart`

### 2. Add dependencies to pubspec.yaml

```yaml
dependencies:
  http: ^1.2.0
  shared_preferences: ^2.2.3
```

### 3. Set the correct base URL

In `api_service.dart`, update `baseUrl`:

```dart
// Android emulator (default)
static const String baseUrl = 'http://10.0.2.2:3000/api';

// iOS Simulator
static const String baseUrl = 'http://localhost:3000/api';

// Real device — use your machine's local IP
static const String baseUrl = 'http://192.168.1.X:3000/api';
```

### 4. Replace mock data in your screens

**LoginScreen** (`login_screen.dart`):
```dart
void _handleLogin() async {
  if (_formKey.currentState!.validate()) {
    final result = await ApiService.login(
      email: _emailController.text,
      password: _passwordController.text,
    );
    if (result.success) {
      Navigator.pushReplacementNamed(context, '/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Login failed')),
      );
    }
  }
}
```

**HomeScreen** — replace `_mockJobs`:
```dart
@override
void initState() {
  super.initState();
  _fetchJobs();
}

Future<void> _fetchJobs() async {
  final result = await ApiService.getJobs(workSetup: _selectedFilter == 'Remote only' ? 'Remote' : 'Onsite');
  if (result.success && mounted) {
    setState(() {
      _jobs = List<Map<String, dynamic>>.from(result.data!['jobs']);
    });
  }
}
```

**AppliedJobsScreen** — replace `_mockApplications`:
```dart
Future<void> _fetchApplications() async {
  final result = await ApiService.getApplications(status: _selectedFilter);
  if (result.success && mounted) {
    setState(() => _applications = result.data!);
  }
}
```

**ApplyScreen** — replace the mock submit in `_next()`:
```dart
// In _next(), when _currentStep == _totalSteps - 1:
final result = await ApiService.submitApplication(
  jobId: widget.job['id'],
  firstName: _firstNameController.text,
  lastName: _lastNameController.text,
  phone: _phoneController.text,
  email: _emailController.text,
  location: _locationController.text,
  resumeFile: _resumeFile != null ? File(_resumeFile!.path!) : null,
  coverLetterFile: _coverLetterFile != null ? File(_coverLetterFile!.path!) : null,
  jobTitle: _jobTitleController.text,
  companyName: _companyController.text,
  workFrom: _workFrom,
  workTo: _workTo,
  currentlyWorking: _currentlyWorkHere,
  schoolName: _educationController.text,
  degree: _degreeController.text,
  major: _majorController.text,
  eduFrom: _eduFrom,
  eduTo: _eduTo,
  currentlyStudying: _currentlyAttend,
);
```

---

## Android Network Permission

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

For HTTP (not HTTPS) on Android, also add inside `<application>`:
```xml
android:usesCleartextTraffic="true"
```
