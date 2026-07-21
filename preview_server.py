from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import sys


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return


def main():
    root = Path(__file__).resolve().parent
    os.chdir(root)
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    server = ThreadingHTTPServer(("0.0.0.0", port), QuietHandler)
    print(f"Preview server: http://127.0.0.1:{port}/")
    print("Close this window to stop the server.")
    server.serve_forever()


if __name__ == "__main__":
    main()
