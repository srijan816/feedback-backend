# 🔐 HTTPS Setup Quick Start Guide
## Domain: api.genalphai.com

---

## 🎯 **Goal**

Set up HTTPS for your backend so iOS app can connect securely without ATS exceptions.

**Current:** `http://144.217.164.110:12000/api` ❌  
**Target:** `https://api.genalphai.com/api` ✅

---

## 📋 **3-Step Process**

### **Step 1: Configure DNS in Hostinger** (5 minutes)

**What to do:**

1. Login to Hostinger (https://www.hostinger.com)
2. Go to genalphai.com → DNS Management
3. Add this A record:
   ```
   Type:      A
   Name:      api
   Points to: 144.217.164.110
   TTL:       3600 (or automatic)
   ```
4. Save and wait 5-30 minutes for propagation

**Verify it works:**
```bash
host api.genalphai.com
# Should show: api.genalphai.com has address 144.217.164.110
```

📖 **Detailed guide:** `DNS_CONFIGURATION_GUIDE.md`

---

### **Step 2: Run SSL Setup Script** (5 minutes)

**After DNS is working, run:**

```bash
cd /home/ubuntu/apps/feedback-backend
bash setup-ssl.sh
```

**The script will automatically:**
- ✅ Install Nginx reverse proxy
- ✅ Install Let's Encrypt (Certbot)
- ✅ Request free SSL certificate
- ✅ Configure HTTPS with security headers
- ✅ Set up auto-renewal (every 90 days)
- ✅ Update backend configuration
- ✅ Test the connection

**Expected output:**
```
✅ SSL certificate obtained successfully!
✅ HTTPS is working!
https://api.genalphai.com/api
```

---

### **Step 3: Update iOS App** (2 minutes)

**File:** `DebateFeedback/Utilities/Constants.swift`

**Line 14:**
```swift
static let baseURL = "https://api.genalphai.com/api"
```

**Line 21:**
```swift
static var useMockData = false
```

**Remove from Info.plist:**
Delete the NSAppTransportSecurity section (no longer needed with HTTPS!)

---

## ✅ **Verification**

**Test HTTPS is working:**

1. **From browser:** https://api.genalphai.com/api/health
   
   Should show:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-10-27T...",
     "uptime": 123.456
   }
   ```

2. **From command line:**
   ```bash
   curl https://api.genalphai.com/api/health
   ```

3. **Check SSL certificate:**
   ```bash
   sudo certbot certificates
   ```

---

## 🎯 **Summary Timeline**

```
1. Configure DNS in Hostinger             →  5 minutes
2. Wait for DNS propagation               →  5-30 minutes
3. Run setup-ssl.sh script                →  5 minutes
4. Update iOS app Constants.swift         →  2 minutes
───────────────────────────────────────────────────────────
Total time: ~20-45 minutes (mostly waiting for DNS)
```

---

## 🚨 **Important Notes**

1. **DNS must be configured first** - The SSL script will fail if DNS is not pointing to your VPS
2. **Backend must be running** - Make sure services are active before running SSL script
3. **Ports 80 and 443** - Script will automatically open these (for SSL verification and HTTPS)
4. **Certificate renewal** - Automatic! Certbot renews every 90 days via cron job

---

## 📞 **Troubleshooting**

### **DNS not working?**
```bash
# Check DNS:
host api.genalphai.com

# If not working:
# - Wait longer (up to 60 minutes)
# - Check Hostinger DNS settings
# - Clear local DNS cache
```

### **SSL script fails?**
```bash
# Check backend is running:
sudo systemctl status debate-feedback-backend

# Check DNS resolves correctly:
host api.genalphai.com

# Re-run the script:
bash setup-ssl.sh
```

### **HTTPS not working after setup?**
```bash
# Check Nginx status:
sudo systemctl status nginx

# Check Nginx logs:
sudo tail -50 /var/log/nginx/error.log

# Restart Nginx:
sudo systemctl restart nginx
```

---

## 🎉 **After Setup Complete**

**Your backend will be accessible at:**
- ✅ `https://api.genalphai.com/api` (HTTPS - for iOS app)
- ✅ `http://api.genalphai.com/api` (redirects to HTTPS)
- ✅ `https://api.genalphai.com/api/health` (health check)
- ✅ `https://api.genalphai.com/api/auth/login` (all endpoints)

**iOS app configuration:**
```swift
static let baseURL = "https://api.genalphai.com/api"
static var useMockData = false
// No ATS exceptions needed!
```

**SSL Certificate:**
- Issuer: Let's Encrypt
- Valid: 90 days (auto-renews)
- Type: Free!

---

## 📚 **Related Documentation**

1. **DNS_CONFIGURATION_GUIDE.md** - Detailed Hostinger DNS setup
2. **IOS_APP_INTEGRATION_GUIDE.md** - Complete iOS integration (will be updated with HTTPS)
3. **setup-ssl.sh** - The automated SSL setup script
4. **SETUP_COMPLETE.md** - Original HTTP setup guide

---

## 🔐 **Security Benefits**

With HTTPS you get:
- ✅ Encrypted data transmission
- ✅ iOS App Transport Security compliance
- ✅ No ATS exceptions needed
- ✅ HTTPS-only iOS requirements met
- ✅ Professional API endpoint
- ✅ Protection against man-in-the-middle attacks
- ✅ Better SEO (if using web frontend later)
- ✅ Modern security headers (HSTS, etc.)

---

**Ready to start? Go to Step 1: Configure DNS in Hostinger!**

📖 See `DNS_CONFIGURATION_GUIDE.md` for detailed instructions.
