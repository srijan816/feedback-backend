# Web Teacher Portal - Executive Summary

## What We're Building

A web-based teacher portal that allows teachers to:
1. **Write real-time notes** during debates
2. **Review and edit** AI-generated feedback
3. **Approve feedback** to generate final DOCX documents
4. **Access historical feedback** for all past debates

---

## Teacher URLs

Each teacher gets a unique URL:

- `/srijan` → Srijan's portal
- `/tamkeen` → Tamkeen's portal
- `/mai` → Mai's portal
- `/saurav` → Saurav's portal
- `/jami` → Jami's portal
- `/naveen` → Naveen's portal

---

## Key Features

### 1. Dashboard View
- **Active Debates**: See live debates in progress
- **Pending Reviews**: Feedback awaiting teacher approval (with edit count)
- **History**: All past approved feedback

### 2. Live Note-Taking
- Write notes during each speech
- Auto-save every 3 seconds
- Notes organized by speaker
- Export all notes at end

### 3. Feedback Editing
- Edit rubric scores (1-5 or NA)
- Edit qualitative feedback text
- Edit strategic overview
- Add teacher's manual notes
- Preview before approval
- Version tracking (v1, v2, v3...)

### 4. Approval Workflow
```
AI Generates Feedback
    ↓
Teacher Reviews (status: pending_review)
    ↓
Teacher Edits (status: draft, version increments)
    ↓
Teacher Approves (status: approved)
    ↓
DOCX Generated Automatically
    ↓
Teacher Downloads DOCX
```

### 5. Real-Time Updates
- WebSocket notifications when:
  - New speech is uploaded
  - Transcription is ready
  - Feedback is generated
  - DOCX is ready

---

## System Architecture

```
┌─────────────────┐
│   Web Browser   │
│  (Teacher UI)   │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐      ┌──────────┐
│  Express API    │◄────►│PostgreSQL│
│  (12000)        │      │  (New    │
│                 │      │  Tables) │
│  + WebSocket    │      └──────────┘
│    Server       │
└────────┬────────┘
         │
         │
┌────────▼────────┐
│  Bull Queue     │
│  DOCX Worker    │
└─────────────────┘
```

---

## New Database Tables

### `feedback_drafts`
Stores teacher's edits before approval
- `edited_scores` (JSONB)
- `edited_qualitative_feedback` (JSONB)
- `edited_strategic_overview` (JSONB)
- `teacher_notes` (TEXT)
- `version` (INTEGER)

### `debate_notes`
Stores real-time notes during debate
- `debate_id`, `speech_id`, `teacher_id`
- `speaker_name`
- `note_text`

### `feedback_approvals`
Tracks approval workflow
- `feedback_id`, `teacher_id`
- `status` (draft, approved, rejected)
- `docx_file_path`, `docx_url`
- `approved_at`

---

## New API Endpoints

### Dashboard
```
GET /api/teachers/:teacherName/dashboard
```
Returns active debates, pending reviews, history

### Feedback Editing
```
GET /api/teachers/:teacherName/feedback/:feedbackId/draft
PUT /api/teachers/:teacherName/feedback/:feedbackId/draft
```
Get and save draft edits

### Approval
```
POST /api/teachers/:teacherName/feedback/:feedbackId/approve
GET /api/teachers/:teacherName/feedback/:feedbackId/approval-status
```
Approve feedback and check DOCX generation status

### Notes
```
POST /api/teachers/:teacherName/debates/:debateId/notes
GET /api/teachers/:teacherName/debates/:debateId/notes
PUT /api/teachers/:teacherName/notes/:noteId
DELETE /api/teachers/:teacherName/notes/:noteId
```
CRUD operations for real-time notes

---

## Implementation Timeline

### **Week 1: Database & API**
- Create 3 new tables
- Build API endpoints
- Test with Postman

### **Week 2: Basic Frontend**
- Set up React/HTML structure
- Build dashboard page
- Connect to API

### **Week 3: Feedback Editing**
- Build review interface
- Implement auto-save
- Add version tracking

