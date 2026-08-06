#!/bin/sh
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
cnt() { printf '%s' "$1" | grep -c "$2" 2>/dev/null | head -1 | tr -dc '0-9'; }
probe() {
  url="$1"; host=$(echo "$url" | sed -E 's#https?://([^/]+).*#\1#')
  raw=$(curl -sL -m 25 -A "$UA" -w "\n__HTTP__%{http_code}" "$url" 2>/dev/null)
  code=$(echo "$raw" | tail -1 | sed 's/__HTTP__//' | tr -dc '0-9')
  html=$(echo "$raw" | sed '$d')
  bytes=$(printf '%s' "$html" | wc -c | tr -dc '0-9')
  ld=$(cnt "$html" 'application/ld+json'); prod=$(cnt "$html" '"@type": *"Product"')
  ogp=$(cnt "$html" 'og:price\|product:price')
  ld=${ld:-0}; prod=${prod:-0}; ogp=${ogp:-0}; bytes=${bytes:-0}; code=${code:-0}
  if [ "$code" -ge 400 ] && [ "$bytes" -lt 30000 ]; then v="BLOCKED (http $code, thin)"
  elif [ "$prod" -gt 0 ]; then v="READABLE jsonld-Product"
  elif [ "$ogp" -gt 0 ]; then v="PARTIAL og-price-only"
  elif [ "$ld" -gt 0 ]; then v="PARTIAL jsonld-no-Product"
  elif [ "$bytes" -lt 30000 ]; then v="BLOCKED js-shell/thin-body"
  else v="NO_STRUCTURED_DATA"; fi
  printf '%-22s http=%-3s bytes=%-7s ld=%-2s Product=%-2s og=%-2s  %s\n' "$host" "$code" "$bytes" "$ld" "$prod" "$ogp" "$v"
}
echo "--- cohort A: expected readable (Shopify / clean JSON-LD) ---"
probe "https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22"
probe "https://drsquatch.com/products/pine-tar"
probe "https://www.allbirds.com/products/mens-wool-runner-go"
probe "https://ridge.com/products/titanium-money-clip"
probe "https://www.tentree.com/products/mens-treeblend-classic-t-shirt"
echo "--- cohort B: expected hostile ---"
probe "https://www.apple.com/shop/product/MTJV3AM/A/airpods-max-midnight"
probe "https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111"
probe "https://www.lego.com/en-us/product/millennium-falcon-75192"
probe "https://www.amazon.com/dp/B0CHX1W1XY"
probe "https://www.walmart.com/ip/Apple-AirPods-Pro-2/1892554066"
