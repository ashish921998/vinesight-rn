import type { Meta, StoryObj } from '@storybook/react-native';
import { TestWidget } from './TestWidget';

const meta: Meta<typeof TestWidget> = {
  title: 'Widgets/foundation/TestWidget',
  component: TestWidget,
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

type Story = StoryObj<typeof TestWidget>;

export const Default: Story = {
  args: {},
};

export const WithCustomStyle: Story = {
  args: {
    style: { backgroundColor: '#f0f0f0', padding: 16 },
  },
};

export const WithAccessibility: Story = {
  args: {
    testID: 'test-widget',
    accessibilityLabel: 'Test widget component',
  },
};
