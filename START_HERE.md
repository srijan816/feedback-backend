# Start Here - Debate Feedback Backend

## Quick Setup (5 Minutes)

### 1. Install Dependencies
```bash
cd /home/ubuntu/apps/feedback-backend
npm install
```

### 2. Setup Database
```bash
# Create database and user
sudo -u postgres createdb debate_feedback
sudo -u postgres psql -c "CREATE USER debate_user WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE debate_feedback TO debate_user;"

# Load schema and initial data
sudo -u postgres psql debate_feedback < database/schema.sql
sudo -u postgres psql debate_feedback < database/seed_prompts.sql
```

### 3. Start Redis
```bash
sudo systemctl start redis
sudo systemctl enable redis
```

### 4. Build & Run
```bash
# Build TypeScript
npm run build

# Terminal 1 - API Server (port 12000)
npm run dev

# Terminal 2 - Background Workers
npm run worker
```

## Verify It's Working

```bash
# Check health
curl http://localhost:12000/api/health

# View prompt management UI
# Open in browser: http://localhost:12000/prompts
```

## What's Configured

✅ **AssemblyAI** - Slam-1 transcription with word-level timestamps
✅ **Gemini 2.5** - Flash & Pro models with 4-key cycling
✅ **Port** - Running on 12000
✅ **Workers** - Transcription, Feedback, Google Docs
✅ **Prompts** - Primary & Secondary templates pre-loaded
✅ **Database** - PostgreSQL with complete schema

## API Endpoints

All endpoints available at `http://localhost:12000/api/`

### Test Workflow

1. **Create debate**:
```bash
curl -X POST http://localhost:12000/api/debates/create \
  -H "Content-Type: application/json" \
  -d '{
    "motion": "This house would ban homework",
    "format": "WSDC",
    "student_level": "primary",
    "teams": {
      "prop": [{"name": "Alice", "position": "Prop 1"}],
      "opp": [{"name": "Bob", "position": "Opp 1"}]
    },
    "speech_time_seconds": 300
  }'
```

2. **Upload speech** (replace with your audio file):
```bash
curl -X POST http://localhost:12000/api/debates/{DEBATE_ID}/speeches \
  -F "audio_file=@audio.m4a" \
  -F "speaker_name=Alice" \
  -F "speaker_position=Prop 1" \
  -F "duration_seconds=180" \
  -F "student_level=primary"
```

3. **Check status**:
```bash
curl http://localhost:12000/api/speeches/{SPEECH_ID}/status
```

## Files Created

```
feedback-backend/
├── .env                          ✅ API keys configured
├── package.json                  ✅ Dependencies defined
├── tsconfig.json                 ✅ TypeScript config
├── database/
│   ├── schema.sql               ✅ Database tables
│   └── seed_prompts.sql         ✅ Initial prompts
├── src/
│   ├── config/                  ✅ Config & connections
│   ├── routes/                  ✅ API endpoints
│   ├── services/                ✅ AssemblyAI, Gemini, Docs
│   ├── workers/                 ✅ Background processors
│   ├── middleware/              ✅ Auth & errors
│   └── server.ts                ✅ Main app
├── FRONTEND_SPECIFICATION.md    ✅ iOS requirements
├── BACKEND_SPECIFICATION.md     ✅ Architecture docs
└── SETUP_COMPLETE.md            ✅ Detailed guide
```

## Next Steps

1. Test with a real audio file
2. View/edit prompts at http://localhost:12000/prompts
3. Set up nginx reverse proxy (for production)
4. Connect iOS frontend

## Help

- Logs: `tail -f logs/combined.log`
- Health: http://localhost:12000/api/health/detailed
- Prompts UI: http://localhost:12000/prompts

🚀 **Ready to receive recordings from iOS frontend!**
