#!/bin/bash
###############################################################################
# Debate Feedback Backend - Service Setup Script
# This script configures the backend to run headlessly as systemd services
###############################################################################

set -e  # Exit on error

echo "=================================================="
echo "  Debate Feedback Backend - Service Setup"
echo "=================================================="
echo ""

# Check if running with correct user
if [ "$EUID" -eq 0 ]; then
   echo "❌ ERROR: Please run this script as ubuntu user (not root)"
   echo "Usage: bash setup-services.sh"
   exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Step 1: Check prerequisites
echo "🔍 Step 1: Checking prerequisites..."
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi
echo "✅ npm is installed: $(npm --version)"

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo "⚠️  PostgreSQL is not running. Starting it..."
    sudo systemctl start postgresql
fi
echo "✅ PostgreSQL is running"

# Check if Redis is running
if ! systemctl is-active --quiet redis || ! systemctl is-active --quiet redis-server; then
    echo "⚠️  Redis is not running. Starting it..."
    sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || true
fi
echo "✅ Redis is running"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "⚠️  Please edit .env file with your configuration before starting services"
    else
        echo "❌ .env.example not found. Cannot proceed."
        exit 1
    fi
else
    echo "✅ .env file exists"
fi

echo ""

# Step 2: Build the application
echo "🔨 Step 2: Building the application..."
echo ""

npm run build
echo "✅ Build completed successfully"
echo ""

# Step 3: Install systemd service files
echo "📦 Step 3: Installing systemd service files..."
echo ""

# Copy service files to systemd directory
sudo cp debate-feedback-backend.service /etc/systemd/system/
sudo cp debate-feedback-worker.service /etc/systemd/system/

# Set proper permissions
sudo chmod 644 /etc/systemd/system/debate-feedback-backend.service
sudo chmod 644 /etc/systemd/system/debate-feedback-worker.service

echo "✅ Service files installed"
echo ""

# Step 4: Reload systemd
echo "🔄 Step 4: Reloading systemd daemon..."
echo ""

sudo systemctl daemon-reload
echo "✅ Systemd reloaded"
echo ""

# Step 5: Enable services (start on boot)
echo "🚀 Step 5: Enabling services..."
echo ""

sudo systemctl enable debate-feedback-backend.service
sudo systemctl enable debate-feedback-worker.service

echo "✅ Services enabled (will start on boot)"
echo ""

# Step 6: Start services
echo "▶️  Step 6: Starting services..."
echo ""

sudo systemctl start debate-feedback-backend.service
sleep 2  # Give backend time to start
sudo systemctl start debate-feedback-worker.service
sleep 2  # Give worker time to start

echo "✅ Services started"
echo ""

# Step 7: Check service status
echo "📊 Step 7: Checking service status..."
echo ""

echo "Backend Service:"
sudo systemctl status debate-feedback-backend.service --no-pager -l | head -15
echo ""

echo "Worker Service:"
sudo systemctl status debate-feedback-worker.service --no-pager -l | head -15
echo ""

# Step 8: Configure firewall
echo "🔥 Step 8: Configuring firewall..."
echo ""

if command -v ufw &> /dev/null; then
    # Check if UFW is active
    if sudo ufw status | grep -q "Status: active"; then
        echo "UFW is active. Checking port 3000..."

        # Check if port 3000 is already allowed
        if sudo ufw status | grep -q "3000"; then
            echo "✅ Port 3000 is already allowed"
        else
            echo "Opening port 3000..."
            sudo ufw allow 3000/tcp
            echo "✅ Port 3000 opened"
        fi
    else
        echo "⚠️  UFW is not active. Skipping firewall configuration."
        echo "   If you have another firewall, manually open port 3000/tcp"
    fi
else
    echo "⚠️  UFW not found. If you have another firewall, manually open port 3000/tcp"
fi

echo ""

# Step 9: Get server IP
echo "🌐 Step 9: Server network information..."
echo ""

PUBLIC_IP=$(curl -4 -s ifconfig.me || echo "Unable to detect")
PRIVATE_IP=$(hostname -I | awk '{print $1}')

echo "Public IP:  $PUBLIC_IP"
echo "Private IP: $PRIVATE_IP"
echo ""

# Step 10: Test the API
echo "🧪 Step 10: Testing the API..."
echo ""

sleep 3  # Give services a moment to fully start

if curl -s -f http://localhost:3000/api/health > /dev/null; then
    echo "✅ Backend API is responding!"
    echo ""
    echo "Health check response:"
    curl -s http://localhost:3000/api/health | head -10
    echo ""
else
    echo "⚠️  Backend API is not responding yet. Check logs with:"
    echo "   sudo journalctl -u debate-feedback-backend -f"
fi

echo ""

# Final summary
echo "=================================================="
echo "  ✅ Setup Complete!"
echo "=================================================="
echo ""
echo "📋 Service Management Commands:"
echo ""
echo "  Check status:"
echo "    sudo systemctl status debate-feedback-backend"
echo "    sudo systemctl status debate-feedback-worker"
echo ""
echo "  View logs:"
echo "    sudo journalctl -u debate-feedback-backend -f"
echo "    sudo journalctl -u debate-feedback-worker -f"
echo ""
echo "  Restart services:"
echo "    sudo systemctl restart debate-feedback-backend"
echo "    sudo systemctl restart debate-feedback-worker"
echo ""
echo "  Stop services:"
echo "    sudo systemctl stop debate-feedback-backend"
echo "    sudo systemctl stop debate-feedback-worker"
echo ""
echo "🌐 API Endpoint:"
echo "  http://$PUBLIC_IP:3000/api"
echo ""
echo "📱 iOS App Configuration:"
echo "  Update Constants.swift with:"
echo "  static let baseURL = \"http://$PUBLIC_IP:3000/api\""
echo ""
echo "📖 For detailed iOS integration instructions, see:"
echo "  $SCRIPT_DIR/IOS_APP_INTEGRATION_GUIDE.md"
echo ""
echo "=================================================="
