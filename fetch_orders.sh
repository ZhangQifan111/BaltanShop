#!/bin/bash
# Fetch all 7 pages of completed orders
# Usage: bash fetch_orders.sh <jwt_token>

TOKEN="$1"
if [ -z "$TOKEN" ]; then
  echo "Usage: bash fetch_orders.sh <jwt_token>"
  echo "Get JWT from browser DevTools -> Network -> getLists -> Copy as fetch -> copy the 'authorization: Bearer ...' value"
  exit 1
fi

for page in 1 2 3 4 5 6 7; do
  curl -s "https://rl.rngmoe.com/order/order/getLists?page=${page}&page_last_id=0&service=finish_ownerPackage&is_show_page=1" \
    -H "accept: application/json" \
    -H "authorization: Bearer ${TOKEN}" \
    -H "token: 0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1" \
    -H "uid: 2016001"
done > /opt/buy-ledger-v2/orders_raw.json

echo "Done. Output: /opt/buy-ledger-v2/orders_raw.json"
