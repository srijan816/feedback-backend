# iOS App Login Fix - Quick Reference

## The Problem
iOS app shows "Resource not found" because it's NOT reaching your backend.
Backend is working perfectly ✅

## The Solution (5 Minutes)

### On Your Mac Terminal:

```bash
# 1. Clear DNS cache
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

# 2. Verify DNS (should show 144.217.164.110)
host api.genalphai.com

# 3. Test backend (should show HTTP 200)
curl -I https://api.genalphai.com/api/health

# 4. Close Xcode and clear cache
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 5. Reset simulator
xcrun simctl erase all
```

### In Xcode:

```
1. Verify Constants.swift:
   Line 14: static let baseURL = "https://api.genalphai.com/api"
   Line 21: static var useMockData = false

2. Add debug logging to APIClient.swift (line 40):
   print("🌐 API Request URL: \(url.absoluteString)")
   print("🌐 Base URL: \(Constants.API.baseURL)")

3. Clean build:
   Product → Clean Build Folder (Shift + Cmd + K)

4. Build and Run (Cmd + R)

5. Try login as "Test Teacher"

6. Check Console output (View → Debug Area)
```

### Expected Console Output:

✅ **Correct:**
```
🌐 API Request URL: https://api.genalphai.com/api/auth/login
🌐 Base URL: https://api.genalphai.com/api
```

❌ **Wrong (old cache):**
```
🌐 API Request URL: http://144.217.164.110:12000/api/auth/login
```

If you see the wrong URL, delete app from simulator and rebuild again.

## Test Credentials

- **Teacher Name:** `Test Teacher`
- **Device ID:** anything (e.g., `my-device-123`)

## More Help

- **Detailed guide:** IOS_APP_FIX_GUIDE.md
- **Diagnostic script:** test-ios-connection.sh
- **Full status:** STATUS_REPORT.md
