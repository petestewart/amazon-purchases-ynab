#!/bin/bash

# Test script for sending a sample Amazon email to the webhook
# Usage: ./test-email.sh [html-file] [text-file]

HTML_FILE=${1:-"sample-email.html"}
TEXT_FILE=${2:-"sample-email.txt"}

if [ ! -f "$HTML_FILE" ]; then
  echo "Error: HTML file '$HTML_FILE' not found"
  echo "Usage: ./test-email.sh [html-file] [text-file]"
  exit 1
fi

if [ ! -f "$TEXT_FILE" ]; then
  echo "Warning: Text file '$TEXT_FILE' not found, using empty string"
  TEXT_CONTENT=""
else
  TEXT_CONTENT=$(cat "$TEXT_FILE" | jq -Rs .)
fi

HTML_CONTENT=$(cat "$HTML_FILE" | jq -Rs .)

echo "Sending test email to webhook..."
echo "HTML file: $HTML_FILE"
echo "Text file: $TEXT_FILE"
echo ""

curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d "{
    \"html\": $HTML_CONTENT,
    \"text\": $TEXT_CONTENT
  }" \
  -w "\n\nHTTP Status: %{http_code}\n"

echo ""
echo "Check logs/combined.log for details"