### **Week 4: Real-Time Features**
- Set up WebSocket
- Live note-taking interface
- Real-time notifications

### **Week 5: DOCX Generation**
- Build DOCX generator
- Create queue worker
- Approval workflow

### **Week 6: Polish & Testing**
- Error handling
- Loading states
- User testing

---

## Technology Stack

### Backend (Existing + New)
- **Node.js + TypeScript** (already in place)
- **Express.js** (already in place)
- **PostgreSQL** (add 3 tables)
- **Bull Queue** (add DOCX worker)
- **Socket.io** (for WebSocket)
- **docx.js** (for DOCX generation)

### Frontend (New)
- **Option A:** React + TypeScript (recommended)
- **Option B:** Simple HTML/JS (faster, lighter)
- **Styling:** Tailwind CSS or plain CSS
- **WebSocket Client:** socket.io-client

---

## Data Flow Example

### Scenario: Teacher Approves Feedback

1. Teacher clicks "Approve" button
2. Frontend sends `POST /api/teachers/srijan/feedback/42/approve`
3. Backend updates `feedback.approval_status = 'approved'`
4. Backend creates record in `feedback_approvals`
5. Backend adds job to DOCX queue
6. DOCX worker processes job (generates .docx file)
7. Worker updates `feedback.docx_url`
8. Worker emits WebSocket event `docx:ready`
9. Frontend receives event, shows download button
10. Teacher clicks download, gets DOCX file

---

## Security Considerations

### Authentication
- Use existing JWT system
- Validate teacher name matches JWT token
- Teachers can only access their own data

### Authorization
- Teachers can only edit their own students' feedback
- Admins can view all feedback
- Rate limiting: 100 req/min per teacher

### Data Validation
- Validate rubric scores (1-5 or NA only)
- Sanitize HTML (prevent XSS)
- Limit note length (5000 chars max)

---

## Mobile Responsiveness

All pages work on:
- **Desktop**: 3-column layout
- **Tablet**: 2-column layout
- **Mobile**: Single column, stacked cards

---

## Key Design Decisions

### Why Drafts Table?
- Preserves original AI feedback
- Allows multiple edits before approval
- Version tracking for audit trail

### Why Separate Approval Table?
- Tracks approval workflow
- Stores DOCX URLs separately
- Better for analytics (time to approval)

### Why WebSocket?
- Real-time updates during live debates
- Instant notification when feedback ready
- Better UX than polling

### Why DOCX Queue Worker?
- Don't block API during generation
- Handle failures gracefully
- Scalable (can run multiple workers)

---

## DOCX Document Structure

Final DOCX includes:
1. **Header**: Student name, position, motion, date
2. **Rubric Scores Table**: Visual stars (⭐⭐⭐⭐☆)
3. **Detailed Feedback**: All 8 rubrics with bullet points
4. **Strategic Overview**: Hook, assessment, missing arguments
5. **Teacher's Notes**: Manual notes from live debate
6. **Transcript Highlights**: Excellent moments + areas to improve

---

## Customization Options

Teachers can customize:
- **Scores**: Change any 1-5 score
- **Feedback Text**: Rewrite, add, or remove points
- **Strategic Overview**: Edit all sections
- **Manual Notes**: Add observations during debate
- **Approval**: Only generate DOCX when satisfied

---

## Performance Optimizations

### Frontend
- Lazy load components
- Debounce auto-save (3s delay)
- Cache dashboard (5 min)
- Infinite scroll history

### Backend
- Index new columns (feedback_id, teacher_id, status)
- Cache dashboard in Redis (5 min TTL)
- Paginate history queries (20 items/page)
- Background DOCX generation (queue)

---

## Testing Strategy

### Unit Tests
- Feedback merge (original + edits)
- DOCX generation
- Rubric validation

### Integration Tests
- Full editing flow
- Approval workflow
- Notes CRUD

### E2E Tests (Cypress)
1. Teacher logs in
2. Writes notes during debate
3. Reviews and edits feedback
4. Approves and downloads DOCX

---

## Deployment Checklist

