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
