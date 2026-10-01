@echo off
setlocal enabledelayedexpansion

REM =======================================================
REM  CymaSpace Website - Build, Spider & Local Audit Suite
REM =======================================================

echo.
echo ==================================================
echo   CYMASPACE WEBSITE POST-BUILD ^& RELEASE TEST SUITE
echo ==================================================
echo.

REM Parse arguments
set QUICK=0
set AUDIT_ONLY=0
set AUDIT_FLAGS=

:parse_args
if "%~1"=="" goto end_args
if /i "%~1"=="--quick" (
    set QUICK=1
) else if /i "%~1"=="-q" (
    set QUICK=1
) else if /i "%~1"=="--audit-only" (
    set AUDIT_ONLY=1
) else if /i "%~1"=="--mobile" (
    set AUDIT_FLAGS=!AUDIT_FLAGS! --mobile
) else if /i "%~1"=="--both" (
    set AUDIT_FLAGS=!AUDIT_FLAGS! --both
) else if /i "%~1"=="--desktop" (
    set AUDIT_FLAGS=!AUDIT_FLAGS! --desktop
) else (
    set AUDIT_FLAGS=!AUDIT_FLAGS! %~1
)
shift
goto parse_args
:end_args

if %AUDIT_ONLY%==1 goto run_audit

REM ----------------------------------------------------
REM Step 1: Minify & Bundle Assets (CSS & JS)
REM ----------------------------------------------------
echo [1/3] Minifying CSS and JavaScript bundles...
node scripts/build-assets.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Asset minification failed!
    exit /b %ERRORLEVEL%
)

REM ----------------------------------------------------
REM Step 2: Spider & Validate All Links, Anchors, Assets
REM ----------------------------------------------------
echo.
echo [2/3] Spidering repository and validating 2,400+ links and media...
node scripts/check-links.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Dead links or broken assets detected! Please resolve the errors above.
    exit /b %ERRORLEVEL%
)

REM Check if --quick was requested
if %QUICK%==1 goto skip_audit

:run_audit
REM ----------------------------------------------------
REM Step 3: Run Local Google PageSpeed / Lighthouse Audit
REM ----------------------------------------------------
echo.
echo [3/3] Running local Google PageSpeed / Lighthouse audit...
node scripts/audit-pagespeed.js %AUDIT_FLAGS%
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Lighthouse audit encountered an error.
    exit /b %ERRORLEVEL%
)
goto success_finish

:skip_audit
echo.
echo [3/3] Skipping PageSpeed audit (--quick mode specified).

:success_finish
echo.
echo ==================================================
echo   ALL POST-BUILD CHECKS PASSED! READY FOR RELEASE!
echo ==================================================
echo.
echo Usage Tips:
echo   test.bat            - Runs full build, link spider, and desktop PageSpeed audit
echo   test.bat --quick    - Minifies and spiders links only (skips Lighthouse)
echo   test.bat --mobile   - Runs with Mobile emulation preset
echo   test.bat --both     - Runs both Desktop and Mobile audits
echo.

exit /b 0
