#!/bin/sh

# Run seeds (idempotent - skips if data already exists)
echo "Running seeds..."
node dist/database/seeds/setup-demo.js || echo "Seeds failed, continuing..."

# Start the app
echo "Starting server..."
node dist/main
