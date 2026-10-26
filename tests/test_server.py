import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec=importlib.util.spec_from_file_location('vision_server',Path(__file__).resolve().parents[1]/'serve.py')
server=importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class ServerTests(unittest.TestCase):
    def test_windows_browser_resolution(self):
        with patch.object(server.Path,'is_file',return_value=True):
            name,command=server.browser_command('Windows')
            self.assertEqual(name,'Chrome')
            self.assertTrue(command[0].endswith('chrome.exe'))
    def test_mac_browser_resolution(self):
        with patch.object(server.Path,'is_dir',return_value=True):
            self.assertEqual(server.browser_command('Darwin'),('Chrome',['open','-a','Google Chrome']))
    def test_browser_url_passed_as_argument(self):
        with patch.object(server,'browser_command',return_value=('Chrome',['/path with spaces/chrome'])),patch.object(server.subprocess,'Popen') as launch:
            url='http://127.0.0.1:4322/index.html'
            self.assertEqual(server.open_browser(url),'Chrome')
            self.assertEqual(launch.call_args.args[0],['/path with spaces/chrome',url])
    def test_recovery_origin_restrictions(self):
        fake=SimpleNamespace(server=SimpleNamespace(server_port=4322),headers={'Origin':'http://127.0.0.1:4322','Host':'127.0.0.1:4322'})
        self.assertTrue(server.Handler.valid_origin(fake))
        fake.headers['Origin']='https://other.example'
        self.assertFalse(server.Handler.valid_origin(fake))

if __name__=='__main__':unittest.main()
