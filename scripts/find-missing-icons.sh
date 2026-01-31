#!/bin/bash
# Script to find all Symbol icon names used in the codebase
# and check if they have mappings in Symbol.tsx

echo "🔍 Finding all Symbol icon names used in the codebase..."
echo ""

# Find all Symbol name= usages
grep -rh 'Symbol.*name="[^"]*"' src/components app/ 2>/dev/null | \
  sed -E 's/.*name="([^"]+)".*/\1/' | \
  sort -u | \
  while read -r icon; do
    # Check if it exists in Symbol.tsx mapping
    if grep -q "'$icon'" src/components/ui/symbol.tsx; then
      echo "✅ $icon"
    else
      echo "❌ MISSING: $icon"
    fi
  done

echo ""
echo "Legend:"
echo "✅ = Icon has mapping"
echo "❌ = Icon missing from SYMBOL_TO_IONICON mapping"
echo ""
echo "To add missing icons, edit src/components/ui/symbol.tsx"
