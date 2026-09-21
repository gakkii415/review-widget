import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {selectReviews} from '../src/selection.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const imageUrl=value=>/^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|ggpht\.com)\//i.test(String(value||''))?String(value):'';
const httpsUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};

export function snapshot(raw,now=Date.now()) {
  if(!raw?.ok||!Array.isArray(raw.reviews)||!Number.isFinite(raw.averageRating)||raw.averageRating<0||raw.averageRating>5||!Number.isInteger(raw.totalReviewCount)||raw.totalReviewCount<0)throw Error('Invalid upstream snapshot');
  const fetchedAt=Date.parse(raw.generatedAt);
  if(!Number.isFinite(fetchedAt)||now-fetchedAt>7*3600000||fetchedAt-now>300000)throw Error('Upstream snapshot too old');
  // Rebuild from the current response only. Never merge an old snapshot or keep removed IDs.
  const reviews=selectReviews(raw.reviews).map(r=>({
    id:String(r.id),reviewerName:String(r.reviewerName||'Google user'),
    profilePhotoUrl:imageUrl(r.profilePhotoUrl),rating:5,text:String(r.text),
    createTime:String(r.createTime||''),photos:(Array.isArray(r.photos)?r.photos:[]).map(imageUrl).filter(Boolean).slice(0,4)
  }));
  return {ok:true,averageRating:raw.averageRating,totalReviewCount:raw.totalReviewCount,
    googleMapsUrl:httpsUrl(raw.googleMapsUrl),siteUrl:httpsUrl(raw.siteUrl),
    generatedAt:raw.generatedAt,snapshotUpdatedAt:new Date(now).toISOString(),
    expiresAt:new Date(fetchedAt+48*3600000).toISOString(),reviews};
}
export function safeJson(value) {
  return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
}
export function assemble(template,payload,css,js) {
  for(const marker of ['<!-- REVIEW_DATA -->','<!-- REVIEW_APP -->']) {
    if(template.split(marker).length!==2)throw Error('Missing or duplicate template marker');
  }
  if(!/<meta name="robots" content="noindex, nofollow, noimageindex">/.test(template))throw Error('noindex required');
  if(/<\/script/i.test(js))throw Error('Unsafe bundled script terminator');
  return template.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
    .replace('<!-- REVIEW_DATA -->','<script id="review-data" type="application/json">'+safeJson(payload)+'</script>')
    .replace('<!-- REVIEW_APP -->','<script>'+js+'</script>');
}
async function main() {
  const config=JSON.parse(await fs.readFile(path.join(root,'config.json'),'utf8'));
  const endpoint=new URL(config.endpoint);
  if(endpoint.origin!=='https://script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(endpoint.pathname))throw Error('Invalid endpoint');
  let payload;
  for(let attempt=0;attempt<4;attempt++) {
    try {
      const response=await fetch(endpoint,{signal:AbortSignal.timeout(45000),cache:'no-store'});
      if(!response.ok)throw Error('Upstream HTTP error');
      payload=snapshot(await response.json());break;
    }catch{if(attempt<3)await new Promise(resolve=>setTimeout(resolve,3000));}
  }
  // Prefer an empty, useful fallback over republishing a removed review indefinitely.
  if(!payload){payload={ok:false,reviews:[],snapshotUpdatedAt:new Date().toISOString()};console.warn('::warning::Review source unavailable; publishing a data-free fallback.');}
  const bundle=await build({entryPoints:[path.join(root,'src/app.mjs')],bundle:true,minify:true,format:'iife',write:false,legalComments:'inline'});
  const template=await fs.readFile(path.join(root,'templates/index.html'),'utf8');
  const css=await fs.readFile(path.join(root,'style.css'),'utf8');
  const output=path.join(root,'dist');
  await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output);
  await fs.writeFile(path.join(output,'index.html'),assemble(template,payload,css,bundle.outputFiles[0].text));
  await fs.writeFile(path.join(output,'404.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Not found</title><p>This resource is not available.</p></html>');
  // No reviews.json, customer images, config file, or historical versions are published.
  console.log(JSON.stringify({build:'static-no-git-data',available:payload.ok,reviews:payload.reviews.length,htmlBytes:(await fs.stat(path.join(output,'index.html'))).size}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(()=>{console.error('Static review build failed; no customer data was logged.');process.exitCode=1;});
}
