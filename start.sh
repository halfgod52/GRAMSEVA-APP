#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GramSeva Health — Startup Script
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Trap SIGINT to kill all child processes on exit
cleanup() {
    echo -e "\nShutting down all servers..."
    kill 0
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "▶ Starting core AI Triage backend (Port 8000)..."
PYTHONPATH="$SCRIPT_DIR/backend" uvicorn backend.server:app --reload --port 8000 --host 0.0.0.0 &

# Give it a moment to initialize
sleep 2

echo "▶ Starting Kaggle CNN Chest X-Ray backend (Port 8001)..."
PYTHONPATH="$SCRIPT_DIR/backend" uvicorn backend.train_chest_xray_server:app --reload --port 8001 --host 0.0.0.0 &

# Give it a moment to initialize
sleep 2

echo "▶ Starting Vite Frontend (Port 5173)..."
cd "$SCRIPT_DIR/frontend"
npm run dev

# Wait for all background processes
wait
