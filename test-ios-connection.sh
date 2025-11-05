#!/bin/bash

# iOS App Connection Diagnostic Script
# Run this on your Mac BEFORE testing the iOS app

echo "=========================================="
echo "iOS App Connection Diagnostic"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: DNS Resolution
echo "1. Testing DNS Resolution..."
DNS_RESULT=$(host api.genalphai.com | grep "has address")
if echo "$DNS_RESULT" | grep -q "144.217.164.110"; then
    echo -e "${GREEN}✅ DNS correct: api.genalphai.com → 144.217.164.110${NC}"
else
    echo -e "${RED}❌ DNS incorrect or not resolved${NC}"
    echo "   Current result: $DNS_RESULT"
    echo "   Expected: api.genalphai.com has address 144.217.164.110"
    echo ""
    echo "   Fix: Run these commands:"
    echo "   sudo dscacheutil -flushcache"
    echo "   sudo killall -HUP mDNSResponder"
fi
echo ""

# Test 2: HTTPS Health Check
echo "2. Testing HTTPS Health Endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.genalphai.com/api/health)
if [ "$HEALTH_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Health endpoint accessible (HTTP 200)${NC}"
    HEALTH_BODY=$(curl -s https://api.genalphai.com/api/health)
    echo "   Response: $HEALTH_BODY"
else
    echo -e "${RED}❌ Health endpoint failed (HTTP $HEALTH_STATUS)${NC}"
    echo "   This means your Mac cannot reach the backend"
fi
echo ""

# Test 3: SSL Certificate
echo "3. Testing SSL Certificate..."
SSL_INFO=$(curl -vI https://api.genalphai.com/api/health 2>&1 | grep -E "SSL certificate|subject:|issuer:|expire")
if echo "$SSL_INFO" | grep -q "SSL certificate verify ok"; then
    echo -e "${GREEN}✅ SSL certificate valid${NC}"
else
    echo -e "${YELLOW}⚠️  SSL certificate check inconclusive${NC}"
fi
echo ""

# Test 4: Login Endpoint
echo "4. Testing Login Endpoint..."
LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST https://api.genalphai.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"teacher_id": "Test Teacher", "device_id": "test-script-device"}')

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_STATUS")

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Login endpoint working (HTTP 200)${NC}"
    echo "   Token received: $(echo "$RESPONSE_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 | cut -c1-30)..."
else
    echo -e "${RED}❌ Login endpoint failed (HTTP $HTTP_STATUS)${NC}"
    echo "   Response: $RESPONSE_BODY"
fi
echo ""

# Test 5: Check Xcode is closed
echo "5. Checking Xcode Status..."
if pgrep -x "Xcode" > /dev/null; then
    echo -e "${YELLOW}⚠️  Xcode is running${NC}"
    echo "   For best results:"
    echo "   1. Close Xcode (Cmd + Q)"
    echo "   2. Clean derived data: rm -rf ~/Library/Developer/Xcode/DerivedData/*"
    echo "   3. Reopen Xcode"
else
    echo -e "${GREEN}✅ Xcode is not running${NC}"
fi
echo ""

# Test 6: Check for iOS Simulator
echo "6. Checking iOS Simulator..."
if pgrep -x "Simulator" > /dev/null; then
    echo -e "${YELLOW}⚠️  iOS Simulator is running${NC}"
    echo "   Recommended: Reset simulator"
    echo "   Device → Erase All Content and Settings"
    echo "   Or run: xcrun simctl erase all"
else
    echo -e "ℹ️  iOS Simulator is not running"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

if [ "$HEALTH_STATUS" -eq 200 ] && [ "$HTTP_STATUS" -eq 200 ] && echo "$DNS_RESULT" | grep -q "144.217.164.110"; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo ""
    echo "Your Mac can reach the backend successfully!"
    echo ""
    echo "Next steps in Xcode:"
    echo "1. Verify Constants.swift has:"
    echo "   Line 14: static let baseURL = \"https://api.genalphai.com/api\""
    echo "   Line 21: static var useMockData = false"
    echo ""
    echo "2. Clean build:"
    echo "   - Product → Clean Build Folder (Shift + Cmd + K)"
    echo "   - Delete derived data"
    echo "   - Build and Run"
    echo ""
    echo "3. Add debug logging to APIClient.swift (see IOS_APP_FIX_GUIDE.md)"
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please fix the failed tests above before testing iOS app."
    echo "See IOS_APP_FIX_GUIDE.md for detailed solutions."
fi
echo ""
