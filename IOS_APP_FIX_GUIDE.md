# iOS App "Resource Not Found" - Diagnostic & Fix Guide

## Problem Summary

The iOS app is showing **"Resource not found"** when trying to login. This means:
- ✅ The app IS connecting to a server (getting HTTP 404 response)
- ❌ The app is NOT reaching your backend at `api.genalphai.com`
- ❌ It's likely still using cached old URL or DNS

**Backend Status**: ✅ FULLY WORKING (verified with curl tests)

---

## 🔍 Root Cause Analysis

The error "Resource not found" comes from `NetworkError.notFound` (line 37 in NetworkError.swift), which is thrown when receiving HTTP status code 404.

**Evidence from logs:**
```
Backend nginx logs: NO iOS app requests (only curl tests)
iOS app error: HTTP 404 "Resource not found"
Conclusion: iOS app is reaching WRONG server
```

---

## ✅ Step-by-Step Fix (Run on Your Mac)

### Step 1: Clean DNS Cache on Mac

```bash
# Clear DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Verify DNS resolution
host api.genalphai.com
# Should show: api.genalphai.com has address 144.217.164.110

# Test backend is accessible
curl -I https://api.genalphai.com/api/health
# Should show: HTTP/2 200
```

---

### Step 2: Verify Constants.swift in Xcode

Open your Xcode project and check `DebateFeedback/Utilities/Constants.swift`:

**Line 14 MUST be:**
```swift
static let baseURL = "https://api.genalphai.com/api"
```

**Line 21 MUST be:**
```swift
static var useMockData = false
```

❌ **WRONG VALUES:**
- `http://144.217.164.110:12000/api` (old HTTP URL)
- `http://api.genalphai.com/api` (HTTP instead of HTTPS)
- `https://api.genalphai.com/api/` (extra trailing slash)

---

### Step 3: Clean Build in Xcode

**IMPORTANT**: Xcode caches build files, so even if you update Constants.swift, it might use the old cached values.

```bash
# In Xcode:
1. Product → Clean Build Folder (Shift + Cmd + K)
2. Close Xcode completely (Cmd + Q)

# In Terminal:
cd ~/Library/Developer/Xcode/DerivedData
rm -rf *

# Reopen Xcode
3. Open your project again
4. Product → Build (Cmd + B)
5. Product → Run (Cmd + R)
```

---

### Step 4: Reset iOS Simulator

The simulator might have cached DNS or network settings:

```bash
# Option A: Reset in Simulator
Device → Erase All Content and Settings

# Option B: Reset via Terminal
xcrun simctl erase all
```

---

### Step 5: Add Debug Logging (CRITICAL)

Add these debug lines to **APIClient.swift around line 40** (right after `guard let url = endpoint.url()`):

```swift
guard let url = endpoint.url() else {
    throw NetworkError.invalidURL
}

// ✨ ADD THESE DEBUG LINES:
print("🌐 API Request URL: \(url.absoluteString)")
print("🌐 Base URL: \(Constants.API.baseURL)")
print("🌐 Endpoint path: \(endpoint.path)")
print("🌐 HTTP Method: \(endpoint.method.rawValue)")

var request = URLRequest(url: url)
```

Also add error logging around **line 67** (in the status code check):

```swift
guard (200...299).contains(httpResponse.statusCode) else {
    // ✨ ADD THESE DEBUG LINES:
    print("❌ HTTP Error: \(httpResponse.statusCode)")
    print("❌ Response URL: \(httpResponse.url?.absoluteString ?? "unknown")")
    if let responseData = String(data: data, encoding: .utf8) {
        print("❌ Response body: \(responseData)")
    }

    if httpResponse.statusCode == 401 {
        throw NetworkError.unauthorized
    } else if httpResponse.statusCode == 404 {
        throw NetworkError.notFound
    }
    throw NetworkError.serverError(statusCode: httpResponse.statusCode)
}
```

---

### Step 6: Run and Check Console

1. Build and run (Cmd + R)
2. Try to login as **"Test Teacher"**
3. **Watch Xcode Console** (View → Debug Area → Activate Console)

**Expected output (if working):**
```
🌐 API Request URL: https://api.genalphai.com/api/auth/login
🌐 Base URL: https://api.genalphai.com/api
🌐 Endpoint path: /auth/login
🌐 HTTP Method: POST
```

