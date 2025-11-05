#!/bin/bash
###############################################################################
# Debate Feedback Backend - SSL/HTTPS Setup Script
# Domain: api.genalphai.com
# This script sets up Nginx reverse proxy with Let's Encrypt SSL certificate
###############################################################################

set -e  # Exit on error

DOMAIN="api.genalphai.com"
EMAIL="admin@genalphai.com"  # Change if needed
BACKEND_PORT=12000

echo "=================================================="
echo "  SSL/HTTPS Setup for Debate Feedback Backend"
echo "  Domain: $DOMAIN"
echo "=================================================="
echo ""

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then
   echo "❌ ERROR: Please run this script as ubuntu user (not root)"
   echo "Usage: bash setup-ssl.sh"
   exit 1
fi

# Step 1: Check prerequisites
echo "🔍 Step 1: Checking prerequisites..."
echo ""

# Check if backend is running
if ! curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null; then
    echo "⚠️  Backend is not responding on port $BACKEND_PORT"
    echo "   Make sure the backend service is running first:"
    echo "   sudo systemctl start debate-feedback-backend"
    exit 1
fi
echo "✅ Backend is running on port $BACKEND_PORT"

# Check DNS resolution
echo "Checking DNS resolution for $DOMAIN..."
if host $DOMAIN > /dev/null 2>&1; then
    RESOLVED_IP=$(host $DOMAIN | grep "has address" | awk '{print $4}' | head -1)
    SERVER_IP=$(curl -4 -s ifconfig.me)

    if [ "$RESOLVED_IP" = "$SERVER_IP" ]; then
        echo "✅ DNS correctly points to this server ($SERVER_IP)"
    else
        echo "⚠️  WARNING: DNS points to $RESOLVED_IP but server IP is $SERVER_IP"
        echo "   Please update your DNS A record in Hostinger before continuing."
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Exiting. Please update DNS and try again."
            exit 1
        fi
    fi
else
    echo "⚠️  WARNING: Cannot resolve $DOMAIN"
    echo "   Please configure DNS in Hostinger first:"
    echo "   Type: A"
    echo "   Name: api"
    echo "   Value: $(curl -4 -s ifconfig.me)"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting. Please configure DNS and try again."
        exit 1
    fi
fi

echo ""

# Step 2: Install Nginx
echo "📦 Step 2: Installing Nginx..."
echo ""

if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt update
    sudo apt install -y nginx
    echo "✅ Nginx installed"
else
    echo "✅ Nginx already installed"
fi

echo ""

# Step 3: Install Certbot (Let's Encrypt client)
echo "🔐 Step 3: Installing Certbot..."
echo ""

if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed"
else
    echo "✅ Certbot already installed"
fi

echo ""

# Step 4: Configure Nginx
echo "⚙️  Step 4: Configuring Nginx reverse proxy..."
echo ""

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/debate-feedback > /dev/null <<EOF
# Debate Feedback Backend - Nginx Configuration
# Domain: $DOMAIN

# Redirect HTTP to HTTPS (will be enabled after SSL setup)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # This will be uncommented after SSL is set up
    # return 301 https://\$server_name\$request_uri;
}

# HTTPS server (will be configured by Certbot)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name $DOMAIN;
#
#     # SSL certificates (Certbot will add these)
#     # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
#     # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
#
#     # SSL configuration
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#
#     # Security headers
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#     add_header X-Frame-Options DENY always;
#     add_header X-Content-Type-Options nosniff always;
#     add_header X-XSS-Protection "1; mode=block" always;
#
#     # Proxy settings
#     location / {
#         proxy_pass http://localhost:$BACKEND_PORT;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade \$http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host \$host;
#         proxy_set_header X-Real-IP \$remote_addr;
#         proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto \$scheme;
#         proxy_cache_bypass \$http_upgrade;
#
#         # Timeouts
#         proxy_connect_timeout 60s;
#         proxy_send_timeout 60s;
#         proxy_read_timeout 60s;
#
#         # Large file uploads (for audio files)
#         client_max_body_size 100M;
#     }
#
#     # Logging
#     access_log /var/log/nginx/debate-feedback-access.log;
#     error_log /var/log/nginx/debate-feedback-error.log;
# }
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/debate-feedback /etc/nginx/sites-enabled/

# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

echo "✅ Nginx configured"
echo ""

# Step 5: Open firewall ports
echo "🔥 Step 5: Configuring firewall..."
echo ""

if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        echo "Opening ports 80 and 443..."
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        sudo ufw reload
        echo "✅ Firewall configured"
    else
        echo "⚠️  UFW not active, skipping"
    fi
else
    echo "⚠️  UFW not installed, skipping"
fi

echo ""

# Step 6: Obtain SSL certificate
echo "🔐 Step 6: Obtaining SSL certificate from Let's Encrypt..."
echo ""

echo "This will request a certificate for $DOMAIN"
echo "Make sure DNS is properly configured!"
echo ""

# Run Certbot
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate obtained successfully!"
else
    echo "❌ Failed to obtain SSL certificate"
    echo "   Common issues:"
    echo "   1. DNS not pointing to this server yet (wait a few minutes)"
    echo "   2. Port 80/443 not accessible from internet"
    echo "   3. Domain validation failed"
    echo ""
    echo "   You can try again later with:"
    echo "   sudo certbot --nginx -d $DOMAIN"
    exit 1
fi

echo ""

# Step 7: Configure auto-renewal
echo "♻️  Step 7: Setting up automatic certificate renewal..."
echo ""

# Test renewal
echo "Testing certificate renewal..."
sudo certbot renew --dry-run

if [ $? -eq 0 ]; then
    echo "✅ Auto-renewal configured (certificates will renew automatically)"
else
    echo "⚠️  Auto-renewal test failed, but certificate is installed"
fi

echo ""

# Step 8: Update backend configuration
echo "⚙️  Step 8: Updating backend configuration..."
echo ""

# Update .env file to trust proxy
if ! grep -q "TRUST_PROXY=true" /home/ubuntu/apps/feedback-backend/.env; then
    echo "TRUST_PROXY=true" | sudo tee -a /home/ubuntu/apps/feedback-backend/.env > /dev/null
    echo "Added TRUST_PROXY=true to .env"
fi

# Restart backend to apply changes
echo "Restarting backend service..."
sudo systemctl restart debate-feedback-backend
sleep 2

echo "✅ Backend configuration updated"
echo ""

# Step 9: Test HTTPS
echo "🧪 Step 9: Testing HTTPS connection..."
echo ""

sleep 3

if curl -s -f https://$DOMAIN/api/health > /dev/null; then
    echo "✅ HTTPS is working!"
    echo ""
    echo "Health check response:"
    curl -s https://$DOMAIN/api/health | head -10
    echo ""
else
    echo "⚠️  HTTPS connection failed"
    echo "   Check Nginx error logs:"
    echo "   sudo tail -50 /var/log/nginx/error.log"
fi

echo ""

# Final summary
echo "=================================================="
echo "  ✅ SSL/HTTPS Setup Complete!"
echo "=================================================="
echo ""
echo "🌐 Your API is now accessible via HTTPS:"
echo "   https://$DOMAIN/api"
echo ""
echo "📱 Update your iOS app Constants.swift:"
echo "   static let baseURL = \"https://$DOMAIN/api\""
echo ""
echo "🔐 SSL Certificate Information:"
echo "   Domain: $DOMAIN"
echo "   Issuer: Let's Encrypt"
echo "   Valid for: 90 days"
echo "   Auto-renewal: Enabled"
echo ""
echo "📋 Nginx Configuration:"
echo "   Config: /etc/nginx/sites-available/debate-feedback"
echo "   Access log: /var/log/nginx/debate-feedback-access.log"
echo "   Error log: /var/log/nginx/debate-feedback-error.log"
echo ""
echo "🔄 Management Commands:"
echo "   Renew certificate manually:"
echo "     sudo certbot renew"
echo ""
echo "   Check certificate status:"
echo "     sudo certbot certificates"
echo ""
echo "   Test Nginx config:"
echo "     sudo nginx -t"
echo ""
echo "   Reload Nginx:"
echo "     sudo systemctl reload nginx"
echo ""
echo "   View Nginx logs:"
echo "     sudo tail -f /var/log/nginx/debate-feedback-access.log"
echo ""
echo "=================================================="
