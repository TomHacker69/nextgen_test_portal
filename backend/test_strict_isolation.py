import sys
import requests

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_BASE = "http://localhost:8000"
FRONTEND_BASE = "http://localhost:3000"

print("=" * 70, flush=True)
print("RUNNING COMPREHENSIVE STRICT ISOLATION & SECURITY VERIFICATION", flush=True)
print("=" * 70, flush=True)

all_passed = True

def check(condition, message):
    global all_passed
    if condition:
        print(f"  [PASS] {message}", flush=True)
    else:
        print(f"  [FAIL] {message}", flush=True)
        all_passed = False

# 1. Admin Login with valid admin credentials
print("\n[Phase 1] Admin Gateway Authentication", flush=True)
res = requests.post(f"{BACKEND_BASE}/api/auth/admin-login", json={"identifier": "admin@nextgen.local", "password": "Admin@1234"}, timeout=5)
check(res.status_code == 200, f"Admin login successful: {res.status_code}")
admin_token = res.json().get("access_token")
admin_role = res.json().get("user", {}).get("role")
check(admin_role == "admin", f"Admin user role is admin: {admin_role}")

# 2. Student trying to authenticate via Admin Gateway
print("\n[Phase 2] Student Blocked at Admin Gateway", flush=True)
res = requests.post(f"{BACKEND_BASE}/api/auth/admin-login", json={"identifier": "CS2026001", "password": "Student@1234"}, timeout=5)
check(res.status_code in [401, 403], f"Roll number rejected at admin login: {res.status_code}")

res_email = requests.post(f"{BACKEND_BASE}/api/auth/admin-login", json={"identifier": "devin@student.local", "password": "Student@1234"}, timeout=5)
check(res_email.status_code == 403, f"Student email blocked with 403 Forbidden at admin gateway: {res_email.status_code}")
check("Candidate accounts cannot access" in res_email.text or "Access Denied" in res_email.text, f"Informative 403 message: {res_email.text}")

# 3. Student Gateway Authentication
print("\n[Phase 3] Candidate Gateway Authentication", flush=True)
res = requests.post(f"{BACKEND_BASE}/api/auth/student-login", json={"identifier": "CS2026001", "password": "Student@1234"}, timeout=5)
check(res.status_code == 200, f"Student login successful: {res.status_code}")
student_token = res.json().get("access_token")
student_role = res.json().get("user", {}).get("role")
check(student_role == "student", f"Candidate user role is student: {student_role}")

# 4. Admin trying to authenticate via Candidate Gateway
print("\n[Phase 4] Admin Blocked at Candidate Gateway", flush=True)
res = requests.post(f"{BACKEND_BASE}/api/auth/student-login", json={"identifier": "admin@nextgen.local", "password": "Admin@1234"}, timeout=5)
check(res.status_code == 403, f"Admin account blocked with 403 at candidate gateway: {res.status_code}")

# 5. URL-Level Isolation via Middleware (Student hitting Admin URLs)
print("\n[Phase 5] Frontend Middleware: Student Accessing Admin URLs", flush=True)
student_cookies = {"access_token": student_token, "user_role": "student"}

for admin_path in ["/admin", "/admin/dashboard", "/admin/exams", "/admin/students", "/admin/questions", "/admin/login"]:
    r = requests.get(f"{FRONTEND_BASE}{admin_path}", cookies=student_cookies, allow_redirects=False, timeout=5)
    redirect_loc = r.headers.get("location", "")
    check(r.status_code == 307 and "/403" in redirect_loc, f"Student accessing {admin_path} -> 307 Redirected to {redirect_loc}")

# 6. Backend API-Level Isolation (Student calling Admin API endpoints)
print("\n[Phase 6] Backend API Armor: Student Calling Admin APIs", flush=True)
student_headers = {"Authorization": f"Bearer {student_token}"}
for endpoint in ["/api/admin/exams", "/api/admin/students", "/api/admin/questions"]:
    r = requests.get(f"{BACKEND_BASE}{endpoint}", headers=student_headers, timeout=5)
    check(r.status_code == 403, f"Student calling {endpoint} -> HTTP {r.status_code} Forbidden")

# 7. UI Leak Prevention (Zero admin references in student login HTML)
print("\n[Phase 7] UI Discovery Isolation", flush=True)
r = requests.get(f"{FRONTEND_BASE}/login", timeout=5)
check("/admin/login" not in r.text, "Student login page contains NO link to /admin/login")
check("Administrator / Proctor Command Center" not in r.text, "Student login page contains NO admin command center text")

r_admin = requests.get(f"{FRONTEND_BASE}/admin/login", timeout=5)
check("Go to Student Portal" not in r_admin.text, "Admin login page contains NO candidate portal link")

# 8. 403 Page Verification
print("\n[Phase 8] 403 Security Alert Page", flush=True)
r_403 = requests.get(f"{FRONTEND_BASE}/403", cookies=student_cookies, timeout=5)
check(r_403.status_code == 200, f"403 Security page responds 200 OK: {r_403.status_code}")
check("Access Denied" in r_403.text, "403 Page displays Access Denied")
check("Candidate Portal" in r_403.text, "403 Page has return button to Candidate Portal")

print("\n" + "=" * 70, flush=True)
if all_passed:
    print("ALL ISOLATION & SECURITY CHECKS PASSED WITH 100% SUCCESS!", flush=True)
else:
    print("SOME CHECKS FAILED! INVESTIGATE ABOVE.", flush=True)
print("=" * 70, flush=True)
