@echo off
REM Launcher for the scheduled task.
REM
REM Task Scheduler cannot run a .mjs directly and gives no console window if
REM it invokes node.exe headlessly. This wrapper gives the run a real window,
REM which is the whole point: the tool has to ask you something.
REM
REM %~dp0 is this file's directory, so the task works regardless of where it
REM is launched from.

cd /d "%~dp0.."
node "social\run.mjs" %*

REM run.mjs holds the window open on its own when stdin is a TTY. This is the
REM backstop for the case where it exits before reaching that point - without
REM it, a startup crash would flash past unread.
if errorlevel 1 pause
