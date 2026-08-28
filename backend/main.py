import os
import sys

# Ensure project root and backend folder are in Python path
cwd = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(cwd)

for p in [cwd, root]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
