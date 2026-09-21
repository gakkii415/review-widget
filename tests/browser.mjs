import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const local=!process.env.BASE_URL;
const base=process.env.BASE_URL||'http://127.0.0.1:8765/';
const expectedVersion='v'+fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();
const server=local?spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'}):null;
const browser=await chromium.launch({headless:true});
const embedChecks=[];
try{
 if(local)await new Promise(r=>setTimeout(r,1000));
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let scriptErrors=0,dataRequests=0;
 page.on('pageerror',()=>scriptErrors++);
 page.on('request',r=>{if(/script\.google|config\.json|reviews\.json/.test(r.url()))dataRequests++;});
 // Read the actual page, not the source template, without a cache-busting URL.
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['true','unavailable'].includes(document.body.dataset.ready),{},{timeout:30000});
 assert.equal(await page.locator('.version').innerText(),expectedVersion);
 assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
 const available=await page.locator('body').getAttribute('data-ready')==='true';
 if(available){
  const eligible=Number(await page.locator('body').getAttribute('data-eligible'));
  const before=await page.locator('.review').count();assert.ok(before>=Math.min(3,eligible)&&before<=5);
  if(await page.locator('#more').isVisible()){
   const bounds=await page.locator('#more').boundingBox();
   assert.ok(bounds.width>=118&&bounds.width<=155&&bounds.height<=40,'Compact View More dimensions failed');
   await page.locator('#more').click();const added=await page.locator('.review').count()-before;assert.ok(added>=Math.min(3,eligible-before)&&added<=5);
  }
  const dates=await page.locator('.review time').evaluateAll(es=>es.map(e=>Date.parse(e.dateTime)));
  assert.ok(dates.every((d,i)=>i===0||dates[i-1]>=d),'Chronological ordering failed');
  const ids=await page.locator('.review').evaluateAll(es=>es.map(e=>e.dataset.reviewId));assert.equal(ids.length,new Set(ids).size);
  for(const selector of ['.rating','.count','.name','.text']){
   if(await page.locator(selector).count())assert.match(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).fontFamily),/Arial/i);
  }
  if(eligible>=3){
   for(const width of [320,390,900]){
    await page.setViewportSize({width,height:900});
    await page.setContent(`<iframe src="${base}?embed=1" title="Review embed" style="border:0;width:100%;height:1140px"></iframe>`);
    const frame=page.frameLocator('iframe');
    await frame.locator('body[data-ready="true"]').waitFor({timeout:30000});
    assert.equal(await frame.locator('.version').innerText(),expectedVersion);
    const fit=await frame.locator('body').evaluate(()=>{
     const cards=[...document.querySelectorAll('.review')];
     const button=document.getElementById('moreLink').getBoundingClientRect();
     const image=document.querySelector('.review .photos img')?.getBoundingClientRect();
     return {width:innerWidth,count:cards.length,content:document.getElementById('widget').scrollHeight,height:innerHeight,
      firstThreeVisible:cards.slice(0,3).every(c=>{const r=c.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),
      buttonWidth:button.width,buttonHeight:button.height,buttonBottom:button.bottom,photoWidth:image?.width||0};
    });
    assert.ok(fit.count>=3&&fit.count<=5,'Embed card count failed');
    assert.ok(fit.firstThreeVisible&&fit.content<=fit.height,'Embed cards are clipped: '+JSON.stringify(fit));
    assert.ok(fit.buttonWidth>=118&&fit.buttonWidth<=155&&fit.buttonHeight<=40&&fit.buttonBottom<=fit.height,'Embed button size/visibility failed');
    if(width===900&&fit.photoWidth)assert.ok(fit.photoWidth>=128&&fit.photoWidth<=180,'Desktop photo remains too small');
    assert.ok(!(await frame.locator('#moreLink').getAttribute('href')).includes('embed'));
    embedChecks.push({width,count:fit.count,fullyVisible:fit.firstThreeVisible,buttonWidth:fit.buttonWidth,photoWidth:fit.photoWidth});
   }
  }
 }else assert.equal(await page.locator('.review').count(),0);
 // Also verify the exact URL supplied for the Google Sites embed.
 await page.goto(base+'?embed=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['true','unavailable'].includes(document.body.dataset.ready),{},{timeout:30000});
 assert.equal(await page.locator('.version').innerText(),expectedVersion);
 assert.equal(dataRequests,0,'Browser made a live data request');assert.equal(scriptErrors,0,'Browser script error');
 console.log(JSON.stringify({result:'PRIVACY_BROWSER_VERIFIED',available,liveDataRequests:dataRequests,version:expectedVersion,exactEmbedUrlVerified:true,embedChecks}));
 // Read-only check of the already-public parent site. Unpublished editor previews are not accessible.
 if(!local){
  let parentResult='NOT_CHECKED';
  try{
   const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
   const payload=JSON.parse(html.match(/<script id="review-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
   const site=new URL(payload.siteUrl);
   if(site.origin==='https://sites.google.com'){
    const parent=await browser.newPage({viewport:{width:390,height:844}});
    await parent.goto(site.href,{waitUntil:'domcontentloaded',timeout:20000});
    for(let n=0;n<4;n++){await parent.evaluate(()=>scrollBy(0,innerHeight));await parent.waitForTimeout(800);}
    const child=parent.frames().find(f=>f.url().startsWith(base));
    if(child){
     const version=await child.locator('.version').innerText({timeout:5000});
     const count=await child.locator('.review').count();
     parentResult={status:version===expectedVersion?'PUBLIC_PARENT_VERIFIED':'PUBLIC_PARENT_OLDER',version,count};
    }else parentResult='NO_MATCHING_EMBED_ON_PUBLIC_SITE';
    await parent.close();
   }
  }catch{parentResult='PUBLIC_PARENT_CHECK_UNAVAILABLE';}
  console.log(JSON.stringify({result:'PUBLIC_PARENT_DIAGNOSTIC',detail:parentResult}));
 }
}finally{await browser.close();server?.kill();}
