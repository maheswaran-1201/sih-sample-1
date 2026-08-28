import subprocess
import sys
import time
import os

def main():
    print("=" * 60)
    print("        RailETA AI Prototype Launch Script")
    print("=" * 60)
    print("1. Launching FastAPI Backend on http://localhost:8000 ...")
    
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=os.getcwd()
    )

    time.sleep(3)

    print("2. Launching Next.js Frontend on http://localhost:3000 ...")
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    frontend_proc = subprocess.Popen(
        ["cmd.exe", "/c", "npm run dev"],
        cwd=frontend_dir
    )

    print("\nRailETA AI Prototype is now running!")
    print(" - Backend API & WebSockets: http://localhost:8000")
    print(" - Frontend Dashboard:      http://localhost:3000")
    print(" - API Documentation:       http://localhost:8000/docs")
    print("=" * 60)

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping RailETA AI prototype services...")
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    main()
