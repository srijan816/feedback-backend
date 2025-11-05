# DNS Configuration Guide for genalphai.com
## Setting up api.genalphai.com for HTTPS

---

## 🎯 **What You Need to Do**

You need to create a **DNS A record** in Hostinger that points `api.genalphai.com` to your VPS server.

**VPS IP Address:** `144.217.164.110`

---

## 📝 **Step-by-Step Instructions (Hostinger)**

### **Step 1: Login to Hostinger**

1. Go to https://www.hostinger.com/
2. Click **Login**
3. Enter your credentials

---

### **Step 2: Navigate to DNS Management**

1. Go to **Dashboard**
2. Find **genalphai.com** in your domains list
3. Click **Manage** next to genalphai.com
4. Look for **DNS / Name Servers** section
5. Click **DNS Zone Editor** or **Manage DNS**

---

### **Step 3: Add A Record**

Click **Add Record** or **Add New Record**

**Fill in these values:**

```
┌─────────────────────────────────────────────────┐
│  Type:     A                                    │
│  Name:     api                                  │
│  Points to: 144.217.164.110                     │
│  TTL:      3600 (or leave default/automatic)    │
└─────────────────────────────────────────────────┘
```

**Explanation:**
- **Type: A** - Maps domain name to IP address
- **Name: api** - Creates subdomain `api.genalphai.com`
- **Points to:** Your VPS IP address
- **TTL:** Time To Live (how long to cache the record)

---

### **Step 4: Save Changes**

1. Click **Save** or **Add Record**
2. Wait for confirmation message

---

### **Step 5: Verify DNS Propagation**

DNS changes can take **5-60 minutes** to propagate.

**Check if DNS is working:**

**Option 1: Command Line (on your computer)**
```bash
host api.genalphai.com
# Should show: api.genalphai.com has address 144.217.164.110

# Or use nslookup:
nslookup api.genalphai.com
# Should show: Address: 144.217.164.110
```

**Option 2: Online Tool**
- Visit: https://dnschecker.org/
- Enter: `api.genalphai.com`
- Click **Search**
- Should show IP: `144.217.164.110` (green checkmarks worldwide)

**Option 3: Your Browser**
- Visit: http://api.genalphai.com:12000/api/health
- Should show: `{"status":"ok",...}`

---

## 📋 **Visual Guide (Hostinger Screenshot Reference)**

Your DNS Zone Editor should look like this after adding the record:

```
┌──────────────────────────────────────────────────────────────┐
│ DNS Zone Editor - genalphai.com                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Type    Name    Points To           TTL      Actions       │
│  ────────────────────────────────────────────────────────   │
│  A       @       [your existing IP]  3600     [Edit] [Del]  │
│  A       www     [your existing IP]  3600     [Edit] [Del]  │
│  A       api     144.217.164.110     3600     [Edit] [Del]  │  ← New record
│  ...                                                         │
│                                                              │
│  [+ Add Record]                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## ⏱️ **How Long Does It Take?**

- **Best case:** 5-10 minutes
- **Typical:** 15-30 minutes
- **Maximum:** Up to 24 hours (rare)

**Tip:** Clear your DNS cache if it's not working:
```bash
# On Mac:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# On Windows:
ipconfig /flushdns

# On Linux:
sudo systemd-resolve --flush-caches
```

---

## ✅ **Verification Checklist**

Before running the SSL setup script, verify:

- [ ] DNS A record created in Hostinger
- [ ] Record type is **A** (not CNAME)
- [ ] Name is **api**
- [ ] Points to **144.217.164.110**
- [ ] DNS propagated (check with `host api.genalphai.com`)
- [ ] Backend is running on VPS (`sudo systemctl status debate-feedback-backend`)

---

## 🚀 **After DNS is Configured**

Once `api.genalphai.com` resolves to `144.217.164.110`, you can run the SSL setup:

```bash
cd /home/ubuntu/apps/feedback-backend
bash setup-ssl.sh
```

The script will:
1. ✅ Check DNS resolution
2. ✅ Install Nginx
3. ✅ Install Certbot (Let's Encrypt client)
4. ✅ Configure reverse proxy
5. ✅ Obtain SSL certificate
6. ✅ Set up auto-renewal
7. ✅ Update backend configuration
8. ✅ Test HTTPS connection

**Total time:** ~5 minutes (after DNS propagates)

---

## 🔧 **Alternative: Using Different Subdomain**

If you prefer a different subdomain, you can use:

**Option 1: `backend.genalphai.com`**
```
Type: A
Name: backend
Points to: 144.217.164.110
```

**Option 2: `debatefeedback.genalphai.com`**
```
Type: A
Name: debatefeedback
Points to: 144.217.164.110
```

**Option 3: Root domain `genalphai.com`**
```
Type: A
Name: @ (or leave blank)
Points to: 144.217.164.110
```

Then update the `DOMAIN` variable in `setup-ssl.sh` accordingly.

---

## ❓ **Troubleshooting**

### **Issue 1: DNS not propagating**

**Cause:** DNS changes can take time.

**Solution:**
- Wait 15-30 minutes
- Clear DNS cache on your computer
- Try different DNS checker tool
- Check Hostinger DNS settings are saved

---

### **Issue 2: "Cannot resolve domain"**

**Cause:** Record not properly configured.

**Solution:**
- Check Name is `api` (not `api.genalphai.com`)
- Check Type is `A` (not CNAME)
- Check no typos in IP address
- Save and wait a few minutes

---

### **Issue 3: Points to wrong IP**

**Cause:** Existing record or typo.

**Solution:**
- Delete any existing `api` record first
- Re-add with correct IP: `144.217.164.110`
- Wait for propagation

---

### **Issue 4: Hostinger shows error**

**Common errors and solutions:**

**"Record already exists"**
- Delete the existing `api` record first
- Then add new one

**"Invalid IP address"**
- Check for typos: `144.217.164.110`
- Make sure no spaces before/after IP

**"Cannot modify DNS"**
- Check domain is not locked
- Check you have correct permissions
- Try different browser

---

## 📞 **Need Help?**

**Check DNS status on VPS:**
```bash
# From your VPS:
host api.genalphai.com

# Should return:
# api.genalphai.com has address 144.217.164.110
```

**If DNS is working but SSL setup fails:**
```bash
# Check backend is running:
sudo systemctl status debate-feedback-backend

# Check port 12000:
curl http://localhost:12000/api/health

# Check firewall:
sudo ufw status
```

---

## 🎯 **Summary**

**What to add in Hostinger:**
```
Type: A
Name: api
Points to: 144.217.164.110
TTL: 3600 (or automatic)
```

**Verify it works:**
```bash
host api.genalphai.com
# Should show: 144.217.164.110
```

**Then run:**
```bash
bash setup-ssl.sh
```

**Result:**
- ✅ HTTPS: `https://api.genalphai.com/api`
- ✅ Free SSL certificate
- ✅ Auto-renewal enabled
- ✅ iOS app compatible (no ATS exceptions needed)

---

**Last Updated:** 2025-10-27
**Domain:** genalphai.com
**Subdomain:** api.genalphai.com
**VPS IP:** 144.217.164.110
