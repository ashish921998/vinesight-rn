#!/usr/bin/env node

/**
 * NativeWind to Inline Styles Converter
 * Converts className props to inline styles using theme constants
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Common Tailwind to RN style mappings
const styleMap = {
  // Flex
  flex: { display: 'flex' },
  'flex-1': { flex: 1 },
  'flex-row': { flexDirection: 'row' },
  'flex-col': { flexDirection: 'column' },
  'items-center': { alignItems: 'center' },
  'items-start': { alignItems: 'flex-start' },
  'items-end': { alignItems: 'flex-end' },
  'justify-center': { justifyContent: 'center' },
  'justify-between': { justifyContent: 'space-between' },
  'justify-end': { justifyContent: 'flex-end' },
  'justify-start': { justifyContent: 'flex-start' },

  // Padding
  'p-1': { padding: 4 },
  'p-2': { padding: 8 },
  'p-3': { padding: 12 },
  'p-4': { padding: 16 },
  'p-5': { padding: 20 },
  'p-6': { padding: 24 },
  'px-2': { paddingHorizontal: 8 },
  'px-3': { paddingHorizontal: 12 },
  'px-4': { paddingHorizontal: 16 },
  'px-5': { paddingHorizontal: 20 },
  'px-6': { paddingHorizontal: 24 },
  'px-8': { paddingHorizontal: 32 },
  'py-2': { paddingVertical: 8 },
  'py-3': { paddingVertical: 12 },
  'py-3.5': { paddingVertical: 14 },
  'py-4': { paddingVertical: 16 },
  'pt-2': { paddingTop: 8 },
  'pt-4': { paddingTop: 16 },
  'pb-2': { paddingBottom: 8 },
  'pb-4': { paddingBottom: 16 },
  'pl-4': { paddingLeft: 16 },
  'pr-4': { paddingRight: 16 },

  // Margin
  'm-2': { margin: 8 },
  'm-4': { margin: 16 },
  'mx-2': { marginHorizontal: 8 },
  'mx-4': { marginHorizontal: 16 },
  'my-2': { marginVertical: 8 },
  'my-4': { marginVertical: 16 },
  'mt-1': { marginTop: 4 },
  'mt-2': { marginTop: 8 },
  'mt-3': { marginTop: 12 },
  'mt-4': { marginTop: 16 },
  'mt-6': { marginTop: 24 },
  'mb-1': { marginBottom: 4 },
  'mb-2': { marginBottom: 8 },
  'mb-3': { marginBottom: 12 },
  'mb-4': { marginBottom: 16 },
  'mb-6': { marginBottom: 24 },
  'ml-1': { marginLeft: 4 },
  'ml-2': { marginLeft: 8 },
  'ml-3': { marginLeft: 12 },
  'mr-2': { marginRight: 8 },
  'mr-3': { marginRight: 12 },
  'mr-4': { marginRight: 16 },
  '-ml-2': { marginLeft: -8 },

  // Width/Height
  'w-10': { width: 40 },
  'w-12': { width: 48 },
  'w-14': { width: 56 },
  'w-full': { width: '100%' },
  'h-8': { height: 32 },
  'h-10': { height: 40 },
  'h-12': { height: 48 },
  'h-14': { height: 56 },

  // Border
  border: { borderWidth: 1 },
  'border-2': { borderWidth: 2 },
  'border-b': { borderBottomWidth: 1 },
  'border-t': { borderTopWidth: 1 },
  'rounded-xl': { borderRadius: 16 },
  'rounded-2xl': { borderRadius: 20 },
  'rounded-3xl': { borderRadius: 24 },
  'rounded-full': { borderRadius: 9999 },

  // Background - using theme colors
  'bg-white': { backgroundColor: 'colors.surface[100]' },
  'bg-surface-50': { backgroundColor: 'colors.surface[50]' },
  'bg-surface-100': { backgroundColor: 'colors.surface[100]' },
  'bg-surface-200': { backgroundColor: 'colors.surface[200]' },
  'bg-primary-500': { backgroundColor: 'colors.primary[500]' },
  'bg-primary-600': { backgroundColor: 'colors.primary[600]' },

  // Text
  'text-xs': { fontSize: 12 },
  'text-sm': { fontSize: 14 },
  'text-base': { fontSize: 16 },
  'text-lg': { fontSize: 18 },
  'text-xl': { fontSize: 20 },
  'text-2xl': { fontSize: 24 },
  'text-3xl': { fontSize: 30 },
  'font-medium': { fontWeight: '500' },
  'font-semibold': { fontWeight: '600' },
  'font-bold': { fontWeight: '700' },
  'text-center': { textAlign: 'center' },
  'text-surface-500': { color: 'colors.surface[500]' },
  'text-surface-600': { color: 'colors.surface[600]' },
  'text-surface-700': { color: 'colors.surface[700]' },
  'text-surface-900': { color: 'colors.surface[900]' },
  'text-primary-500': { color: 'colors.primary[500]' },
  'text-primary-600': { color: 'colors.primary[600]' },
  'text-red-500': { color: 'colors.error' },
};

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Find all className usages
  const classNameRegex = /className=(?:{`([^`]*)`}|"([^"]*)"|'([^']*)')/g;
  const matches = [...content.matchAll(classNameRegex)];

  console.log(`\n📄 ${path.basename(filePath)}`);
  console.log(`   Found ${matches.length} className usages`);

  if (matches.length > 0) {
    // Extract unique class names
    const classNames = new Set();
    matches.forEach((match) => {
      const classStr = match[1] || match[2] || match[3] || '';
      classStr.split(/\s+/).forEach((cls) => {
        if (cls && !cls.includes('$')) classNames.add(cls.trim());
      });
    });

    console.log(`   Unique classes: ${classNames.size}`);

    // Check which classes are in our map
    const unmappedClasses = [];
    classNames.forEach((cls) => {
      if (!styleMap[cls] && !cls.includes('[') && !cls.includes('/')) {
        unmappedClasses.push(cls);
      }
    });

    if (unmappedClasses.length > 0) {
      console.log(
        `   ⚠️  Unmapped classes (${unmappedClasses.length}):`,
        unmappedClasses.slice(0, 5).join(', '),
      );
    }
  }

  return matches.length;
}

function scanDirectory(dir, pattern = /\.(tsx|ts)$/) {
  let totalFiles = 0;
  let totalClassNames = 0;
  const files = [];

  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!item.startsWith('.') && item !== 'node_modules') {
          scan(fullPath);
        }
      } else if (pattern.test(item)) {
        const count = analyzeFile(fullPath);
        if (count > 0) {
          totalFiles++;
          totalClassNames += count;
          files.push({ path: fullPath, count });
        }
      }
    });
  }

  scan(dir);

  console.log(`\n📊 Summary:`);
  console.log(`   Total files with className: ${totalFiles}`);
  console.log(`   Total className usages: ${totalClassNames}`);
  console.log(`\n🔝 Top files by className usage:`);

  files
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .forEach((f, i) => {
      console.log(`   ${i + 1}. ${path.relative(process.cwd(), f.path)} (${f.count} usages)`);
    });
}

// Main
const targetDirs = [
  'src/components/cards',
  'src/components/forms',
  'src/components/screens',
  'app',
];

console.log('🔍 Scanning for className usage...\n');

targetDirs.forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`\n📁 ${dir}`);
    console.log('='.repeat(50));
    scanDirectory(fullPath);
  }
});

console.log('\n✅ Analysis complete!');
console.log('\n💡 Next steps:');
console.log('   1. Review unmapped classes and add them to styleMap if needed');
console.log('   2. Convert files manually or use this data to prioritize');
console.log(
  '   3. Import theme: import { colors, spacing, borderRadius, fontSize, fontWeight } from "@/styles/theme"',
);
