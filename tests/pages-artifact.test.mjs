import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {waitForPagesArtifact,publishPages} = createRequire(import.meta.url)('../scripts/wait-pages-artifact.cjs');
const artifact = {id:123,name:'github-pages',size:100};
test('Wait for delayed artifact visibility without creating or repeating a deployment', async()=>{
 let calls=0,waits=0;
 await waitForPagesArtifact({artifactId:'123',listArtifacts:async()=>({artifacts:++calls<3?[]:[artifact]}),sleep:async ms=>{assert.equal(ms,5000);waits++;}});
 assert.equal(calls,3);assert.equal(waits,2);
});
const publishOptions={repository:'owner/repo',sha:'abc',artifactId:'123',getIDToken:async()=>'fixture-token',sleep:async()=>{}};
test('Publish exactly the uploaded ID once and require successful status',async()=>{
 const calls=[];let polls=0;
 const url=await publishPages({...publishOptions,request:async(route,args)=>{
  calls.push(route);
  if(route==='POST /repos/{owner}/{repo}/pages/deployments'){
   assert.equal(args.artifact_id,123);assert.equal(args.pages_build_version,'abc');assert.equal(args.oidc_token,'fixture-token');
   return {data:{id:'deployment',page_url:'https://owner.github.io/repo/'}};
  }
  return {data:{status:++polls===1?'queued':'succeed'}};
 }});
 assert.equal(url,'https://owner.github.io/repo/');assert.equal(calls.filter(x=>x.startsWith('POST')).length,1);assert.equal(polls,2);
});
test('Failed or uncertain creation is never retried',async()=>{
 let calls=0;
 await assert.rejects(publishPages({...publishOptions,request:async()=>{calls++;throw Error('network');}}),/network/);
 assert.equal(calls,1);
});
test('Permanent deployment failure cannot become success',async()=>{
 await assert.rejects(publishPages({...publishOptions,request:async route=>({data:route.startsWith('POST')?{id:'deployment'}:{status:'deployment_failed'}})}),/Pages deployment failed/);
});
test('Timeout cancels only the deployment created by this execution',async()=>{
 let cancelled=0;
 await assert.rejects(publishPages({...publishOptions,maxPolls:2,request:async(route,args)=>{
  if(route.endsWith('/cancel')){cancelled++;assert.equal(args.deployment_id,'owned');return {};}
  return {data:route.startsWith('POST')?{id:'owned'}:{status:'queued'}};
 }}),/cancelled/);assert.equal(cancelled,1);
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
