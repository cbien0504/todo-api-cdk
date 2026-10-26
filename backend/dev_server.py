"""Local stand-in for CloudFront → API Gateway → Lambda → DynamoDB, to run the app without AWS.

Usage (from the repo root, next to `npm run dev --prefix frontend`, which proxies /api here):
    python3 backend/dev_server.py [port]        # default 8787

Accounts and progress are kept in memory and lost when the server stops.
"""

import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from handler import GET_PROGRESS, LOGIN, LOGOUT, PATCH_PROGRESS, REGISTER, handle
from store import MemoryProgressTable

USER_PATH = r"/api/users/(?P<username>[^/]+)/progress"
ROUTES = [
    ("POST", re.compile(r"^/api/register$"), REGISTER),
    ("POST", re.compile(r"^/api/login$"), LOGIN),
    ("POST", re.compile(r"^/api/logout$"), LOGOUT),
    ("GET", re.compile(rf"^{USER_PATH}$"), GET_PROGRESS),
    ("PATCH", re.compile(rf"^{USER_PATH}/(?P<deck>[^/]+)$"), PATCH_PROGRESS),
]
TABLE = MemoryProgressTable()


class ApiHandler(BaseHTTPRequestHandler):
    def _serve(self) -> None:
        path = self.path.split("?")[0]
        route = next(((r, m) for method, pattern, r in ROUTES if method == self.command and (m := pattern.match(path))), None)
        if route is None:
            result = {"statusCode": 400, "headers": {"content-type": "application/json"}, "body": '{"error":"unknown_route"}'}
        else:
            name, match = route
            body = self.rfile.read(int(self.headers.get("content-length") or 0)).decode()
            cookies = [c.strip() for c in (self.headers.get("cookie") or "").split(";") if c.strip()]
            event = {"routeKey": name, "pathParameters": match.groupdict(), "body": body, "cookies": cookies}
            result = handle(event, TABLE)
        payload = result["body"].encode()
        self.send_response(result["statusCode"])
        for header, value in result["headers"].items():
            self.send_header(header, value)
        for cookie in result.get("cookies", []):
            self.send_header("set-cookie", cookie)
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = do_POST = do_PATCH = _serve


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    print(f"Study app API (in memory) on http://127.0.0.1:{port}/api")
    ThreadingHTTPServer(("127.0.0.1", port), ApiHandler).serve_forever()
