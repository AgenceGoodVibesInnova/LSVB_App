"""Faux serveur SumUp pour les tests locaux (port 4010). POST /checkouts, GET /checkouts/<id>, POST /_set/<id>/<STATUS>."""
import json, uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
DB = {}
class H(BaseHTTPRequestHandler):
    def _out(self, code, data):
        b = json.dumps(data).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0); body = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/checkouts":
            if not self.headers.get("authorization", "").startswith("Bearer sk_test"): return self._out(401, {"message": "bad key"})
            cid = str(uuid.uuid4()); DB[cid] = {**body, "id": cid, "status": "PENDING"}; return self._out(201, DB[cid])
        if self.path.startswith("/_set/"):
            _, _, cid, st = self.path.split("/"); DB[cid]["status"] = st
            if len(self.path.split("/")) > 4: pass
            return self._out(200, DB[cid])
        if self.path.startswith("/_amount/"):
            _, _, cid, amt = self.path.split("/"); DB[cid]["amount"] = float(amt); return self._out(200, DB[cid])
        self._out(404, {})
    def do_GET(self):
        cid = self.path.rsplit("/", 1)[-1]
        if self.path.startswith("/checkouts/") and cid in DB: return self._out(200, DB[cid])
        if self.path == "/_all": return self._out(200, DB)
        self._out(404, {"message": "not found"})
HTTPServer(("127.0.0.1", 4010), H).serve_forever()
