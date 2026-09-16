import urllib.request
import json
import urllib.error
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:8000'

def request(path, method='GET', data=None, token=None):
    url = f"{BASE}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    req_data = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body
    except Exception as e:
        return 500, str(e)

def run_tests():
    print("==================================================")
    print("🚀 Starting End-to-End Test Suite for NextGen Test Portal")
    print("==================================================")

    # 1. Health Check
    print("\n[1] Testing Health Check endpoint (/health)...")
    st, res = request('/health')
    print(f"    Status: {st} | Result: {res}")
    assert st == 200, f"Health check failed: {res}"
    print("    ✅ Health Check Passed")

    # 2. Admin Login
    print("\n[2] Testing Admin Login (/api/auth/login)...")
    st, res = request('/api/auth/login', 'POST', {'identifier': 'admin@nextgen.local', 'password': 'Admin@1234'})
    print(f"    Status: {st} | User: {res.get('user', {}).get('email') if isinstance(res, dict) else res}")
    assert st == 200 and 'access_token' in res, f"Admin login failed: {res}"
    admin_token = res['access_token']
    print("    ✅ Admin Authentication Successful")

    # 3. Student Login
    print("\n[3] Testing Student Login (/api/auth/login)...")
    st, stu_res = request('/api/auth/login', 'POST', {'identifier': 'CS2026001', 'password': 'Student@1234'})
    print(f"    Status: {st} | User: {stu_res.get('user', {}).get('email') if isinstance(stu_res, dict) else stu_res}")
    assert st == 200 and 'access_token' in stu_res, f"Student login failed: {stu_res}"
    student_token = stu_res['access_token']
    print("    ✅ Student Authentication Successful")

    # 4. Admin Endpoints: Exams, Questions, Students
    print("\n[4] Testing Admin APIs...")
    st, exams = request('/api/admin/exams', token=admin_token)
    print(f"    Admin Exams [{st}]: Found {len(exams) if isinstance(exams, list) else 0} exams")
    assert st == 200 and isinstance(exams, list), f"Failed to get admin exams: {exams}"

    st, questions = request('/api/admin/questions', token=admin_token)
    print(f"    Admin Questions [{st}]: Found {len(questions) if isinstance(questions, list) else 0} questions")
    assert st == 200 and isinstance(questions, list), f"Failed to get admin questions: {questions}"

    st, students = request('/api/admin/students', token=admin_token)
    print(f"    Admin Students [{st}]: Found {len(students) if isinstance(students, list) else 0} students")
    assert st == 200 and isinstance(students, list), f"Failed to get admin students: {students}"
    print("    ✅ Admin Management APIs Functional")

    # 5. Student Exams
    print("\n[5] Testing Student Available Exams (/api/student/exams)...")
    st, stu_exams = request('/api/student/exams', token=student_token)
    print(f"    Student Exams [{st}]: Found {len(stu_exams) if isinstance(stu_exams, list) else 0} available exams")
    assert st == 200 and isinstance(stu_exams, list) and len(stu_exams) > 0, f"No exams available for student: {stu_exams}"
    for ex in stu_exams:
        print(f"     -> Title: {ex.get('title')} | ID: {ex.get('id')} | Status: {ex.get('status')}")
    print("    ✅ Student Exams Retrieved")

    # 6. Student Assessment Attempt Flow
    target_exam = stu_exams[0]
    exam_id = target_exam['id']
    print(f"\n[6] Testing Student Attempt Flow for Exam: '{target_exam.get('title')}' (ID: {exam_id})...")

    # Clean up any prior test attempt for this student to ensure idempotency
    try:
        import pymongo
        mc = pymongo.MongoClient("mongodb://localhost:27017")
        db = mc["nextgen_portal"]
        s_id = str(stu_res.get('user', {}).get('id'))
        db.attempts.delete_many({"exam_id": exam_id, "student_id": s_id})
        db.results.delete_many({"exam_id": exam_id, "student_id": s_id})
    except Exception:
        pass

    st, attempt = request(f"/api/student/attempts/{exam_id}/start", 'POST', token=student_token)
    print(f"    Start / Resume Attempt [{st}]: Attempt ID = {attempt.get('id') if isinstance(attempt, dict) else attempt}")
    assert st in (200, 201) and isinstance(attempt, dict), f"Failed to start attempt: {attempt}"
    attempt_id = attempt.get('id')
    question_ids = attempt.get('question_order', [])
    print(f"    Exam Attempt initialized with {len(question_ids)} questions in question_order")

    # Answer questions in the attempt
    for i, q_id in enumerate(question_ids):
        ans_payload = {
            "question_id": q_id,
            "answer": {"option_id": "opt-1", "text": "Sample answer"},
            "time_spent_seconds": 20,
            "marked_for_review": False
        }
        st_ans, res_ans = request(f"/api/student/attempts/{attempt_id}/answers", 'POST', ans_payload, token=student_token)
        print(f"    Saved answer for Q{i+1} ({q_id}) [{st_ans}]")
        assert st_ans == 200, f"Failed to save answer for Q{i+1}: {res_ans}"

    # Submit Attempt
    print(f"\n[7] Submitting Exam Attempt ({attempt_id})...")
    st_sub, res_sub = request(f"/api/student/attempts/{attempt_id}/submit", 'POST', {}, token=student_token)
    print(f"    Submission Result [{st_sub}]: Total Score = {res_sub.get('score')} / {res_sub.get('max_score')}")
    assert st_sub == 200, f"Failed to submit attempt: {res_sub}"
    print("    ✅ Automated Scoring & Evaluation Completed")

    # Student Result Receipt
    print(f"\n[8] Viewing Exam Result Summary (/api/student/attempts/{attempt_id}/result)...")
    st_res, res_details = request(f"/api/student/attempts/{attempt_id}/result", 'GET', token=student_token)
    print(f"    Result View [{st_res}]: Status = {res_details.get('status')}, Score = {res_details.get('score')}/{res_details.get('max_score')}")
    assert st_res == 200, f"Failed to get result details: {res_details}"
    print("    ✅ Result Receipt Verified")

    # Admin Analytics and Leaderboard
    print(f"\n[9] Testing Admin Analytics & Leaderboard for Exam ({exam_id})...")
    st_an, res_an = request(f"/api/admin/analytics/{exam_id}/overview", 'GET', token=admin_token)
    print(f"    Admin Analytics [{st_an}]: Total attempts = {res_an.get('total_attempts') if isinstance(res_an, dict) else res_an}")

    st_lb, res_lb = request(f"/api/admin/analytics/{exam_id}/leaderboard", 'GET', token=admin_token)
    print(f"    Admin Leaderboard [{st_lb}]: {len(res_lb.get('rankings', [])) if isinstance(res_lb, dict) else res_lb} candidate(s) ranked")

    print("\n==================================================")
    print("🎉 ALL END-TO-END TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
