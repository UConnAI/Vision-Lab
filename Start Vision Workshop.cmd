@echo off
cd /d "%~dp0"
py -3 --version >nul 2>&1
if not errorlevel 1 (
  py -3 serve.py
  goto done
)
python --version >nul 2>&1
if not errorlevel 1 (
  python serve.py
  goto done
)
echo Python 3 is required. Install it from https://www.python.org/downloads/ then try again.
:done
pause
