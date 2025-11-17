#!/usr/bin/env python3
"""
Extract HTML and text parts from a multipart email
Usage: python3 extract-email-parts.py email.txt
"""

import sys
import email
from email import policy

if len(sys.argv) < 2:
    print("Usage: python3 extract-email-parts.py email.txt")
    sys.exit(1)

email_file = sys.argv[1]

# Read the email
with open(email_file, 'r', encoding='utf-8', errors='ignore') as f:
    msg = email.message_from_file(f, policy=policy.default)

print(f"📧 Email: {msg.get('subject', 'No subject')}")
print(f"From: {msg.get('from', 'Unknown')}")
print(f"Content-Type: {msg.get_content_type()}")
print()

# Extract parts
html_content = None
text_content = None

if msg.is_multipart():
    for part in msg.walk():
        content_type = part.get_content_type()

        if content_type == 'text/html':
            html_content = part.get_content()
        elif content_type == 'text/plain':
            text_content = part.get_content()

else:
    # Single part email
    if msg.get_content_type() == 'text/html':
        html_content = msg.get_content()
    else:
        text_content = msg.get_content()

# Save extracted parts
if html_content:
    with open('extracted-email.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("✅ Saved HTML to: extracted-email.html")
    print(f"   Size: {len(html_content)} bytes")
else:
    print("⚠️  No HTML part found")

if text_content:
    with open('extracted-email.txt', 'w', encoding='utf-8') as f:
        f.write(text_content)
    print("✅ Saved text to: extracted-email.txt")
    print(f"   Size: {len(text_content)} bytes")
else:
    print("⚠️  No text part found")

print()
print("Next step:")
print("  ./test-email.sh extracted-email.html extracted-email.txt")
