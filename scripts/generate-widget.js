#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const [widgetName, category = 'feature'] = process.argv.slice(2);
const validCategories = [
  'foundation',
  'dashboard',
  'feature',
  'advanced',
  'calculator',
  'journal',
  'lab-test',
  'ai',
  'input',
];
const categoriesUsage = validCategories.join('|');

if (!widgetName) {
  console.error(`Usage: npm run generate-widget <WidgetName> [${categoriesUsage}]`);
  process.exit(1);
}

if (!validCategories.includes(category)) {
  console.error(`Invalid category "${category}". Use one of: ${validCategories.join(', ')}`);
  process.exit(1);
}

const baseDir = path.join(process.cwd(), 'components/widgets', category, widgetName);

if (fs.existsSync(baseDir)) {
  console.error(`Widget already exists: ${baseDir}`);
  process.exit(1);
}

fs.mkdirSync(baseDir, { recursive: true });

const componentContent = `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseWidgetProps } from '@widgets/shared/types';
// TODO: Import i18n hook when available
// import { useTranslation } from 'react-i18next';

export type ${widgetName}Props = BaseWidgetProps;

export const ${widgetName}: React.FC<${widgetName}Props> = ({
  testID,
  accessibilityLabel,
  style,
}) => {
  // TODO: Implement loading/error states
  // const { t } = useTranslation();

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[styles.container, style]}>
      <Text>{/* TODO: Use t('widgets.${widgetName.toLowerCase()}.title') */}${widgetName}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
});
`;

const testContent = `import React from 'react';
import { render } from '@widgets/shared/utils/testUtils';
import { ${widgetName} } from './${widgetName}';

describe('${widgetName}', () => {
  it('renders widget label', () => {
    const { getByText } = render(<${widgetName} />);

    expect(getByText('${widgetName}')).toBeTruthy();
  });
});
`;

const indexContent = `export * from './${widgetName}';
`;

fs.writeFileSync(path.join(baseDir, `${widgetName}.tsx`), componentContent);
fs.writeFileSync(path.join(baseDir, `${widgetName}.test.tsx`), testContent);
fs.writeFileSync(path.join(baseDir, 'index.ts'), indexContent);

console.log(`Created widget ${widgetName} in ${path.relative(process.cwd(), baseDir)}`);
