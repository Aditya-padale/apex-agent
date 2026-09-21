import os
import sys

# Ensure repository root and backend directory are in sys.path for Vercel Serverless Function imports
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.main import app

# Export app for Vercel Serverless Function engine
__all__ = ["app"]
