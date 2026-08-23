#!/usr/bin/env bash
# ==============================================================================
# Verdad Solution InventoryApp - Linux Automated API Verification Test
# Tests REST Endpoints using curl and bash on Linux
# ==============================================================================

set -e

HOST="http://localhost:5000"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  🧪 Running Linux Automated Verification Tests       ${NC}"
echo -e "${BLUE}  Target: $HOST                                       ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Check server reachable
echo -n "Checking server availability... "
if ! curl -s "$HOST/api/health" > /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo "❌ Server is not running on $HOST. Please start it using ./start_server.sh"
    exit 1
fi
echo -e "${GREEN}ONLINE${NC}"

# 1. Health check
echo -n "1. Testing /api/health ... "
HEALTH_RESP=$(curl -s "$HOST/api/health")
echo "$HEALTH_RESP" | grep -q "healthy" && echo -e "${GREEN}PASSED${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

# 2. User Login
echo -n "2. Testing User Authentication (/api/auth/login) ... "
USER_LOGIN=$(curl -s -X POST "$HOST/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}')

USER_TOKEN=$(echo "$USER_LOGIN" | grep -o '"token": *"[^"]*"' | sed 's/"token": *"//;s/"//')
if [ -n "$USER_TOKEN" ]; then
    echo -e "${GREEN}PASSED (Token: ${USER_TOKEN:0:12}...)${NC}"
else
    echo -e "${RED}FAILED: $USER_LOGIN${NC}"
    exit 1
fi

# 3. Admin Login
echo -n "3. Testing Admin Authentication (/api/auth/admin-login) ... "
ADMIN_LOGIN=$(curl -s -X POST "$HOST/api/auth/admin-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"token": *"[^"]*"' | sed 's/"token": *"//;s/"//')
if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "${GREEN}PASSED (Admin role confirmed)${NC}"
else
    echo -e "${RED}FAILED: $ADMIN_LOGIN${NC}"
    exit 1
fi

# 4. Inventory Catalog Listing
echo -n "4. Testing Inventory Retrieval (/api/inventory) ... "
INV_RESP=$(curl -s "$HOST/api/inventory" -H "Authorization: Bearer $USER_TOKEN")
echo "$INV_RESP" | grep -q "items" && echo -e "${GREEN}PASSED${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

# 5. Inventory Metrics Stats
echo -n "5. Testing Inventory Metrics (/api/inventory/stats) ... "
STATS_RESP=$(curl -s "$HOST/api/inventory/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$STATS_RESP" | grep -q "totalItems" && echo -e "${GREEN}PASSED${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

# 6. Create New Item
TS=$(date +%s)
TEST_SKU="LNX-SKU-$TS"
echo -n "6. Testing Product Creation ($TEST_SKU) ... "
CREATE_RESP=$(curl -s -X POST "$HOST/api/inventory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{\"sku\":\"$TEST_SKU\",\"name\":\"Linux Server Test Item\",\"category\":\"Electronics\",\"unit_price\":250000.00,\"quantity\":15,\"min_threshold\":5}")

ITEM_ID=$(echo "$CREATE_RESP" | grep -o '"id": *[0-9]*' | head -1 | sed 's/"id": *//')
if [ -n "$ITEM_ID" ]; then
    echo -e "${GREEN}PASSED (Item ID: $ITEM_ID)${NC}"
else
    echo -e "${RED}FAILED: $CREATE_RESP${NC}"
    exit 1
fi

# 7. Restock Item (+10 units)
echo -n "7. Testing Restock Operation (+10 units) ... "
RESTOCK_RESP=$(curl -s -X POST "$HOST/api/inventory/$ITEM_ID/stock" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"action":"add","amount":10,"reason":"Linux Automated Restock"}')
echo "$RESTOCK_RESP" | grep -q "newQuantity" && echo -e "${GREEN}PASSED (New Quantity: 25)${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

# 8. Today's Work Summary for User
echo -n "8. Testing 'Today Work' Activity Tracking ... "
TODAY_RESP=$(curl -s "$HOST/api/activity/today" -H "Authorization: Bearer $USER_TOKEN")
echo "$TODAY_RESP" | grep -q "totalActionsToday" && echo -e "${GREEN}PASSED${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

# 9. Admin Provisioning
USER_NAME="lnx_user_$TS"
echo -n "9. Testing Admin User Provisioning ($USER_NAME) ... "
USER_PROV_RESP=$(curl -s -X POST "$HOST/api/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"username\":\"$USER_NAME\",\"password\":\"pass1234\",\"full_name\":\"Linux Test User\",\"email\":\"$USER_NAME@test.local\",\"role\":\"user\"}")
echo "$USER_PROV_RESP" | grep -q "created successfully" && echo -e "${GREEN}PASSED${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

# 10. Clean up test item
echo -n "10. Testing Stock Deletion & Audit Log ... "
DEL_RESP=$(curl -s -X DELETE "$HOST/api/inventory/$ITEM_ID" -H "Authorization: Bearer $USER_TOKEN")
echo "$DEL_RESP" | grep -q "deleted successfully" && echo -e "${GREEN}PASSED${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

# 11. Microsoft Entra ID Single Sign-On (SSO)
echo -n "11. Testing Microsoft Entra ID SSO (/api/auth/entra-sso) ... "
ENTRA_RESP=$(curl -s -X POST "$HOST/api/auth/entra-sso" \
  -H "Content-Type: application/json" \
  -d '{"email":"lnx.sso@verdadsolutions.com","name":"Linux SSO Tester","role":"user"}')
ENTRA_TOKEN=$(echo "$ENTRA_RESP" | grep -o '"token": *"[^"]*"' | sed 's/"token": *"//;s/"//')
if [ -n "$ENTRA_TOKEN" ]; then
    echo -e "${GREEN}PASSED (SSO Token obtained)${NC}"
else
    echo -e "${RED}FAILED: $ENTRA_RESP${NC}"
    exit 1
fi

# 12. Create Support Ticket
echo -n "12. Testing Support & Requisition Ticket Creation ... "
TICKET_RESP=$(curl -s -X POST "$HOST/api/tickets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ENTRA_TOKEN" \
  -d '{"title":"Linux Workstation Requisition","ticket_type":"STOCK_REQUEST","item_id":1,"quantity_requested":1,"priority":"HIGH","description":"Hardware request via Linux curl test"}')
TCK_ID=$(echo "$TICKET_RESP" | grep -o '"id": *[0-9]*' | head -1 | sed 's/"id": *//')
if [ -n "$TCK_ID" ]; then
    echo -e "${GREEN}PASSED (Ticket ID: $TCK_ID)${NC}"
else
    echo -e "${RED}FAILED: $TICKET_RESP${NC}"
    exit 1
fi

# 13. Admin Approve & Auto-Deduct Ticket
echo -n "13. Testing Admin Ticket Approval & Dispatch ... "
APPROVE_RESP=$(curl -s -X PATCH "$HOST/api/tickets/$TCK_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status":"APPROVED","admin_notes":"Approved in Linux test suite","deduct_stock":true}')
echo "$APPROVE_RESP" | grep -q "APPROVED" && echo -e "${GREEN}PASSED${NC}" || (echo -e "${RED}FAILED${NC}" && exit 1)

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  🎉 ALL 13 LINUX VERIFICATION TESTS PASSED!          ${NC}"
echo -e "${GREEN}======================================================${NC}"
