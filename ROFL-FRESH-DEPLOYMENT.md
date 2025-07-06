# Fresh ROFL TEE Deployment Guide

## Issue Resolution
This deployment addresses the storage overflow issue that was causing 404 errors in the TEE agent logs. The original deployment had only 10GB storage which was insufficient for continuous logging operations.

## Key Optimizations Made

### 1. Logging Improvements
- **Log Rotation**: Implemented rotating file handlers (10MB per file, 3 files max = 30MB total)
- **Reduced Logging Frequency**: Changed from every 60 seconds to every 10 minutes
- **Monitoring Optimization**: Increased check intervals from 10 seconds to 30 seconds
- **Debug Level Control**: Most frequent logs moved to debug level

### 2. Storage Optimization  
- **Increased Storage**: Upgraded from 10GB to 50GB in rofl.yaml
- **Temporary File Cleanup**: Added automatic cleanup of temporary files
- **Python Optimization**: Disabled .pyc file generation to save space

### 3. Environment Configuration
- **Better Error Handling**: Improved error recovery with longer sleep intervals
- **Resource Management**: Optimized memory and CPU usage patterns
- **Container Optimization**: Added unbuffered Python output for better logging

## Deployment Steps

### Step 1: Clean Up Current Environment
```bash
# Stop and remove the current machine
oasis rofl machine stop
oasis rofl machine rm --force

# Wait for cleanup to complete
sleep 30
```

### Step 2: Build and Deploy Fresh Environment
```bash
# Build the optimized Docker image
./cli.ts rofl-build-docker --force

# Deploy with new configuration
oasis rofl deploy --network testnet --paratime sapphire

# Wait for deployment to complete
oasis rofl machine show
```

### Step 3: Monitor Deployment
```bash
# Check machine status
oasis rofl machine show

# Monitor logs (should work now)
oasis rofl machine logs --follow

# Check resource usage
oasis rofl machine show | grep -E "(Memory|Storage|Status)"
```

## Expected Improvements

1. **No More 404 Errors**: Logs should be accessible consistently
2. **Better Storage Management**: 50GB storage with automatic cleanup
3. **Reduced Resource Usage**: Less frequent logging and monitoring
4. **Improved Stability**: Better error handling and recovery mechanisms

## Troubleshooting

### If logs still show 404:
```bash
# Check if machine is running
oasis rofl machine show

# If status shows errors, restart the machine
oasis rofl machine restart
```

### If storage issues persist:
```bash
# Check storage usage in logs
oasis rofl machine logs | grep -i "storage\|disk\|space"

# Consider increasing storage further in rofl.yaml if needed
```

### If deployment fails:
```bash
# Check for insufficient balance
oasis account show

# Verify network connectivity
oasis rofl machine show | grep -i "error\|fail"
```

## Key Files Modified

1. **`oracle/agent.py`**: Added log rotation and reduced logging frequency
2. **`rofl.yaml`**: Increased storage from 10GB to 50GB  
3. **`compose.testnet.yaml`**: Added Python optimization environment variables
4. **`ROFL-FRESH-DEPLOYMENT.md`**: This deployment guide

## Post-Deployment Verification

After deployment, verify these improvements:
- [ ] `oasis rofl machine logs` works without 404 errors
- [ ] Storage usage stays below 80% (check with `oasis rofl machine show`)
- [ ] Agent logs show "monitoring active" every 10 minutes instead of every minute
- [ ] No "storage exceed" errors in machine metadata

## Long-term Monitoring

Set up regular checks:
```bash
# Weekly storage check
oasis rofl machine show | grep -A 5 "Resources:"

# Monthly log rotation verification  
oasis rofl machine logs | tail -20 | grep "rotation"
```

The new configuration should provide stable, long-term operation without storage overflow issues. 