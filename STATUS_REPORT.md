# iOS App Integration - Status Report

**Date:** October 27, 2025
**Issue:** iOS app shows "Resource not found" when trying to login

---

## 🎯 Current Status

### Backend: ✅ FULLY OPERATIONAL

All backend components are working perfectly:

| Component | Status | Details |
|-----------|--------|---------|
| **Server** | ✅ Running | Port 12000, systemd service active |
| **HTTPS/SSL** | ✅ Working | Let's Encrypt certificate (valid until Jan 25, 2026) |
| **DNS** | ✅ Configured | api.genalphai.com → 144.217.164.110 |
| **Database** | ✅ Connected | PostgreSQL with test user "Test Teacher" |
| **Redis** | ✅ Connected | Queue system operational |
| **Nginx** | ✅ Configured | Reverse proxy with SSL termination |

### Backend Tests: ✅ ALL PASSING

```bash
# Health check
$ curl https://api.genalphai.com/api/health
{"status":"ok","timestamp":"2025-10-27T17:05:09.123Z",...}

# Login test
$ curl -X POST https://api.genalphai.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"teacher_id": "Test Teacher", "device_id": "test-123"}'
{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","teacher":{"id":"cda41ea5-...","name":"Test Teacher","isAdmin":false}}
```

**All endpoints return HTTP 200 with correct responses.**

---

## ❌ Problem: iOS App Cannot Reach Backend

### Evidence

**1. Error Message:**
- iOS app shows: **"Resource not found"**
- This is `NetworkError.notFound` triggered by HTTP 404

**2. Network Analysis:**
- Nginx access logs: **ZERO requests from iOS app**
- All login attempts in logs are from curl (localhost)
- iOS app IS connecting to SOME server (getting 404, not timeout)
- **Conclusion: iOS app is reaching the WRONG server**

**3. GitHub Repository:**
- Constants.swift has correct URL: `https://api.genalphai.com/api` ✅
- Mock mode is disabled: `useMockData = false` ✅

**4. Most Likely Cause:**
- **Xcode build cache** - Old URL cached in compiled app
- **Mac DNS cache** - Still pointing to old IP
- **Simulator cache** - Old network configuration

---

## 🔧 Required Actions (On Your Mac)

### Step 1: Download Diagnostic Script

Copy this script to your Mac and run it:

```bash
# Download from VPS
scp ubuntu@144.217.164.110:/home/ubuntu/apps/feedback-backend/test-ios-connection.sh ~/Desktop/

# Run on Mac
cd ~/Desktop
chmod +x test-ios-connection.sh
./test-ios-connection.sh
```

This will verify:
- DNS resolution
- HTTPS connectivity
- SSL certificate
- Login endpoint
- Xcode/Simulator status

---

### Step 2: Clear DNS Cache (Mac)

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Verify
host api.genalphai.com
# Should show: api.genalphai.com has address 144.217.164.110
```

---

### Step 3: Clean Xcode Build

**CRITICAL**: This is likely the main issue. Xcode caches the compiled Constants file.

```bash
# Close Xcode completely
# Then run:
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Reopen Xcode
# Clean build folder: Product → Clean Build Folder (Shift + Cmd + K)
# Build and run: Cmd + R
```

---

### Step 4: Reset iOS Simulator

```bash
# Option 1: In Simulator
Device → Erase All Content and Settings

# Option 2: Command line
xcrun simctl erase all
```

---

### Step 5: Add Debug Logging

**MUST DO**: Add these lines to `APIClient.swift` around line 40:

```swift
guard let url = endpoint.url() else {
    throw NetworkError.invalidURL
}

// ADD THIS:
print("🌐 API Request URL: \(url.absoluteString)")
print("🌐 Base URL: \(Constants.API.baseURL)")

var request = URLRequest(url: url)
```

**Why:** This will show exactly what URL the app is trying to reach.

---

### Step 6: Test and Capture Output

1. Build and run the app
2. Try to login as "Test Teacher"
3. **Check Xcode Console** (View → Debug Area → Show Debug Area)
4. Look for the 🌐 debug output

**Expected (correct):**
```
🌐 API Request URL: https://api.genalphai.com/api/auth/login
🌐 Base URL: https://api.genalphai.com/api
```

**Wrong (if still broken):**
```
🌐 API Request URL: http://144.217.164.110:12000/api/auth/login  ❌
```

If you see the wrong URL, it means Xcode is still using cached build files.

---

## 📋 Complete Fix Checklist

```
[ ] 1. Run test-ios-connection.sh on Mac - all tests pass
[ ] 2. DNS cache cleared - host command shows correct IP
[ ] 3. Xcode derived data deleted
[ ] 4. Xcode clean build performed (Shift + Cmd + K)
[ ] 5. iOS Simulator reset
[ ] 6. Debug logging added to APIClient.swift
[ ] 7. Constants.swift verified:
    [ ] Line 14: "https://api.genalphai.com/api"
    [ ] Line 21: false
