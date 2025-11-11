@echo off
REM Script de lancement pour Laser GRBL Controller
REM Ce fichier lance automatiquement l'application Electron

echo ========================================
echo   Laser GRBL Controller
echo   Demarrage de l'application...
echo ========================================
echo.

REM Verifier si Node.js est installe
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Node.js n'est pas installe!
    echo Veuillez installer Node.js depuis https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Verifier si le dossier node_modules existe
if not exist "node_modules" (
    echo Installation des dependances...
    echo Cela peut prendre quelques minutes la premiere fois...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERREUR: L'installation des dependances a echoue!
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Installation terminee!
    echo.
)

REM Lancer l'application
echo Lancement de l'application...
echo.
echo Pour arreter l'application, fermez la fenetre ou appuyez sur Ctrl+C
echo.

npm run dev

REM Si l'application se ferme, afficher un message
echo.
echo ========================================
echo   Application fermee
echo ========================================
echo.
pause
