# Quick Start Guide

This guide will help you set up and run the Debate Feedback Backend on your VPS server.

## Prerequisites Checklist

- [ ] Node.js 20+ installed
- [ ] PostgreSQL 15+ installed and running
- [ ] Redis 7+ installed and running
- [ ] npm or yarn package manager
- [ ] Git (for version control)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /home/ubuntu/apps/feedback-backend
npm install
```

This will install all required packages from `package.json`.

### 2. Set Up PostgreSQL Database

```bash
# Create database
sudo -u postgres createdb debate_feedback

# Create user
sudo -u postgres psql -c "CREATE USER debate_user WITH PASSWORD 'your_secure_password';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE debate_feedback TO debate_user;"

# Run schema
sudo -u postgres psql debate_feedback < database/schema.sql
```

### 3. Configure Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

**Minimum required configuration:**

```env
# Database
DATABASE_URL=postgresql://debate_user:your_secure_password@localhost:5432/debate_feedback

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=generate_a_random_secret_key_here

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Google Gemini
GOOGLE_GEMINI_API_KEY=your-gemini-key

# Google Cloud (for Docs/Drive)
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----"
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id
```

### 4. Ensure Redis is Running

```bash
# Check Redis status
sudo systemctl status redis

# If not running, start it
sudo systemctl start redis

# Enable Redis to start on boot
sudo systemctl enable redis

# Test connection
redis-cli ping
# Should return: PONG
```

### 5. Create Storage Directory

```bash
mkdir -p storage
chmod 755 storage
```

### 6. Build TypeScript

```bash
npm run build
```

This compiles TypeScript files from `src/` to `dist/`.

### 7. Test Database Connection

```bash
# Start in development mode
npm run dev

# You should see:
# ✓ Database connection established successfully
# ✓ Connected to Redis successfully
# ✓ Server running on port 3000
```

If you see errors, check:
- PostgreSQL is running: `sudo systemctl status postgresql`
- Redis is running: `sudo systemctl status redis`
- Environment variables are correct in `.env`

### 8. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}

# Detailed health
curl http://localhost:3000/api/health/detailed
```

## Google Cloud Setup (Required for Feedback Generation)

### 1. Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project (e.g., "debate-feedback")
3. Enable APIs:
   - Google Docs API
   - Google Drive API

### 2. Create Service Account

1. Go to IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Name: `debate-feedback-service`
4. Grant role: `Editor`
5. Click "Create and Continue"
6. Click "Create Key" → JSON
7. Download the JSON file

### 3. Extract Credentials

From the downloaded JSON file, extract:
- `client_email`
- `private_key`
- `project_id`

Add these to your `.env` file.

### 4. Create Google Drive Folder

1. Create a folder in Google Drive: "Debate Recordings"
2. Right-click → Share
3. Add your service account email (from JSON)
4. Give it "Editor" access
5. Copy the folder ID from URL:
   - URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Add `FOLDER_ID_HERE` to `.env` as `GOOGLE_DRIVE_FOLDER_ID`

## Running in Production

### Option 1: Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Build the project
npm run build

# Start API server
pm2 start dist/server.js --name debate-api

# Start workers (for processing)
pm2 start dist/workers/index.js --name debate-workers

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup

# View logs
pm2 logs debate-api
pm2 logs debate-workers

# Monitor processes
pm2 monit
```

### Option 2: Using systemd

Create `/etc/systemd/system/debate-api.service`:

```ini
[Unit]
Description=Debate Feedback API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/apps/feedback-backend
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable debate-api
sudo systemctl start debate-api
sudo systemctl status debate-api
```

## Testing the Full Pipeline

### 1. Create a Test User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@capstone.com",
    "name": "Test Teacher",
    "role": "teacher"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@capstone.com",
    "device_id": "test-device-123"
  }'

# Save the token from response
```

### 3. Create a Debate

```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3000/api/debates/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "motion": "This house would ban homework",
    "format": "WSDC",
    "student_level": "primary",
    "teams": {
      "prop": [
        {"name": "Alice", "position": "Prop 1"},
        {"name": "Bob", "position": "Prop 2"}
      ],
      "opp": [
        {"name": "Charlie", "position": "Opp 1"},
        {"name": "Diana", "position": "Opp 2"}
      ]
    },
    "speech_time_seconds": 300
  }'

# Save the debate_id from response
```

### 4. Upload a Speech (requires audio file)

```bash
DEBATE_ID="your_debate_id_here"

curl -X POST http://localhost:3000/api/debates/$DEBATE_ID/speeches \
  -F "audio_file=@/path/to/speech.m4a" \
  -F "speaker_name=Alice" \
  -F "speaker_position=Prop 1" \
  -F "duration_seconds=180" \
  -F "student_level=primary"

# Save the speech_id from response
```

### 5. Check Processing Status

```bash
SPEECH_ID="your_speech_id_here"

curl http://localhost:3000/api/speeches/$SPEECH_ID/status

# Poll this until feedback_status is "completed"
```

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check if database exists
sudo -u postgres psql -l | grep debate_feedback

# Test connection manually
psql -h localhost -U debate_user -d debate_feedback
```

### Redis Connection Failed

```bash
# Check Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping

# Check if Redis is listening
netstat -tulpn | grep 6379
```

### Port Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process if needed
kill -9 <PID>
```

### File Upload Fails

```bash
# Check storage directory permissions
ls -la storage/

# Fix permissions
chmod 755 storage/
chown ubuntu:ubuntu storage/
```

### Workers Not Processing Jobs

```bash
# Check if workers are running
pm2 list

# View worker logs
pm2 logs debate-workers

# Check queue status
curl http://localhost:3000/api/health/detailed
```

### Google API Errors

- Verify service account JSON is correct
- Ensure APIs are enabled in Google Cloud Console
- Check service account has access to Drive folder
- Verify API keys are not expired

## Next Steps

1. **Create Prompt Templates**: Add rubric-specific prompts via admin API
2. **Set Up Monitoring**: Configure logging and error tracking
3. **Backup Strategy**: Set up database backups
4. **SSL/HTTPS**: Configure nginx reverse proxy with SSL
5. **Frontend Integration**: Connect iOS app to this backend

## Support

For issues:
1. Check logs: `pm2 logs` or `journalctl -u debate-api`
2. Review environment variables
3. Verify all services are running
4. Check API documentation in README.md

---

**You're all set! The backend is ready to receive recordings from the iOS frontend.**
