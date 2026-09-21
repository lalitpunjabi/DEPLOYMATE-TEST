#!/bin/bash
# DEPLOYMATE self-signed certificate generator
#
# PURPOSE: local development, staging, and HTTPS stack testing ONLY.
# Do NOT use the output of this script as a public production certificate.
# Internet-facing production hosts must use a CA-signed certificate
# (for example Let's Encrypt) placed at:
#   ./certs/fullchain.pem
#   ./certs/privkey.pem
# Docker Compose mounts ./certs into the frontend container at /etc/nginx/certs.

set -euo pipefail

CERTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$CERTS_DIR"

echo "Generating a SELF-SIGNED certificate for local/staging HTTPS testing."
echo "This is NOT equivalent to a publicly trusted production certificate."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERTS_DIR/privkey.pem" \
    -out "$CERTS_DIR/fullchain.pem" \
    -subj "/C=US/ST=State/L=City/O=Deploymate/OU=Platform/CN=localhost"

chmod 600 "$CERTS_DIR/privkey.pem"
chmod 644 "$CERTS_DIR/fullchain.pem"

echo "Wrote self-signed files to $CERTS_DIR (fullchain.pem, privkey.pem)."
echo "Browsers will warn until you replace these with a CA-signed certificate."
