#!/bin/bash

# Accept an optional CLI argument for file path
FILE="${1:-./app/(tabs)/settings.tsx}"

# Show usage if help is requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  echo "Usage: $0 [file_path]"
  echo "Convert settings.tsx from className to inline styles."
  echo ""
  echo "Arguments:"
  echo "  file_path    Optional path to the settings file (default: ./app/(tabs)/settings.tsx)"
  echo ""
  echo "Examples:"
  echo "  $0"
  echo "  $0 ./app/(tabs)/settings.tsx"
  exit 0
fi

# Validate file exists
if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  echo "Usage: $0 [file_path]"
  echo "  Use -h or --help for more information."
  exit 1
fi

# Container styles
sed -i '' 's/className="flex-1 bg-surface-50"/style={styles.container}/g' "$FILE"
sed -i '' 's/className="bg-white mx-4 mt-4 rounded-2xl p-4"/style={styles.profileCard}/g' "$FILE"
sed -i '' 's/className="flex-row items-center"/style={styles.rowCenter}/g' "$FILE"
sed -i '' 's/className="w-16 h-16 bg-primary-100 rounded-full items-center justify-center"/style={styles.profileAvatar}/g' "$FILE"
sed -i '' 's/className="text-2xl font-bold text-primary-600"/style={styles.profileInitial}/g' "$FILE"
sed -i '' 's/className="flex-1 ml-4"/style={styles.profileInfo}/g' "$FILE"
sed -i '' 's/className="text-lg font-semibold text-surface-900"/style={styles.profileName}/g' "$FILE"
sed -i '' 's/className="text-sm text-surface-500"/style={styles.profileEmail}/g' "$FILE"
sed -i '' 's/className="text-xs text-surface-400 mt-0.5"/style={styles.profilePhone}/g' "$FILE"

# Section headers
sed -i '' 's/className="mt-6 px-4"/style={styles.section}/g' "$FILE"
sed -i '' 's/className="text-xs font-bold text-surface-500 tracking-wider mb-2 px-2"/style={styles.sectionHeader}/g' "$FILE"
sed -i '' 's/className="bg-white rounded-2xl overflow-hidden"/style={styles.sectionContent}/g' "$FILE"

# Settings items
sed -i '' 's/className="flex-row items-center px-4 py-3.5"/style={styles.settingsItem}/g' "$FILE"
sed -i '' 's/className="w-9 h-9 rounded-lg bg-surface-100 items-center justify-center"/style={styles.settingsIcon}/g' "$FILE"
sed -i '' 's/className="w-9 h-9 rounded-lg bg-red-100 items-center justify-center"/style={styles.signOutIcon}/g' "$FILE"
sed -i '' 's/className="flex-1 ml-3 text-base text-surface-900"/style={styles.settingsTitle}/g' "$FILE"
sed -i '' 's/className="flex-1 ml-3 text-base text-red-600"/style={styles.signOutText}/g' "$FILE"
sed -i '' 's/className="text-sm text-surface-500 mr-2"/style={styles.settingsValue}/g' "$FILE"
sed -i '' 's/className="text-xs text-surface-400 mt-2 px-2"/style={styles.notificationNote}/g' "$FILE"

# Notification toggles
sed -i '' 's/className="flex-row items-center px-4 py-3"/style={styles.notificationItem}/g' "$FILE"
sed -i '' 's/className="flex-1"/style={styles.flex1}/g' "$FILE"
sed -i '' 's/className="text-base text-surface-900"/style={styles.notificationTitle}/g' "$FILE"
sed -i '' 's/className="text-xs text-surface-500 mt-0.5"/style={styles.notificationSubtitle}/g' "$FILE"

# App version
sed -i '' 's/className="items-center mt-8"/style={styles.appVersionContainer}/g' "$FILE"
sed -i '' 's/className="text-sm text-surface-400"/style={styles.appVersion}/g' "$FILE"
sed -i '' 's/className="text-xs text-surface-300 mt-1"/style={styles.appVersionSubtitle}/g' "$FILE"

# Modal styles
sed -i '' 's/className="flex-1 bg-surface-50"/style={styles.modalContainer}/g' "$FILE"
sed -i '' 's/className="bg-white px-4 py-4 border-b border-surface-100"/style={styles.modalHeader}/g' "$FILE"
sed -i '' 's/className="flex-row items-center justify-between"/style={styles.modalHeaderInner}/g' "$FILE"
sed -i '' 's/className="text-lg font-bold text-surface-900"/style={styles.modalTitle}/g' "$FILE"
sed -i '' 's/className="flex-1"/style={styles.flex1}/g' "$FILE"
sed -i '' 's/className="bg-white rounded-2xl p-4"/style={styles.formCard}/g' "$FILE"
sed -i '' 's/className="mb-4"/style={styles.mb4}/g' "$FILE"
sed -i '' 's/className="text-sm font-medium text-surface-700 mb-2"/style={styles.inputLabel}/g' "$FILE"
sed -i '' 's/className="bg-surface-100 rounded-xl px-4 py-3"/style={styles.inputDisabled}/g' "$FILE"
sed -i '' 's/className="text-base text-surface-500"/style={styles.inputDisabledText}/g' "$FILE"
sed -i '' 's/className="text-xs text-surface-400 mt-1"/style={styles.inputHint}/g' "$FILE"
sed -i '' 's/className="bg-surface-50 rounded-xl px-4 py-3 text-base text-surface-900"/style={styles.input}/g' "$FILE"
sed -i '' 's/className="bg-white px-4 py-4 border-t border-surface-100"/style={styles.modalFooter}/g' "$FILE"
sed -i '' 's/className="py-3.5 rounded-xl items-center"/style={styles.saveButton}/g' "$FILE"
sed -i '' 's/className="text-white font-semibold"/style={styles.saveButtonText}/g' "$FILE"

# Modal lists
sed -i '' 's/className="flex-1 text-base text-surface-900"/style={styles.pickerItemText}/g' "$FILE"

# Dynamic classNames - handle border conditionals
sed -i '' 's/className={`flex-row items-center px-4 py-3.5 ${/style={[styles.settingsItem, /g' "$FILE"
sed -i '' 's/!isLast ? '\''border-b border-surface-100'\'' : '\'''\''`}/!isLast \&\& styles.borderBottom]}/g' "$FILE"

sed -i '' 's/className={`flex-row items-center px-4 py-3 ${/style={[styles.notificationItem, /g' "$FILE"

sed -i '' 's/className={`flex-row items-center px-4 py-3.5 ${/style={[styles.pickerItem, /g' "$FILE"
sed -i '' 's/index < CURRENCIES.length - 1 ? '\''border-b border-surface-100'\'' : '\'''\''`}/index < CURRENCIES.length - 1 \&\& styles.borderBottom]}/g' "$FILE"
sed -i '' 's/index < AREA_UNITS.length - 1 ? '\''border-b border-surface-100'\'' : '\'''\''`}/index < AREA_UNITS.length - 1 \&\& styles.borderBottom]}/g' "$FILE"

echo "✅ Converted settings.tsx successfully"
