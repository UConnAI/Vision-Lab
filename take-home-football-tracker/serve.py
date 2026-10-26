"""Local-only, dependency-free server for the standalone portfolio starter."""
import functools
import http.server
from pathlib import Path

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs':'text/javascript', '.mp4':'video/mp4'}

if __name__ == '__main__':
    root=Path(__file__).resolve().parent
    server=http.server.ThreadingHTTPServer(('127.0.0.1',4324),functools.partial(Handler,directory=str(root)))
    print('Ball Remix: http://127.0.0.1:4324/index.html\nKeep this window open. Stop with Ctrl+C.',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
