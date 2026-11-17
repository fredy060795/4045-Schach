#!/usr/bin/env python3
"""Schach für zwei Personen – kleiner Server ohne externe Abhängigkeiten."""
import json
import os
import socket
import sys
import threading
import webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", 5045))
HERE = os.path.dirname(os.path.abspath(__file__))
FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/chess.js": ("chess.js", "application/javascript; charset=utf-8"),
}

lock = threading.Lock()
game = {"moves": [], "version": 0, "seats": {"w": None, "b": None}, "result": None}


def mine(token):
    return [c for c in "wb" if token and game["seats"][c] == token]


def state(token):
    return {
        "moves": game["moves"],
        "version": game["version"],
        "seats": {c: game["seats"][c] is not None for c in "wb"},
        "mine": mine(token),
        "result": game["result"],
    }


def bump():
    game["version"] += 1


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in FILES:
            name, ctype = FILES[u.path]
            with open(os.path.join(HERE, name), "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif u.path == "/api/state":
            token = parse_qs(u.query).get("token", [None])[0]
            with lock:
                self.send_json(state(token))
        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self.send_json({"error": "bad request"}, 400)
        token = str(data.get("token") or "")[:64] or None
        code = 200
        with lock:
            seats = game["seats"]
            my = mine(token)
            if path == "/api/join":
                if not my and token:
                    for c in "wb":
                        if seats[c] is None:
                            seats[c] = token
                            bump()
                            break
            elif path == "/api/claim":
                # alle freien Farben übernehmen (beide Spieler an einem Gerät)
                if token:
                    for c in "wb":
                        if seats[c] is None:
                            seats[c] = token
                    bump()
            elif path == "/api/move":
                turn = "w" if len(game["moves"]) % 2 == 0 else "b"
                f, t, promo = data.get("from"), data.get("to"), data.get("promo")
                ok = (
                    game["result"] is None
                    and turn in my
                    and data.get("ply") == len(game["moves"])
                    and isinstance(f, int) and isinstance(t, int)
                    and 0 <= f < 64 and 0 <= t < 64
                    and promo in (None, "Q", "R", "B", "N")
                )
                if ok:
                    game["moves"].append({"from": f, "to": t, "promo": promo})
                    bump()
                else:
                    code = 409
            elif path == "/api/resign":
                if game["result"] is None and my:
                    turn = "w" if len(game["moves"]) % 2 == 0 else "b"
                    loser = turn if turn in my else my[0]
                    game["result"] = {"type": "resign", "loser": loser}
                    bump()
            elif path == "/api/reset":
                if my or (seats["w"] is None and seats["b"] is None):
                    if data.get("swap"):
                        seats["w"], seats["b"] = seats["b"], seats["w"]
                    game["moves"] = []
                    game["result"] = None
                    bump()
            elif path == "/api/free":
                seats["w"] = seats["b"] = None
                game["moves"] = []
                game["result"] = None
                bump()
            else:
                return self.send_error(404)
            self.send_json(state(token), code)


def local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    ip = local_ip()
    print("=" * 52)
    print("  Schach-Server laeuft")
    print(f"  Auf diesem PC:      http://localhost:{PORT}")
    if ip:
        print(f"  Im Netzwerk (WLAN): http://{ip}:{PORT}")
    print("  Beenden mit Strg+C")
    print("=" * 52)
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")


if __name__ == "__main__":
    main()
