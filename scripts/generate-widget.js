#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const [widgetName, category = 'feature'] = process.argv.slice(2);
const validCategories = ['foundation', 'dashboard', 'feature', 'advanced'];

if (!widgetName) {
  console.error(
    'Usage: npm run generate-widget <WidgetName> [foundation|dashboard|feature|advanced]',
  );
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

export type ${widgetName}Props = BaseWidgetProps;

export const ${widgetName}: React.FC<${widgetName}Props> = ({
  testID,
  accessibilityLabel,
  style,
}) => {
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[styles.container, style]}>
      <Text>${widgetName}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
});
`;

const testContent = `import React from 'react';
import { render } from '../../shared/utils/testUtils';
import { ${widgetName} } from './${widgetName}';

describe('${widgetName}', () => {
  it('renders widget label', () => {
    const { getByText } = render(<${widgetName} />);

    expect(getByText('${widgetName}')).toBeTruthy();
  });
});
`;

const storyContent = `import type { Meta, StoryObj } from '@storybook/react-native';
import { ${widgetName} } from './${widgetName}';

const meta: Meta<typeof ${widgetName}> = {
  title: 'Widgets/${category}/${widgetName}',
  component: ${widgetName},
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

type Story = StoryObj<typeof ${widgetName}>;

export const Default: Story = {
  args: {},
};
`;

const indexContent = `export * from './${widgetName}';
`;

fs.writeFileSync(path.join(baseDir, `${widgetName}.tsx`), componentContent);
fs.writeFileSync(path.join(baseDir, `${widgetName}.test.tsx`), testContent);
fs.writeFileSync(path.join(baseDir, `${widgetName}.stories.tsx`), storyContent);
fs.writeFileSync(path.join(baseDir, 'index.ts'), indexContent);

console.log(`Created widget ${widgetName} in ${path.relative(process.cwd(), baseDir)}`);
