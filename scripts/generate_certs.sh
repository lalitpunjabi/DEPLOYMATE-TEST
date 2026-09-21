#!/bin/bash
# DEPLOYMATE Self-Signed Certificate Generator for Development / Staging SSL Testing

CERTS_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERTS_DIR"

echo "Generating self-signed SSL/TLS certificates for DEPLOYMATE..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/privkey.pem" \
  -out "$CERTS_DIR/fullchain.pem" \
  -subj "/C=US/ST=State/L=City/O=Deploymate/OU=Platform/CN=localhost"

chmod 600 "$CERTS_DIR/privkey.pem"
chmod 644 "$CERTS_DIR/fullchain.pem"

echo "✅ Self-signed SSL certificates successfully generated at $CERTS_DIR."
