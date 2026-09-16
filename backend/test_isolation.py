import urllib.request
import urllib.error
import http.cookiejar
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FRONTEND = 'http://localhost:3000'
BACKEND = 'http://localhost:8000'

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Do not follow redirect so we can inspect status 307/308 and Location header
        return None

opener = urllib.request.build_opener(NoRedirectHandler)

def check_url(path, cookies=None):
    req = urllib.request.Request(f"{FRONTEND}{path}")
    if cookies:
        cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])
        req.add_header('Cookie', cookie_str)
    try:
        resp = opener.open(req)
        return resp.status, resp.headers.get('Location')
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Location')
    except Exception as e:
        return 500, str(e)

def test_isolation():
    print("==================================================")
    print("🛡️ Testing Student vs Admin Isolation Mechanisms")
    print("==================================================")

    # 1. Unauthenticated access to /admin/dashboard
    print("\n[Scenario 1] Unauthenticated user visits /admin/dashboard...")
    st, loc = check_url('/admin/dashboard')
    print(f"    Status: {st} | Redirect Location: {loc}")
    assert st in (307, 308) and '/admin/login' in loc, f"Expected redirect to /admin/login, got {loc}"
    print("    ✅ Unauthenticated user correctly blocked & redirected to /admin/login")

    # 2. Student attempts to access /admin/dashboard
    print("\n[Scenario 2] Student attempts to access /admin/dashboard...")
    st, loc = check_url('/admin/dashboard', cookies={'user_role': 'student', 'access_token': 'dummy.student.token'})
    print(f"    Status: {st} | Redirect Location: {loc}")
    assert st in (307, 308) and '/403' in loc, f"Expected hard block to /403, got {loc}"
    print("    ✅ Student is HARD BLOCKED by server middleware & redirected to /403!")

    # 3. Student attempts to access /admin/exams
    print("\n[Scenario 3] Student attempts to access /admin/exams...")
    st, loc = check_url('/admin/exams', cookies={'user_role': 'student', 'access_token': 'dummy.student.token'})
    print(f"    Status: {st} | Redirect Location: {loc}")
    assert st in (307, 308) and '/403' in loc, f"Expected hard block to /403, got {loc}"
    print("    ✅ Student is HARD BLOCKED from /admin/exams as well!")

    # 4. Unauthenticated access to /student/dashboard
    print("\n[Scenario 4] Unauthenticated user visits /student/dashboard...")
    st, loc = check_url('/student/dashboard')
    print(f"    Status: {st} | Redirect Location: {loc}")
    assert st in (307, 308) and '/login' in loc, f"Expected redirect to /login, got {loc}"
    print("    ✅ Unauthenticated user redirected to student /login")

    # 5. Admin visits /student/dashboard
    print("\n[Scenario 5] Admin visits /student/dashboard...")
    st, loc = check_url('/student/dashboard', cookies={'user_role': 'admin', 'access_token': 'dummy.admin.token'})
    print(f"    Status: {st} | Redirect Location: {loc}")
    assert st in (307, 308) and '/admin/dashboard' in loc, f"Expected redirect to /admin/dashboard, got {loc}"
    print("    ✅ Admin redirected to admin dashboard")

    # 6. Verify 403 page itself renders 200 OK
    print("\n[Scenario 6] Verifying /403 Forbidden page availability...")
    st, loc = check_url('/403')
    print(f"    Status: {st}")
    assert st == 200, f"Expected 200 on /403, got {st}"
    print("    ✅ 403 Forbidden page rendered successfully")

    # 7. Verify /admin/login page renders 200 OK
    print("\n[Scenario 7] Verifying /admin/login page availability...")
    st, loc = check_url('/admin/login')
    print(f"    Status: {st}")
    assert st == 200, f"Expected 200 on /admin/login, got {st}"
    print("    ✅ /admin/login rendered successfully")

    # 8. Verify /login (Student portal) page renders 200 OK
    print("\n[Scenario 8] Verifying /login page availability...")
    st, loc = check_url('/login')
    print(f"    Status: {st}")
    assert st == 200, f"Expected 200 on /login, got {st}"
    print("    ✅ /login rendered successfully")

    print("\n==================================================")
    print("🎉 ALL 8 ISOLATION SCENARIOS VERIFIED & PASSED!")
    print("==================================================")

if __name__ == '__main__':
    test_isolation()
