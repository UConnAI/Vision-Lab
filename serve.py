"""Cross-platform local workshop server, browser launcher, and camera recovery."""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import webbrowser

ROOT = Path(__file__).resolve().parent

def browser_command(system=None):
    system = system or platform.system()
    if system == 'Windows':
        candidates = [('Chrome', Path(os.environ.get('PROGRAMFILES', 'C:/Program Files')) / 'Google/Chrome/Application/chrome.exe'),
                      ('Chrome', Path(os.environ.get('LOCALAPPDATA', '')) / 'Google/Chrome/Application/chrome.exe'),
                      ('Edge', Path(os.environ.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe'),
                      ('Edge', Path(os.environ.get('PROGRAMFILES', 'C:/Program Files')) / 'Microsoft/Edge/Application/msedge.exe')]
        for name, path in candidates:
            if path.is_file():
                return name, [str(path)]
    elif system == 'Darwin':
        for name, app in [('Chrome', 'Google Chrome'), ('Edge', 'Microsoft Edge'), ('Safari', 'Safari')]:
            if (Path('/Applications') / (app + '.app')).is_dir() or (Path.home() / 'Applications' / (app + '.app')).is_dir():
                return name, ['open', '-a', app]
    else:
        for binary in ('google-chrome', 'chromium', 'microsoft-edge', 'firefox'):
            if shutil.which(binary):
                return binary, [shutil.which(binary)]
    return 'default browser', None

def open_browser(url):
    name, command = browser_command()
    if command:
        subprocess.Popen(command + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif not webbrowser.open(url):
        raise RuntimeError('No browser could be launched. Copy the localhost URL into your browser.')
    return name

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.task': 'application/octet-stream'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def json_response(self, status, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def valid_origin(self):
        port = self.server.server_port
        origins = {f'http://127.0.0.1:{port}', f'http://localhost:{port}'}
        return self.headers.get('Origin') in origins and self.headers.get('Host') in {f'127.0.0.1:{port}', f'localhost:{port}'}
    def do_POST(self):
        if self.path != '/api/open-browser':
            return self.json_response(404, {'error': 'Unknown endpoint'})
        if not self.valid_origin():
            return self.json_response(403, {'error': 'This action must come from the local workshop page.'})
        try:
            name = open_browser(f'http://127.0.0.1:{self.server.server_port}/index.html')
            self.json_response(200, {'browser': name})
        except Exception as error:
            self.json_response(500, {'error': str(error)})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4322)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=str(ROOT)))
    except OSError as error:
        # An existing instance on the selected port is not assumed to be ours.
        raise SystemExit(f'Cannot start port {args.port}: {error}. Close the previous server or use --port 4323.')
    url = f'http://127.0.0.1:{args.port}/start.html'
    print(f'Workshop: {url}\nDemo: http://127.0.0.1:{args.port}/index.html\nKeep this window open. Press Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        try:
            print(f'Opened {open_browser(url)}', flush=True)
        except Exception as error:
            print(f'Browser launch failed: {error}\nOpen {url} manually.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
