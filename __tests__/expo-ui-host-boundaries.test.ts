import fs from 'node:fs';
import path from 'node:path';

describe('Expo UI host boundaries', () => {
  it('does not wrap the React Navigation tree in a native Host', () => {
    const rootLayout = fs.readFileSync(path.join(process.cwd(), 'app/_layout.tsx'), 'utf8');

    expect(rootLayout).not.toContain("import { Host } from '@expo/ui'");
    expect(rootLayout).not.toMatch(/<Host[\s\S]*?<Stack/);
  });

  it('does not create a native Host for every shared icon', () => {
    const symbol = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ui/symbol.tsx'),
      'utf8',
    );

    expect(symbol).not.toContain("import { Host, Icon } from '@expo/ui'");
    expect(symbol).not.toContain('<Host matchContents');
  });
});
