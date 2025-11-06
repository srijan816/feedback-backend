# Debate Feedback Backend

Backend API for recording debate speeches and generating AI-powered transcriptions and feedback.

## 📋 Overview

This is a Node.js/TypeScript backend that:
- Accepts audio recordings of debate speeches from iOS frontend
- Transcribes speeches using OpenAI Whisper API
- Generates detailed feedback using Google Gemini (or other LLMs)
- Creates formatted Google Docs with scores and qualitative feedback
- Manages debate sessions, schedules, and student data

## 🏗️ Architecture

```
Frontend (iOS) → Express API → Bull Queue → Workers
                      ↓            ↓
                  PostgreSQL   Redis
                      ↓
                External APIs:
                - OpenAI (transcription)
                - Google Gemini (feedback)
                - Google Docs/Drive
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- npm or yarn

### Installation

1. **Clone and install dependencies:**
```bash
cd /home/ubuntu/apps/feedback-backend
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Create PostgreSQL database:**
```bash
createdb debate_feedback
psql debate_feedback < database/schema.sql
```

4. **Start Redis:**
```bash
# Using systemd
sudo systemctl start redis

# Or using Docker
docker run -d -p 6379:6379 redis:7-alpine
```

5. **Build TypeScript:**
```bash
npm run build
```

6. **Start development server:**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 📁 Project Structure

```
feedback-backend/
├── database/
│   └── schema.sql              # PostgreSQL schema
├── logs/                       # Application logs
├── prompts/                    # LLM prompt templates
├── storage/                    # Temporary audio file storage
├── src/
│   ├── config/
│   │   ├── index.ts           # Main configuration
│   │   ├── database.ts        # PostgreSQL connection
│   │   ├── redis.ts           # Redis connection
│   │   └── queue.ts           # Bull queue setup
│   ├── controllers/           # Request handlers
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication
│   │   └── errorHandler.ts   # Error handling
│   ├── models/                # Database models
│   ├── routes/
│   │   ├── auth.ts            # Authentication routes
│   │   ├── debates.ts         # Debate management
│   │   ├── speeches.ts        # Speech upload & status
│   │   ├── schedules.ts       # Schedule management
│   │   ├── prompts.ts         # Prompt templates (admin)
│   │   └── health.ts          # Health checks
│   ├── services/
│   │   ├── transcription.ts   # OpenAI integration
│   │   ├── feedback.ts        # LLM feedback generation
│   │   ├── googleDocs.ts      # Google Docs creation
│   │   └── storage.ts         # File management
│   ├── workers/
│   │   ├── index.ts           # Worker processes
│   │   ├── transcription.ts   # Transcription worker
│   │   ├── feedback.ts        # Feedback worker
│   │   ├── googleDocs.ts      # Docs creation worker
│   │   └── cleanup.ts         # Storage cleanup worker
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   ├── utils/
│   │   └── logger.ts          # Winston logger
│   └── server.ts              # Express app entry point
├── .env.example               # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── FRONTEND_SPECIFICATION.md  # Frontend requirements
├── BACKEND_SPECIFICATION.md   # Backend architecture
└── README.md
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT tokens
- `OPENAI_API_KEY` - OpenAI API key for transcription
- `GOOGLE_GEMINI_API_KEY` - Google Gemini API key
- `GOOGLE_CLIENT_EMAIL` - Google service account email
- `GOOGLE_PRIVATE_KEY` - Google service account private key
- `GOOGLE_DRIVE_FOLDER_ID` - Google Drive folder for storage

**Optional:**
- `ANTHROPIC_API_KEY` - For Claude feedback
- `GROK_API_KEY` - For Grok feedback
- `PORT` - Server port (default: 3000)

### Google Cloud Setup

1. Create a Google Cloud project
2. Enable Google Docs API and Google Drive API
3. Create a service account
4. Download JSON credentials
5. Share your Google Drive folder with the service account email

## 📡 API Endpoints

### Authentication

```
POST   /api/auth/login          # Login with email and device_id
POST   /api/auth/register       # Register new teacher (admin)
GET    /api/auth/me             # Get current user profile
```

### Debates

```
POST   /api/debates/create      # Create new debate session
GET    /api/debates/:id         # Get debate details
GET    /api/teachers/:id/debates # Get debate history
```

### Speeches

```
POST   /api/debates/:id/speeches     # Upload speech audio
GET    /api/speeches/:id/status      # Check processing status
GET    /api/speeches/:id/feedback    # Get feedback details
```

### Schedules

```
GET    /api/schedule/current    # Get current class schedule
POST   /api/schedule             # Create schedule (admin)
PUT    /api/schedule/:id        # Update schedule (admin)
```

`GET /api/schedule/current` now returns each alternative class with both `start_time` (HH:mm) and `startDateTime` (ISO8601, Hong Kong timezone) so clients can differentiate identical start times.

### Prompts

```
GET    /api/prompts             # Get active prompt templates
POST   /api/prompts             # Create new prompt (admin)
PUT    /api/prompts/:id         # Update prompt (admin)
```

### Health

```
GET    /api/health              # Basic health check
GET    /api/health/detailed     # Detailed system health
```

## 🔄 Processing Pipeline

1. **Upload**: iOS app uploads audio file
2. **Transcription Job**: Queued immediately
   - OpenAI Whisper transcribes audio
   - Calculate speaking rate, word count
3. **Feedback Job**: Triggered after transcription
   - Fetch prior speeches for context
   - Generate feedback using LLM
   - Parse scores and qualitative feedback
4. **Google Docs Job**: Create feedback document
   - Apply template (primary/secondary)
   - Populate scores and comments
   - Set permissions and get shareable link
5. **Notify**: Update database, frontend polls for status

## 🧹 Storage Management

- **Local Storage**: Temporary files in `./storage/` or `/var/storage/`
- **Cleanup**: After 2 debates, files are moved to Google Drive and local copies deleted
- **Google Drive**: Long-term archival storage

## 📊 Logging

Logs are written to:
- `./logs/combined.log` - All logs
- `./logs/error.log` - Error logs only
- Console (development mode)

Log levels: `error`, `warn`, `info`, `debug`

## 🧪 Development

### Running in Development

```bash
npm run dev
```

This uses `tsx watch` for hot-reloading.

### Building for Production

```bash
npm run build
npm start
```

### Running Workers

Workers process background jobs (transcription, feedback, etc.):

```bash
npm run worker
```

In production, run workers as separate processes or containers.

### Database Migrations

```bash
npm run db:migrate
npm run db:seed
```

## 🐳 Production Deployment

### Using PM2

```bash
npm install -g pm2

