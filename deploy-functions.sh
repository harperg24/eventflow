#!/bin/bash
# ============================================================
#  deploy-functions.sh — Oneonetix edge function deployer
#  Usage: ./deploy-functions.sh [function-name]
#  Examples:
#    ./deploy-functions.sh              → deploy ALL functions
#    ./deploy-functions.sh send-invites → deploy one function
# ============================================================

set -e

FUNCTIONS=(
  "send-invites"
  "send-notifications"
  "send-collab-invite"
  "send-vendor-invite"
  "vendor-decision"
  "stripe-webhook"
  "spotify-auth"
)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "  ONE0NETIX — Edge Function Deployer"
echo "  ======================================"
echo ""

deploy_fn() {
  local fn=$1
  echo -n "  Deploying $fn... "
  if supabase functions deploy "$fn" --no-verify-jwt 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗ failed${NC}"
    exit 1
  fi
}

if [ -n "$1" ]; then
  # Deploy single named function
  deploy_fn "$1"
else
  # Deploy all
  for fn in "${FUNCTIONS[@]}"; do
    deploy_fn "$fn"
  done
fi

echo ""
echo -e "  ${GREEN}Done.${NC} Don't forget:"
echo "  • stripe-webhook and spotify-auth need secrets set in Supabase dashboard"
echo "  • Supabase > Project Settings > Edge Functions > Secrets"
echo ""
