#!/usr/bin/env python3
"""Zero-dependency static server for the WACRM CMS build.

    python3 serve.py            # http://localhost:4173
    PORT=8080 python3 serve.py  # custom port

Serves WACRM-CMS.html at "/" so the app opens without typing a filename.
No npm, no node_modules, no build step — the HTML is fully self-contained.
"""
import http.server, socketserver, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ENTRY = "WACRM-CMS.html"
PORT = int(os.environ.get("PORT", "4173"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        if self.path in ("/", "/index.html", "/app"):
            self.path = "/" + ENTRY
        return super().do_GET()

    def end_headers(self):
        # the app is a single self-contained file; never let a stale copy stick
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    if not os.path.exists(os.path.join(ROOT, ENTRY)):
        sys.exit("Missing %s — run `npm install && npm run build` first." % ENTRY)
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print("WACRM Website CMS → http://localhost:%d  (ctrl-c to stop)" % PORT)
        httpd.serve_forever()
