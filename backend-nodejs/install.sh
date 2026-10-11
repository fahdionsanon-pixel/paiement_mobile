#!/bin/bash
# Install and start PayPulse Node.js backend
# Usage: ./install.sh

cd "$(dirname "$0")"

echo "Installing dependencies..."
npm install

echo "Starting PayPulse API..."
npm run start