# Start API server
pm2 start dist/server.js --name debate-api

# Start workers
pm2 start dist/workers/index.js --name debate-workers

# Save configuration
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Using systemd

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

```bash
sudo systemctl enable debate-api
sudo systemctl start debate-api
```

## 🔐 Security

- JWT tokens for authentication
- Helmet for HTTP headers security
- Rate limiting on all endpoints
- CORS whitelist
- Input validation with express-validator
- SQL injection prevention with parameterized queries

## 📈 Monitoring

### Health Checks

```bash
curl http://localhost:3000/api/health/detailed
```

Returns:
- Server status and uptime
- Database connection
- Redis connection
- Queue statistics

### Queue Dashboard

Install Bull Board for queue monitoring:

```bash
npm install @bull-board/express
```

## 🧾 Cost Estimates

Per 8-minute speech:
- OpenAI Whisper: ~$0.02
- Gemini Flash: ~$0.01
- Google Docs API: Free

Monthly cost (30 debates/day × 6 speeches): ~$15-25

## 🐛 Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U debate_user -d debate_feedback
```

### Redis Connection Failed

```bash
# Check Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping
```

### Worker Jobs Not Processing

```bash
# Check Redis connection
# Check worker process is running
pm2 list

# View worker logs
pm2 logs debate-workers
```

## 📚 Documentation

- [Frontend Specification](./FRONTEND_SPECIFICATION.md)
- [Backend Specification](./BACKEND_SPECIFICATION.md)
- [Database Schema](./database/schema.sql)

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run tests: `npm test`
4. Submit pull request

## 📝 License

ISC

## 👥 Team

Capstone Debate Platform

---

**Next Steps:**
1. Configure environment variables
2. Set up Google Cloud service account
3. Initialize database with schema
4. Test API endpoints
5. Implement remaining workers
6. Deploy to production
