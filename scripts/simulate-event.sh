#!/usr/bin/env bash
# Simulate a system event. Requires Core running on CORE_URL.
# Usage: ./scripts/simulate-event.sh [type] [source] [severity]
# Example: ./scripts/simulate-event.sh vision.motion camera-1 medium

CORE_URL="${CORE_URL:-http://localhost:3001}"
TYPE="${1:-vision.motion}"
SOURCE="${2:-camera-1}"
SEVERITY="${3:-medium}"

curl -s -X POST "${CORE_URL}/events/simulate" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"${TYPE}\",\"source\":\"${SOURCE}\",\"severity\":\"${SEVERITY}\"}"
