import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {snapshot,safeJson,assemble,fetchPayload} from '../scripts/build.mjs';
const now=Date.parse('2026-09-22T00:00:00Z');
const fixture=(id,name)=>({id,reviewerName:name,text:'This is an English test fixture. The artist explained the design and the studio was very clean. I was comfortable throughout the appointment.',rating:5,createTime:'2026-09-01T00:00:00Z'});
const raw=reviews=>({ok:true,averageRating:5,totalReviewCount:reviews.length,generatedAt:new Date(now).toISOString(),reviews});
const template=fs.readFileSync('templates/index.html','utf8');
test('A new build replaces old customer data rather than merging snapshots',()=>{
 const first=assemble(template,snapshot(raw([fixture('old-fixture','REMOVED_SYNTHETIC_NAME')]),now),'','');
 const second=assemble(template,snapshot(raw([fixture('new-fixture','CURRENT_SYNTHETIC_NAME')]),now),'','');
 assert.ok(first.includes('REMOVED_SYNTHETIC_NAME'));assert.ok(!second.includes('REMOVED_SYNTHETIC_NAME'));assert.ok(!second.includes('old-fixture'));
});
test('Embedding JSON cannot close the script tag',()=>{
 const value={text:'</script><script>bad()</script>&\u2028'};
 assert.ok(!safeJson(value).includes('</script>'));assert.deepEqual(JSON.parse(safeJson(value)),value);
});
test('Stale or malformed upstream data is rejected',()=>{
 assert.throws(()=>snapshot({...raw([]),ok:false},now));
 assert.throws(()=>snapshot({...raw([]),generatedAt:new Date(now-8*3600000).toISOString()},now));
});
test('Search exclusion and one-day schedule are required; no git writer exists',()=>{
 const workflow=fs.readFileSync('.github/workflows/release.yml','utf8');
 assert.match(template,/noindex, nofollow, noimageindex/);
 assert.match(workflow,/15 18 \* \* \*/);assert.doesNotMatch(workflow,/git (add|commit|push)/);
 assert.ok(!fs.existsSync('.github/workflows/refresh-reviews.yml'));
 assert.match(fs.readFileSync('.gitignore','utf8'),/\/dist\//);
});
test('A temporary source outage cannot publish an empty replacement',async t=>{
 let attempts=0;
 t.mock.method(globalThis,'fetch',async()=>{attempts++;throw Error('Temporary outage');});
 t.mock.method(globalThis,'setTimeout',fn=>{queueMicrotask(fn);return 0;});
 await assert.rejects(fetchPayload({endpoint:'https://script.google.com/macros/s/test/exec'}),/keeping the current deployment/);
 assert.equal(attempts,4);
 assert.equal((await fetchPayload({pending:true})).ok,false);
 assert.equal(attempts,4,'Pending accounts must not fetch');
});
test('A retry can recover and publish a fresh snapshot',async t=>{
 let attempts=0;
 t.mock.method(globalThis,'fetch',async()=>{
  if(++attempts===1)throw Error('Temporary outage');
  return {ok:true,json:async()=>({...raw([fixture('current','Test reviewer')]),generatedAt:new Date().toISOString()})};
 });
 t.mock.method(globalThis,'setTimeout',fn=>{queueMicrotask(fn);return 0;});
 assert.equal((await fetchPayload({endpoint:'https://script.google.com/macros/s/test/exec'})).ok,true);
 assert.equal(attempts,2);
});
