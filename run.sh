#!/usr/bin/env zsh

# =======================================================
#  K6 DASHBOARD AUTO RUN SCRIPT (ZSH VERSION)
#  Usage: ./run_k6.zsh path/to/test.js
#  Saves report near the test + copies only the NEW file
#  to Windows folder
# =======================================================

# ---------- 1) Validate input ----------
if [[ -z "$1" ]]; then
  echo "❌ ERROR: You must provide a JS test file."
  echo "Usage: ./run_k6.zsh src/user-endpoints/get-all-users.js"
  exit 1
fi

TEST_FILE="$1"

if [[ ! -f "$TEST_FILE" ]]; then
  echo "❌ ERROR: Test file '$TEST_FILE' does not exist."
  exit 1
fi

# ---------- 2) Extract folder + file base name ----------
TEST_DIR="$(dirname "$TEST_FILE")"
TEST_NAME="$(basename "$TEST_FILE" .js)"

REPORT_DIR="${TEST_DIR}/reports"
mkdir -p "$REPORT_DIR"

REPORT_FILE="${REPORT_DIR}/${TEST_NAME}_report.html"

# Windows copy destination
WIN_DIR="/mnt/c/Users/mohse/OneDrive/Desktop/reps"
mkdir -p "$WIN_DIR"

echo "====================================="
echo " Running K6 test: $TEST_FILE"
echo " Exporting dashboard HTML → $REPORT_FILE"
echo " Copying ONLY this file → $WIN_DIR"
echo "====================================="

# ---------- 3) Run k6 with dashboard exporter ----------
k6 run --out "dashboard=host=0.0.0.0&export=${REPORT_FILE}&open=false" "$TEST_FILE"
EXIT_CODE=$?

echo ""
echo "✔ K6 test completed (exit code: $EXIT_CODE)"
echo "✔ Report saved at: $REPORT_FILE"

# ---------- 4) Copy ONLY the new report to Windows ----------
echo ""
echo "📦 Copying only the new report to Windows folder…"

if cp "$REPORT_FILE" "$WIN_DIR"/; then
  echo "✔ Copied: $REPORT_FILE → $WIN_DIR"
else
  echo "⚠ Failed to copy $REPORT_FILE"
fi

echo ""
echo "====================================="
echo " FINISHED!"
echo " Report (Linux): $REPORT_FILE"
echo " Report (Windows): $WIN_DIR/$(basename "$REPORT_FILE")"
echo "====================================="