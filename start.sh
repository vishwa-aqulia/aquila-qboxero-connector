#!/bin/sh
# Start Python backend on port 8080
python3 main.py &
# Start Node.js frontend on port 5000
node dist/index.cjs
