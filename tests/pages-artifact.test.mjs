import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {waitForPagesArtifact} = createRequire(import.meta.url)('../scripts/wait-pages-artifact.cjs');
const artifact = {id:123,name:'github-pages',size:100};
test('Wait for delayed artifact visibility without creating or repeating a deployment', async()=>{
 let calls=0,waits=0;
 await waitForPagesArtifact({artifactId:'123',listArtifacts:async()=>({artifacts:++calls<3?[]:[artifact]}),sleep:async ms=>{assert.equal(ms,5000);waits++;}});
 assert.equal(calls,3);assert.equal(waits,2);
});
test('Missing artifacts stop after a bounded wait',async()=>{
 let calls=0,waits=0;
 await assert.rejects(waitForPagesArtifact({artifactId:'123',attempts:3,listArtifacts:async()=>{calls++;return {artifacts:[]};},sleep:async()=>waits++}),/still unavailable/);
 assert.equal(calls,3);assert.equal(waits,2);
});
test('Wrong, ambiguous and empty artifacts cannot pass the guard',async()=>{
 for(const artifacts of [[{...artifact,id:124}],[artifact,artifact],[{...artifact,size:0}]])
  await assert.rejects(waitForPagesArtifact({artifactId:'123',listArtifacts:async()=>({artifacts})}),/refusing deployment/);
});
test('Authorization and malformed responses are not hidden by retries',async()=>{
 let calls=0;
 await assert.rejects(waitForPagesArtifact({artifactId:'123',listArtifacts:async()=>{calls++;throw Error('HTTP 403');}}),/HTTP 403/);
 assert.equal(calls,1);
 await assert.rejects(waitForPagesArtifact({artifactId:'123',listArtifacts:async()=>({})}),/Invalid artifact/);
 await assert.rejects(waitForPagesArtifact({artifactId:'',listArtifacts:async()=>{throw Error('must not call');}}),/Missing uploaded/);
});
