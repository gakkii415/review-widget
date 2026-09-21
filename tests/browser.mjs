import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const base=process.env.BASE_URL||'http://127.0.0.1:8765/';
const local=!process.env.BASE_URL;
const server=local?spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'}):null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({headless:true});
const output=process.env.RUNNER_TEMP||'.';
try{
 if(local)await sleep(1200);
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.dataset.ready==='true',{},{timeout:90000});
 let before=await page.locator('.review').count();assert.ok(before>=3&&before<=5);
 const rating=Number(await page.locator('#rating').innerText());assert.ok(rating>0&&rating<=5);
 const total=Number((await page.locator('#total').innerText()).replaceAll(',',''));
 const eligible=Number(await page.locator('body').getAttribute('data-eligible'));assert.ok(total>=eligible&&eligible>=3);
 const firstIds=await page.locator('.review').evaluateAll(es=>es.map(e=>e.dataset.reviewId));
 if(await page.locator('#more').isVisible()){
  await page.locator('#more').click();const after=await page.locator('.review').count();assert.ok(after-before>=Math.min(3,eligible-before)&&after-before<=5);
  const ids=await page.locator('.review').evaluateAll(es=>es.map(e=>e.dataset.reviewId));assert.equal(new Set(ids).size,ids.length);
 }
 await page.selectOption('#sort','newest');
 const dates=await page.locator('.review time').evaluateAll(es=>es.map(e=>Date.parse(e.dateTime)));
 assert.deepEqual(dates,[...dates].sort((a,b)=>b-a));
 await page.selectOption('#sort','featured');assert.deepEqual(await page.locator('.review').evaluateAll(es=>es.map(e=>e.dataset.reviewId)),firstIds);
 await page.screenshot({path:output+'/reviews-full.png',fullPage:true});
 for(const width of [320,390,768]){
  const parent=await browser.newPage({viewport:{width,height:900}});
  await parent.goto(base,{waitUntil:'domcontentloaded'});
  await parent.setContent(`<iframe title="test embed" src="${base}?embed=1" style="display:block;border:0;width:100%;height:1140px"></iframe><p>Website content after reviews</p>`);
  const frame=parent.frameLocator('iframe');
  await frame.locator('body[data-ready="true"]').waitFor({timeout:90000});
  const fit=await frame.locator('body').evaluate(()=>({height:window.innerHeight,content:document.getElementById('widget').scrollHeight,width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,count:document.querySelectorAll('.review').length}));
  assert.ok(fit.count>=3&&fit.count<=5,JSON.stringify(fit));assert.ok(fit.content<=fit.height,JSON.stringify(fit));assert.ok(fit.scrollWidth<=fit.width,JSON.stringify(fit));
  assert.ok(!(await frame.locator('#moreLink').getAttribute('href')).includes('embed'));
  if(width===390)await parent.screenshot({path:output+'/reviews-embedded.png',fullPage:true});
  await parent.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'BROWSER_LIVE_VERIFIED',total,rating,eligible,initial:before,batchLoading:true,sort:true,embedWidths:[320,390,768],innerScroll:false,url:base}));
 await page.close();
}finally{await browser.close();server?.kill();}
