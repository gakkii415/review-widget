import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assemble} from '../scripts/build.mjs';
test('Review punctuation is not interpreted as replacement syntax',()=>{
 const payload={text:"Price $25; literal $' and $` and $$ and $&; </script>"};
 const page=assemble(fs.readFileSync('templates/index.html','utf8'),payload,'','');
 const match=page.match(/<script id="review-data" type="application\/json">([\s\S]*?)<\/script>/);
 assert.ok(match);assert.deepEqual(JSON.parse(match[1]),payload);
});
