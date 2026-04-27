#!/bin/sh
# Start Python FastAPI backend on port 8080
uvicorn app.main:app --host 0.0.0.0 --port 8080 &
# Wait for Python to start
sleep 3
# Start Node.js frontend on port 5000
node dist/index.cjs
