import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
test('Template and release checks follow the VERSION source of truth',()=>{
 const version=fs.readFileSync(new URL('VERSION',root),'utf8').trim();
 assert.match(version,/^[1-9][0-9]*$/);
 const template=fs.readFileSync(new URL('templates/index.html',root),'utf8');
 assert.equal(template.match(/class="version">(v[0-9]+)</)?.[1],'v'+version);
 const checks=fs.readFileSync(new URL('tests/browser.mjs',root),'utf8');
 assert.ok(checks.includes('expectedVersion'));
 assert.ok(!/innerText\(\),\s*['"]v\d+['"]/.test(checks),'Do not hardcode a release version in browser checks');
});