[ ] 8. App rebuilt and running
[ ] 9. Xcode console output captured
[ ] 10. Login tested with "Test Teacher"
```

---

## 📁 Reference Documents

Created on VPS at `/home/ubuntu/apps/feedback-backend/`:

1. **IOS_APP_FIX_GUIDE.md** - Detailed step-by-step fix guide
2. **iOS_DEBUG_CHECKLIST.md** - Original debugging checklist
3. **test-ios-connection.sh** - Automated diagnostic script
4. **STATUS_REPORT.md** - This document

---

## 🔐 Test Credentials

**Login Name:** `Test Teacher` (case-sensitive)
**Device ID:** Any string (e.g., `test-device-123`)

**Database Record:**
```
User ID: cda41ea5-1f4e-4b78-bfe2-6e48b5b83a63
Email: test@school.com
Name: Test Teacher
Role: teacher
Institution: Test School
```

---

## 🎯 Expected Outcome

After completing the steps above:

1. **Mac diagnostic script**: All tests pass ✅
2. **Xcode console output**: Shows correct HTTPS URL ✅
3. **iOS app**: Successfully logs in ✅
4. **Backend logs**: Shows iOS app requests ✅

---

## 📊 Backend API Endpoints (All Working)

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/health` | GET | ✅ 200 | Health check |
| `/api/auth/login` | POST | ✅ 200 | Authentication |
| `/api/debates/create` | POST | ✅ 201 | Create debate |
| `/api/debates/:id/speeches` | POST | ✅ 201 | Upload speech |
| `/api/speeches/:id/status` | GET | ✅ 200 | Check processing status |

---

## 🔄 What Was Fixed on Backend

During integration, these backend changes were made:

### 1. Authentication Endpoint (`src/routes/auth.ts`)
- ✅ Accepts both `email` OR `teacher_id` (iOS compatibility)
- ✅ Returns `teacher` object instead of `user` (iOS expects this)
- ✅ Includes `isAdmin` boolean field

### 2. Speech Status Endpoint (`src/routes/speeches.ts`)
- ✅ Unified `status` field: 'pending', 'processing', 'complete', 'failed'
- ✅ camelCase `googleDocUrl` (iOS compatible)
- ✅ Backward compatible with snake_case fields

### 3. Server Configuration (`src/server.ts`)
- ✅ Added `app.set('trust proxy', true)` for Nginx
- ✅ Proper rate limiting with proxy headers

### 4. Database
- ✅ Created missing `debate_participants` table
- ✅ Fixed schema (student_id as INTEGER)
- ✅ Created test user "Test Teacher"

### 5. HTTPS/SSL
- ✅ Let's Encrypt certificate obtained
- ✅ Nginx reverse proxy configured
- ✅ Auto-renewal enabled (certbot timer)
- ✅ DNS configured (api.genalphai.com → 144.217.164.110)

### 6. Services
- ✅ Systemd services for headless operation
- ✅ Auto-start on boot
- ✅ Proper logging configured

---

## 🚨 Known Issue

**Current Blocker:** iOS app is NOT reaching the backend despite all backend fixes being complete.

**Root Cause:** Almost certainly one of:
1. Xcode build cache (most likely)
2. Mac DNS cache
3. Simulator network cache

**Solution:** Follow Steps 1-6 above to clear all caches and rebuild.

---

## 📞 Next Steps

**If still not working after following all steps:**

Share these outputs:

1. **From test-ios-connection.sh:**
   ```
   (All test results)
   ```

2. **From Xcode Console:**
   ```
   (The 🌐 debug lines when login is attempted)
   ```

3. **From Mac Terminal:**
   ```bash
   host api.genalphai.com
   curl -I https://api.genalphai.com/api/health
   ```

This will immediately show where the disconnect is happening.

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ test-ios-connection.sh shows all tests passing
2. ✅ Xcode console shows: `🌐 API Request URL: https://api.genalphai.com/api/auth/login`
3. ✅ iOS app successfully logs in without error
4. ✅ Backend nginx logs show iOS user agent requests
5. ✅ App navigates to debate setup screen

---

**Bottom Line:** Backend is perfect. iOS app has stale cached configuration. Follow the 6 steps to clear all caches and rebuild.
