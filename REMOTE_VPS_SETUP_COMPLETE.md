# 🌐 Remote VPS Setup - COMPLETE!

## ✅ System is Now Accessible Remotely

The web-based teacher portal has been properly configured for remote VPS access with SSL/HTTPS.

---

## 🔗 **Live URLs**

### **Domain:** `api.genalphai.com`

### **Teacher Portal URLs:**

| Teacher | URL |
|---------|-----|
| **Srijan** | https://api.genalphai.com/srijan |
| **Tamkeen** | https://api.genalphai.com/tamkeen |
| **Mai** | https://api.genalphai.com/mai |
| **Saurav** | https://api.genalphai.com/saurav |
| **Jami** | https://api.genalphai.com/jami |
| **Naveen** | https://api.genalphai.com/naveen |

### **API Endpoints:**
- Health Check: https://api.genalphai.com/api/health
- Dashboard API: https://api.genalphai.com/api/teachers/:name/dashboard
- All other endpoints: https://api.genalphai.com/api/*

---

## 🔧 Configuration Changes Made

### 1. **Frontend Updates**
- ✅ Changed from `localhost` to dynamic `window.location.origin`
- ✅ WebSocket connection uses secure WSS protocol
- ✅ Automatically adapts to domain (works on any URL)

### 2. **Nginx Configuration**
- ✅ Updated with proper WebSocket support for Socket.IO
- ✅ Separate location block for `/socket.io/` with WebSocket headers
- ✅ Extended timeouts for WebSocket connections (7 days)
- ✅ Proper SSL/TLS termination
- ✅ X-Frame-Options set to SAMEORIGIN (allows embedding)

### 3. **Server Configuration**
- ✅ WebSocket CORS configured for all origins
- ✅ Rate limiting validation adjusted for proxy setup
- ✅ Trust proxy enabled for nginx reverse proxy
- ✅ Both websocket and polling transports enabled

---

## 📊 System Status

**✅ ALL SYSTEMS OPERATIONAL**

```bash
# Health Check Response:
{
  "status": "ok",
  "timestamp": "2025-11-05T18:45:21.841Z",
  "uptime": 10.206267533
}

# Server Status:
- Running on port 12000 (internal)
- Proxied through nginx on port 443 (HTTPS)
- SSL certificate: Valid (Let's Encrypt)
- WebSocket: Active and connected
```

---

## 🧪 Test the System

### 1. **Access Teacher Portal**
Open in your browser:
```
https://api.genalphai.com/srijan
```

You should see:
- ✅ Dashboard with 3 sections (Active Debates, Pending Reviews, History)
- ✅ Green "Connected" status badge (WebSocket connected)
- ✅ Teacher name displayed in header
- ✅ Auto-refresh every 30 seconds

### 2. **Test WebSocket Connection**
Open browser console (F12) and you should see:
```
WebSocket connected
```

### 3. **Test API Endpoints**
```bash
# Health check
curl https://api.genalphai.com/api/health

# Dashboard (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.genalphai.com/api/teachers/srijan/dashboard
```

---

## 🔐 Security Features

✅ **HTTPS/SSL** - All traffic encrypted with Let's Encrypt certificate
✅ **HSTS** - Strict Transport Security enabled (max-age: 1 year)
✅ **Content Security Policy** - Protects against XSS attacks
✅ **X-Frame-Options** - SAMEORIGIN (prevents clickjacking)
✅ **X-Content-Type-Options** - nosniff (prevents MIME sniffing)
✅ **Rate Limiting** - Prevents abuse (100 requests/min per IP)
✅ **CORS** - Configured for API access

---

## 🌍 Network Configuration

### VPS Details:
- **IP Address:** 144.217.164.110
- **Domain:** api.genalphai.com
- **SSL Provider:** Let's Encrypt
- **Web Server:** Nginx 1.26.3
- **Application Server:** Node.js (Express)
- **Port:** 12000 (internal), 443 (external HTTPS)

### Nginx Reverse Proxy:
```
External (HTTPS):443 → Nginx → Internal (HTTP):12000
```

### WebSocket Flow:
```
Browser (WSS) → Nginx (Upgrade) → Node.js (Socket.IO)
```

---

## 📱 How to Use (Remote Access)

### **For Teachers:**

1. **Open Portal**
   - Navigate to: `https://api.genalphai.com/srijan` (or your teacher name)
   - Works from **any device**: desktop, laptop, tablet, mobile

2. **View Dashboard**
   - Active debates (if any iOS app uploads in progress)
   - Pending reviews (feedback awaiting approval)
   - Feedback history (approved feedback)

3. **Real-Time Updates**
   - WebSocket connection shows green "Connected" status
   - Receives notifications when:
     - New feedback is ready
     - DOCX file is generated
     - Speech is completed

4. **Edit & Approve Feedback**
   - Click "Review & Edit" on any pending feedback
   - Modify scores, text, add notes
   - Auto-saves every 3 seconds
   - Click "Approve" to generate DOCX

5. **Download DOCX**
   - After approval, DOCX generates automatically
   - Notification appears when ready
   - Click download link to get Word document

