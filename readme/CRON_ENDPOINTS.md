# Cron Job Endpoints for External Services

Use these endpoints with external cron services like console.cron-job.org since Vercel cron jobs require a Pro plan.

## **Cron Job Endpoints**

**Your Vercel App URL**: `code-ninja-hub-live.vercel.app`

### 1. **Game Reminders** (10 minutes before games)
- **URL**: `https://code-ninja-hub-live.vercel.app/api/cron/game-reminders`
- **Method**: GET
- **Schedule**: `* * * * *` (Every minute)
- **Description**: Sends reminders to participants 10 minutes before their games start

### 2. **Early Game Reminders** (30 minutes before games)
- **URL**: `https://code-ninja-hub-live.vercel.app/api/cron/early-reminders`
- **Method**: GET
- **Schedule**: `*/5 * * * *` (Every 5 minutes)
- **Description**: Sends early reminders to participants 30 minutes before their games start

### 3. **Cache Cleanup**
- **URL**: `https://code-ninja-hub-live.vercel.app/api/cron/cache-cleanup`
- **Method**: GET
- **Schedule**: `0 * * * *` (Every hour)
- **Description**: Cleans up expired cache entries to free memory

### 4. **Health Check** (Optional)
- **URL**: `https://code-ninja-hub-live.vercel.app/api/cron/health`
- **Method**: GET
- **Schedule**: `*/15 * * * *` (Every 15 minutes)
- **Description**: Monitors the health of all cron jobs and provides status information

## **Setup Instructions for console.cron-job.org:**

1. **Sign up** at https://console.cron-job.org/
2. **Create a new cron job** for each endpoint above
3. **Configure each job** with:
   - URL from the list above
   - HTTP Method: GET
   - Schedule using the cron expressions provided
   - Enable the job

## **Cron Schedule Explanations:**

- `* * * * *` = Every minute
- `*/5 * * * *` = Every 5 minutes
- `0 * * * *` = Every hour (at minute 0)
- `*/15 * * * *` = Every 15 minutes

## **Testing the Endpoints:**

You can test each endpoint manually by visiting them in your browser or using curl:

```bash
# Test game reminders
curl https://code-ninja-hub-live.vercel.app/api/cron/game-reminders

# Test early reminders
curl https://code-ninja-hub-live.vercel.app/api/cron/early-reminders

# Test cache cleanup
curl https://code-ninja-hub-live.vercel.app/api/cron/cache-cleanup

# Test health check
curl https://code-ninja-hub-live.vercel.app/api/cron/health
```

## **Expected Response Format:**

```json
{
  "success": true,
  "message": "Game reminders processed successfully",
  "timestamp": "2025-09-25T02:33:17.079Z",
  "reminderWindow": "10 minutes",
  "result": {
    // Execution details
  }
}
```

## **Alternative External Cron Services:**

### **UptimeRobot** (Free)
- Set up HTTP monitors that call your endpoints
- Configure intervals: 1 minute, 5 minutes, 1 hour
- Also provides uptime monitoring

### **GitHub Actions** (Free)
```yaml
name: Trigger Cron Jobs
on:
  schedule:
    - cron: '* * * * *'  # Every minute for game reminders
    - cron: '*/5 * * * *'  # Every 5 minutes for early reminders
    - cron: '0 * * * *'  # Every hour for cache cleanup

jobs:
  trigger-game-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Game Reminders
        run: curl -X GET https://code-ninja-hub-live.vercel.app/api/cron/game-reminders
  
  trigger-early-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Early Reminders
        run: curl -X GET https://code-ninja-hub-live.vercel.app/api/cron/early-reminders
  
  trigger-cache-cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cache Cleanup
        run: curl -X GET https://code-ninja-hub-live.vercel.app/api/cron/cache-cleanup
```

## **Monitoring and Logging:**

- All cron job executions are logged to the console (visible in Vercel Function logs)
- Use the health endpoint to monitor job status
- Each endpoint returns detailed execution information
- Set up alerts based on response status codes

## **Security Considerations:**

- Endpoints are public but designed to be safe to call repeatedly
- Consider adding basic authentication if needed
- Monitor for unusual traffic patterns
- Rate limiting is handled by Vercel automatically

This approach provides reliable cron job execution without requiring Vercel Pro!