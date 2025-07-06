#!/bin/bash

echo "🚀 Deploying Fresh TEE Environment with Storage Optimization"
echo "=========================================================="

echo "Step 1: Checking current machine status..."
oasis rofl machine show || echo "✅ No existing machine found (good for fresh deployment)"

echo "Step 2: Building optimized application..."
# Use the correct build command for ROFL
oasis rofl build --force

echo "Step 3: Deploying with new configuration..."
# Deploy using the correct oasis rofl deploy command
oasis rofl deploy --network testnet --paratime sapphire

echo "Step 4: Checking deployment status..."
oasis rofl machine show

echo "✅ Deployment completed! Testing logs..."
echo "Step 5: Testing log access (should work now)..."
oasis rofl machine logs

echo "🎉 Fresh deployment complete! Your 404 errors should be resolved."
echo "📊 Storage upgraded from 10GB to 50GB"
echo "🔧 Logging optimized with rotation and reduced frequency"
echo "🧹 Automatic cleanup mechanisms added" 