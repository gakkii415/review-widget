import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const local=!process.env.BASE_URL;
const base=process.env.BASE_URL||'http://127.0.0.1:8765/';
const server=local?spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'}):null;
const browser=await chromium.launch({headless:true});
try{
 if(local)await new Promise(r=>setTimeout(r,1000));
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let scriptErrors=0,dataRequests=0;
 page.on('pageerror',()=>scriptErrors++);
 page.on('request',r=>{if(/script\.google|config\.json|reviews\.json/.test(r.url()))dataRequests++;});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['true','unavailable'].includes(document.body.dataset.ready),{},{timeout:30000});
 assert.equal(await page.locator('.version').innerText(),'v2');
 assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
 const available=await page.locator('body').getAttribute('data-ready')==='true';
 if(available){
  const eligible=Number(await page.locator('body').getAttribute('data-eligible'));
  const before=await page.locator('.review').count();assert.ok(before>=Math.min(3,eligible)&&before<=5);
  if(await page.locator('#more').isVisible()){await page.locator('#more').click();const added=await page.locator('.review').count()-before;assert.ok(added>=Math.min(3,eligible-before)&&added<=5);}
  const dates=await page.locator('.review time').evaluateAll(es=>es.map(e=>Date.parse(e.dateTime)));
  assert.ok(dates.every((d,i)=>i===0||dates[i-1]>=d),'Chronological ordering failed');
  const ids=await page.locator('.review').evaluateAll(es=>es.map(e=>e.dataset.reviewId));assert.equal(ids.length,new Set(ids).size);
  for(const selector of ['.rating','.count','.name','.text']){
   if(await page.locator(selector).count())assert.match(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).fontFamily),/Arial/i);
  }
  if(eligible>=3){
   for(const width of [320,390]){
    await page.setViewportSize({width,height:900});
    await page.setContent(`<iframe src="${base}?embed=1" title="Review embed" style="border:0;width:100%;height:1140px"></iframe>`);
    const frame=page.frameLocator('iframe');
    await frame.locator('body[data-ready="true"]').waitFor({timeout:30000});
    const fit=await frame.locator('body').evaluate(()=>({count:document.querySelectorAll('.review').length,content:document.getElementById('widget').scrollHeight,height:innerHeight}));
    assert.ok(fit.count>=3&&fit.count<=5,'Embed card count failed');assert.ok(fit.content<=fit.height,'Embed height failed');
    assert.ok(!(await frame.locator('#moreLink').getAttribute('href')).includes('embed'));
   }
  }
 }else assert.equal(await page.locator('.review').count(),0);
 assert.equal(dataRequests,0,'Browser made a live data request');assert.equal(scriptErrors,0,'Browser script error');
 console.log(JSON.stringify({result:'PRIVACY_BROWSER_VERIFIED',available,liveDataRequests:dataRequests,version:2}));
}finally{await browser.close();server?.kill();}