### Before Launch
- [ ] Run database migrations
- [ ] Test all API endpoints
- [ ] Set up DOCX storage (local or S3)
- [ ] Configure WebSocket server
- [ ] Build frontend production bundle
- [ ] Set up monitoring (Sentry)

### Launch Day
- [ ] Start DOCX worker: `npm run worker:docx`
- [ ] Restart server: `pm2 restart feedback-backend`
- [ ] Test with 1-2 teachers
- [ ] Monitor logs for errors

### Post-Launch
- [ ] Collect teacher feedback
- [ ] Monitor performance metrics
- [ ] Track approval times
- [ ] Iterate on UX

---

## Future Enhancements (Phase 7+)

1. **Student View Portal** - Students see their own feedback
2. **Analytics Dashboard** - Charts showing rubric trends over time
3. **Feedback Templates** - Save common feedback snippets
4. **Collaborative Editing** - Multiple teachers review same debate
5. **Video Playback** - Sync video with transcript
6. **Export to PDF** - Alternative to DOCX
7. **Email Notifications** - Alert when feedback ready
8. **Mobile App** - Native iOS/Android portal

---

## Success Metrics

Track:
- **Teacher Engagement**: Logins per week
- **Edit Rate**: % of feedback that gets edited
- **Approval Time**: Time from generation → approval
- **DOCX Download Rate**: % of approved feedback downloaded
- **Notes Usage**: % of debates with notes

---

## Quick Reference

### Development Commands
```bash
# Run migrations
psql -U your_user -d debate_feedback -f src/migrations/003_web_portal_tables.sql

# Start backend
npm run dev

# Start DOCX worker
npm run worker:docx

# Start frontend (React)
cd frontend/web && npm start
```

### Test URLs
```
http://localhost:12000/srijan               # Dashboard
http://localhost:12000/srijan/debate/1/live # Live notes
http://localhost:12000/srijan/feedback/1    # Review
```

### Test API
```bash
# Dashboard
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:12000/api/teachers/srijan/dashboard

# Save draft
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"edited_scores": {"Time Management": 5}}' \
  http://localhost:12000/api/teachers/srijan/feedback/1/draft

# Approve
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:12000/api/teachers/srijan/feedback/1/approve
```

---

## Questions to Decide

Before implementing, decide:

1. **Frontend Framework?**
   - React (feature-rich, modern)
   - Vue (simpler, faster to learn)
   - Plain HTML/JS (lightweight, no build step)

2. **DOCX Storage?**
   - Local filesystem (simple)
   - AWS S3 (scalable, durable)
   - Google Drive (integrates with existing system)

3. **Authentication?**
   - Email + password
   - Teacher ID + device ID (current iOS method)
   - Both options

4. **WebSocket Scaling?**
   - Single server (simple)
   - Redis adapter (multi-server)

5. **DOCX Template?**
   - Custom code (full control)
   - Pre-designed template (easier for designers)

---

## Documentation Created

1. **WEB_FRONTEND_DESIGN.md** (20+ pages)
   - Complete architecture
   - All layouts and wireframes
   - Full API specification
   - Database schemas

2. **IMPLEMENTATION_GUIDE.md** (15+ pages)
   - Step-by-step instructions
   - Code samples
   - Testing checklist
   - Deployment guide

3. **EXEC_SUMMARY.md** (this file)
   - High-level overview
   - Key decisions
   - Quick reference

---

## Get Started

1. **Read WEB_FRONTEND_DESIGN.md** for complete specs
2. **Follow IMPLEMENTATION_GUIDE.md** for step-by-step setup
3. **Start with Phase 1** (database migrations)
4. **Test each phase** before moving to next

---

## Support & Contact

If you need help:
- Review documentation in repo
- Check server logs: `pm2 logs feedback-backend`
- Test database: `psql -d debate_feedback`
- Verify API: Use Postman or curl

---

**Ready to implement? Start with Phase 1 of the Implementation Guide!**

---

**Document Version:** 1.0
**Last Updated:** November 5, 2025
**Status:** Ready for Development