**Wrong output (if still broken):**
```
🌐 API Request URL: http://144.217.164.110:12000/api/auth/login  ❌
🌐 Base URL: http://144.217.164.110:12000/api                     ❌
```

---

### Step 7: Test Backend from Mac Terminal

Verify your Mac can reach the backend:

```bash
# Test health endpoint
curl https://api.genalphai.com/api/health

# Test login endpoint
curl -X POST https://api.genalphai.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"teacher_id": "Test Teacher", "device_id": "test-mac-123"}' \
  -v

# Should return 200 OK with token
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Still seeing old URL in console

**Cause**: Xcode build cache not cleared
**Solution**:
1. Delete app from simulator (long press → Delete App)
2. Clean build folder (Shift + Cmd + K)
3. Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/*`
4. Restart Xcode
5. Build and run again

---

### Issue 2: DNS still resolving to old IP

**Cause**: macOS DNS cache persists even after flush
**Solution**:
```bash
# More aggressive DNS flush
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
sudo killall mDNSResponderHelper
sudo dscacheutil -flushcache

# Restart networking
sudo ifconfig en0 down
sudo ifconfig en0 up

# Verify DNS
host api.genalphai.com
```

---

### Issue 3: "The resource could not be loaded..."

**Cause**: Network connection issue or certificate problem
**Solution**:
1. Test in Safari on simulator: `https://api.genalphai.com/api/health`
2. Should show: `{"status":"ok",...}`
3. If certificate error, check date/time on Mac and simulator

---

### Issue 4: Certificate/SSL Error

**Cause**: Self-signed certificate or date issue
**Solution**:
```bash
# On VPS, check certificate
curl -v https://api.genalphai.com/api/health

# Should show valid certificate from Let's Encrypt
# On Mac, check system date is correct
date
```

---

## 📊 What to Share for Debugging

If still not working, share these outputs:

### 1. From Xcode Console:
```
(The 🌐 and ❌ debug lines when you try to login)
```

### 2. From Mac Terminal:
```bash
host api.genalphai.com
curl -I https://api.genalphai.com/api/health
```

### 3. From Constants.swift:
```
(Lines 14 and 21 - copy-paste the exact values)
```

---

## ✅ Success Indicators

When working correctly, you should see:

**Xcode Console:**
```
🌐 API Request URL: https://api.genalphai.com/api/auth/login
🌐 Base URL: https://api.genalphai.com/api
🌐 Endpoint path: /auth/login
✅ Login successful
```

**App Behavior:**
- No error message
- Successful login
- Navigation to next screen

---

## 🎯 Quick Checklist

Before reaching out:
- [ ] DNS cache cleared on Mac
- [ ] `host api.genalphai.com` shows 144.217.164.110
- [ ] Constants.swift line 14 = `"https://api.genalphai.com/api"` (no trailing slash)
- [ ] Constants.swift line 21 = `false`
- [ ] Clean build performed (Shift + Cmd + K)
- [ ] Derived data deleted
- [ ] Simulator reset
- [ ] Debug logging added to APIClient.swift
- [ ] Xcode console output captured
- [ ] Terminal curl test successful

---

## 🔐 Valid Test Credentials

**Teacher ID:** `Test Teacher` (case-sensitive)
**Device ID:** Any string (e.g., `test-device-123`)

**Backend User Database:**
```
ID: cda41ea5-1f4e-4b78-bfe2-6e48b5b83a63
Email: test@school.com
Name: Test Teacher
Role: teacher
```

---

## 📞 Backend Verification (Already Done)

✅ Backend is running on port 12000
✅ Nginx reverse proxy configured correctly
✅ SSL certificate valid (expires Jan 25, 2026)
✅ DNS pointing to 144.217.164.110
✅ Login endpoint tested and working with curl
✅ Test user exists in database
✅ All endpoints returning correct responses

**The issue is 100% on the iOS/Mac side.**

---

## Next Steps

1. Follow Steps 1-6 above
2. Capture the debug output from Step 6
3. Share the output if still not working

The debug output will show exactly what URL the iOS app is trying to reach, which will immediately identify the problem.
