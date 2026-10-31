import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { folderSetting, resolveDataFolder } from '../shared/folder';

const root = path.resolve('/projects/one');

test('the default data folder is .gsdiagram in the project', () => {
  assert.equal(resolveDataFolder(root), path.join(root, '.gsdiagram'));
  assert.equal(resolveDataFolder(root, '  '), path.join(root, '.gsdiagram'));
});

test('a configured folder inside the project is used', () => {
  assert.equal(resolveDataFolder(root, 'dev/diagrams'), path.join(root, 'dev/diagrams'));
});

test('a folder outside the project is refused', () => {
  assert.throws(() => resolveDataFolder(root, '../other'), /outside the project/);
  assert.throws(() => resolveDataFolder(root, '/tmp/x'), /outside the project/);
  assert.throws(() => resolveDataFolder(root, '../one-two'), /outside the project/);
});

test('the setting is read from settings.json with comments and trailing commas', () => {
  const text = `{
    // where the diagrams are
    "editor.tabSize": 2, /* two */
    "gsdiagram.folder": "dev/diagrams",
  }`;
  assert.equal(folderSetting(text), 'dev/diagrams');
  assert.equal(folderSetting('{"files.exclude": {"**/x": true}}'), undefined);
  assert.equal(folderSetting(undefined), undefined);
});

test('a URL in settings.json is not taken for a comment', () => {
  assert.equal(folderSetting('{"http.proxy": "http://example.com", "gsdiagram.folder": "d"}'), 'd');
});