---

## 🔄 Integration with iOS App

**The iOS app workflow remains UNCHANGED:**

```
1. Teacher records speech on iOS app
   ↓
2. iOS app uploads to: https://api.genalphai.com/api/debates/:id/speeches
   ↓
3. Backend processes (transcription + feedback)
   ↓
4. Web portal receives WebSocket notification
   ↓
5. Teacher can now review on web portal
```

**Both systems work together seamlessly:**
- iOS app: For recording and uploading
- Web portal: For reviewing, editing, and approving

---

## 🛠️ Maintenance Commands

### Check Server Status:
```bash
pm2 status
pm2 logs feedback-api
```

### Restart Server:
```bash
pm2 restart feedback-api
```

### Check Nginx:
```bash
sudo systemctl status nginx
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Reload config
```

### View Nginx Logs:
```bash
sudo tail -f /var/log/nginx/debate-feedback-access.log
sudo tail -f /var/log/nginx/debate-feedback-error.log
```

### Check SSL Certificate:
```bash
sudo certbot certificates
```

### Renew SSL Certificate (automatic, but manual if needed):
```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## 🐛 Troubleshooting

### Issue: Can't Access Portal
**Check:**
1. Server running: `pm2 status`
2. Nginx running: `sudo systemctl status nginx`
3. DNS resolving: `nslookup api.genalphai.com`
4. Firewall: `sudo ufw status` (should allow 443)

**Fix:**
```bash
pm2 restart feedback-api
sudo systemctl restart nginx
```

### Issue: WebSocket Not Connecting
**Check:**
1. Browser console for errors
2. CSP allows wss: connections (already configured)
3. Nginx WebSocket upgrade headers (already configured)

**Fix:**
```bash
# Check nginx config
sudo nginx -t

# Restart nginx
sudo systemctl reload nginx
```

### Issue: "Not Secure" Warning
**Check SSL certificate:**
```bash
sudo certbot certificates
```

**Renew if expired:**
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Issue: 502 Bad Gateway
**Backend not running:**
```bash
pm2 status
pm2 restart feedback-api
pm2 logs feedback-api --lines 50
```

---

## 📈 Performance & Monitoring

### Check System Health:
```bash
# API health
curl https://api.genalphai.com/api/health

# Server resources
pm2 monit

# Nginx connections
sudo systemctl status nginx
```

### Monitor Logs:
```bash
# Application logs
pm2 logs feedback-api

# Nginx access
sudo tail -f /var/log/nginx/debate-feedback-access.log

# Nginx errors
sudo tail -f /var/log/nginx/debate-feedback-error.log
```

---

## 🎉 What's Working

✅ **HTTPS/SSL** - Secure encrypted connections
✅ **Teacher Portals** - All 6 teacher URLs accessible remotely
✅ **WebSocket** - Real-time notifications working
✅ **API Endpoints** - All routes accessible via domain
✅ **File Uploads** - Audio uploads work (100MB limit)
✅ **DOCX Generation** - Word documents created and downloadable
✅ **Mobile Responsive** - Works on all device sizes
✅ **Auto-Refresh** - Dashboard updates every 30 seconds
✅ **Reverse Proxy** - Nginx properly configured
✅ **Rate Limiting** - Abuse protection active

---

## 🌟 Key URLs to Share

**For Teachers:**
```
Srijan:  https://api.genalphai.com/srijan
Tamkeen: https://api.genalphai.com/tamkeen
Mai:     https://api.genalphai.com/mai
Saurav:  https://api.genalphai.com/saurav
Jami:    https://api.genalphai.com/jami
Naveen:  https://api.genalphai.com/naveen
```

**For API/iOS App:**
```
Base URL: https://api.genalphai.com
API Docs: https://api.genalphai.com/api/health
```

---

## 📝 Next Steps

### Optional Enhancements:
1. **Authentication** - Add login page for teachers
2. **Email Notifications** - Send alerts when feedback ready
3. **Custom Domain** - Add additional domain if needed
4. **Backup System** - Automated database backups
5. **Analytics** - Track teacher portal usage
6. **Mobile App** - Native iOS/Android teacher app

### Monitoring:
1. **Uptime Monitoring** - Set up UptimeRobot or similar
2. **Error Tracking** - Integrate Sentry or similar
3. **Performance** - Monitor response times
4. **SSL Expiry** - Alert before certificate expires

---

## 🎊 Success!

Your web-based teacher portal is now **fully operational** and accessible from anywhere in the world via:

**https://api.genalphai.com**

**Features:**
- ✅ Secure HTTPS access
- ✅ Real-time WebSocket notifications
- ✅ Remote accessibility from any device
- ✅ Professional DOCX generation
- ✅ Editable feedback with version tracking
- ✅ Approval workflow
- ✅ Integration with existing iOS app

**All 6 teachers can now access their portals remotely!** 🚀

---

**Configured:** November 5, 2025
**Status:** ✅ LIVE & OPERATIONAL
**Domain:** api.genalphai.com
**Protocol:** HTTPS (SSL/TLS)
**Access:** Remote (Worldwide)
