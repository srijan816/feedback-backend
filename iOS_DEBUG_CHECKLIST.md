# iOS App Login Debug Checklist

## Issue: "Resource not found" error when logging in

---

## 🔍 **Step 1: Verify DNS on Your Device/Simulator**

### **On Mac (where Xcode is running):**

```bash
# Clear DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Test DNS resolution
host api.genalphai.com

# Should show: api.genalphai.com has address 144.217.164.110
```

### **On iOS Simulator:**

1. **Reset simulator:**
   - Device → Erase All Content and Settings
   - Or run: `xcrun simctl erase all`

2. **Test in Safari on simulator:**
   - Open Safari
   - Go to: `https://api.genalphai.com/api/health`
   - Should show: `{"status":"ok",...}`

---

## 📱 **Step 2: Verify iOS App Configuration**

### **File 1: Constants.swift**

Check **line 14:**
```swift
static let baseURL = "https://api.genalphai.com/api"
```

❌ NOT:
- `http://144.217.164.110:12000/api`
- `http://api.genalphai.com/api`
- `https://api.genalphai.com/api/` (with trailing slash)

Check **line 21:**
```swift
static var useMockData = false
```

❌ NOT: `true`

---

## 🔐 **Step 3: Check Info.plist ATS Settings**

### **Option A: Allow HTTPS with proper SSL (RECOMMENDED)**

If using HTTPS (`api.genalphai.com`), you should **REMOVE** the entire `NSAppTransportSecurity` section from Info.plist.

### **Option B: If testing with HTTP (not recommended)**

Only if you're still using `http://`, add this to Info.plist:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>api.genalphai.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

---

## 🐛 **Step 4: Add Debug Logging**

### **In APIClient.swift (around line 40):**

Add this right after getting the URL:

```swift
guard let url = endpoint.url() else {
    throw NetworkError.invalidURL
}

// ADD THESE DEBUG LINES:
print("🌐 API Request URL: \(url.absoluteString)")
print("🌐 Base URL: \(Constants.API.baseURL)")
print("🌐 Endpoint path: \(endpoint.path)")

var request = URLRequest(url: url)
```

### **In APIClient.swift (around line 67 - error handling):**

Add this to see the exact error:

```swift
guard (200...299).contains(httpResponse.statusCode) else {
    // ADD THIS:
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

Then **rebuild and run** - check Xcode console for the debug output.

---

## 🧪 **Step 5: Test Direct URL**

### **In Xcode Console:**

When you try to login, you should see something like:
```
🌐 API Request URL: https://api.genalphai.com/api/auth/login
🌐 Base URL: https://api.genalphai.com/api
🌐 Endpoint path: /auth/login
```

**If you see:**
- ❌ `http://` instead of `https://` - Fix Constants.swift
- ❌ Different IP address - DNS cache issue
- ❌ Wrong path - Check Endpoints.swift
- ❌ 404 error - Backend endpoint issue

---

## 🔄 **Step 6: Clean Build**

```bash
# In Xcode:
1. Product → Clean Build Folder (Shift + Cmd + K)
2. Close Xcode completely
3. Delete derived data:
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
4. Reopen Xcode
5. Build and Run (Cmd + R)
```

---

## 🧪 **Step 7: Test Backend Directly**

### **From Mac Terminal:**

```bash
# Test login endpoint
curl -X POST https://api.genalphai.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"teacher_id": "Test Teacher", "device_id": "test-123"}' \
  -v

# Should return 200 OK with token
```

**If this works but iOS app doesn't:**
- DNS cache issue on simulator/device
- ATS blocking the connection
- Wrong URL in Constants.swift

---

## 📊 **Common Issues & Solutions**

### **Issue 1: Still seeing old IP (144.217.164.110:12000)**

**Solution:**
- Double-check Constants.swift line 14
- Clean build (Shift + Cmd + K)
- Delete app from simulator
- Rebuild

---

### **Issue 2: "The resource could not be loaded..."**

**Solution:**
- Check Info.plist ATS settings
- Use HTTPS not HTTP
- Remove or update ATS exceptions

---

### **Issue 3: 404 Not Found**

**Possible causes:**
- Wrong base URL (missing `/api` at the end)
- Extra slash in URL (`/api/` instead of `/api`)
- DNS pointing to wrong server
- Vercel still intercepting requests

**Solution:**
```swift
// Correct:
static let baseURL = "https://api.genalphai.com/api"

// Wrong:
static let baseURL = "https://api.genalphai.com"
static let baseURL = "https://api.genalphai.com/api/"
static let baseURL = "http://api.genalphai.com/api"
```

---

### **Issue 4: SSL Certificate Error**

**Solution:**
- Verify backend SSL: `curl -v https://api.genalphai.com/api/health`
- Check certificate: `sudo certbot certificates`
- Restart Nginx: `sudo systemctl restart nginx`

---

## ✅ **Expected Behavior**

When login works correctly, you should see in Xcode console:

```
🌐 API Request URL: https://api.genalphai.com/api/auth/login
🌐 Base URL: https://api.genalphai.com/api
🌐 Endpoint path: /auth/login
✅ Login successful
```

And the app should navigate to the next screen.

---

## 📞 **Still Not Working?**

### **Send these debug outputs:**

1. **From Xcode Console:**
   - The 🌐 API Request URL line
   - Any ❌ error messages

2. **From Mac Terminal:**
   ```bash
   host api.genalphai.com
   curl -I https://api.genalphai.com/api/health
   ```

3. **From Constants.swift:**
   - Lines 14 and 21 (copy-paste the actual values)

---

## 🎯 **Quick Fix Checklist**

- [ ] Constants.swift line 14 = `"https://api.genalphai.com/api"`
- [ ] Constants.swift line 21 = `false`
- [ ] No trailing slash in baseURL
- [ ] Info.plist ATS exception removed (for HTTPS)
- [ ] Clean build performed
- [ ] Derived data deleted
- [ ] Simulator reset
- [ ] DNS cache cleared
- [ ] Backend health check works in Safari
- [ ] Debug logging added

