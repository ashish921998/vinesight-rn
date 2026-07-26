import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.resolve(__dirname, '../src');

function collectTsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : [];
  });
}

describe('dismissible Android bottom sheets', () => {
  it('do not capture the responder before the native sheet can handle a downward drag', () => {
    const offenders = collectTsxFiles(srcRoot)
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8');
        return (
          source.includes('enablePanDownToClose') && source.includes('onStartShouldSetResponder')
        );
      })
      .map((file) => path.relative(srcRoot, file));

    expect(offenders).toEqual([]);
  });

  it.each([
    'components/modals/lab-tests-fab-sheet.tsx',
    'components/modals/workers-fab-sheet.tsx',
    'components/sheets/product-detail-sheet.tsx',
  ])('%s uses a nested scroll root', (relativePath) => {
    const source = fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');

    expect(source).toContain('<BottomSheetScrollView');
    expect(source).toContain('nestedScrollEnabled');
  });
});
