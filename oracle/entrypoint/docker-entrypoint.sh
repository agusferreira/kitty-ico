#!/bin/bash
set -e

# Create directories if they don't exist
mkdir -p /tmp/tee-data
mkdir -p /tmp/tee-keys
mkdir -p /tmp/tee-logs

# Create symlinks to the mounted volumes
if [ -d "/tmp_data" ]; then
  echo "Setting up data directory symlink"
  rm -rf /app/data
  ln -sf /tmp_data /app/data
fi

if [ -d "/tmp_keys" ]; then
  echo "Setting up keys directory symlink"
  rm -rf /app/keys
  ln -sf /tmp_keys /app/keys
fi

if [ -d "/tmp_logs" ]; then
  echo "Setting up logs directory symlink"
  rm -rf /app/logs
  ln -sf /tmp_logs /app/logs
fi

echo "Directory setup complete"

# Verify OpenAI version
echo "Verifying OpenAI version..."
pip list | grep openai

# Create a patched version of agent.py to ensure no proxies argument
echo "Creating patched version of agent.py..."
cp /app/agent.py /app/agent.py.bak

# More comprehensive patching to handle any OpenAI client initialization
echo "Patching OpenAI client initialization..."
sed -i 's/openai.OpenAI(.*)/openai.OpenAI(api_key=openai_api_key)/g' /app/agent.py

# Verify the patch was applied
echo "Verifying patch..."
grep -n "openai.OpenAI" /app/agent.py

echo "Starting TEE Agent in development mode..."

# Execute the original command
exec "$@"
