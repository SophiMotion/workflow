import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('metadata ignores code examples and finds actual Markdown and HTML assets',()=>{
  const markdown='```python\n# Fake title\n![example](fake.png)\n```\n# Actual title\n![plot](plots/a(b).png)\n<img src="second.png">\n<video><source src="demo.mp4"></video>';
  const [result]=JSON.parse(execFileSync(process.execPath,['scripts/markdown-metadata.mjs'],{input:JSON.stringify([markdown])}));
  assert.equal(result.title,'Actual title');
  assert.deepEqual(result.images,['plots/a(b).png','second.png']);
  assert.deepEqual(result.media,['demo.mp4']);
});
