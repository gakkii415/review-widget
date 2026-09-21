import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {reviewExcerpt} from '../src/excerpt.mjs';
const local=!process.env.BASE_URL;
const base=process.env.BASE_URL||'http://127.0.0.1:8765/';
const expectedVersion='v'+fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();
const builtHtml=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const server=local?spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'}):null;
const browser=await chromium.launch({headless:true});
const checks=[];
let dataRequests=0,scriptErrors=0;
function observe(page){
 page.on('pageerror',()=>scriptErrors++);
 page.on('request',r=>{if(/script\.google|config\.json|reviews\.json/.test(r.url()))dataRequests++;});
}
async function checkFrame(page,url,width,height,originals){
 await page.setViewportSize({width,height:900});
 await page.setContent(`<body style="margin:0"><iframe src="${url}?embed=1" title="Review embed" style="display:block;border:0;width:100%;height:${height}px"></iframe><p>Content after the review section.</p>`);
 const frame=page.frameLocator('iframe');
 await frame.locator('body[data-ready="true"]').waitFor({timeout:15000});
 assert.equal(await frame.locator('.version').innerText(),expectedVersion);
 const count=await frame.locator('.review').count();assert.ok(count>=3&&count<=5,'Minimum card count failed');
 const rendered=await frame.locator('.review').evaluateAll(es=>es.slice(0,3).map(c=>{
  const t=c.querySelector('.text'),p=c.querySelector('.photos'),r=t.getBoundingClientRect();
  return {id:c.dataset.reviewId,text:t.textContent,chars:t.textContent.length,width:r.width,height:r.height,
   fullHeight:t.scrollHeight,cardWidth:c.getBoundingClientRect().width,clamp:getComputedStyle(t).webkitLineClamp,
   photoBelow:!p||p.getBoundingClientRect().top>=r.bottom,photoWidth:p?.querySelector('img')?.getBoundingClientRect().width||0};
 }));
 for(const item of rendered){
  const original=originals.get(item.id);assert.ok(typeof original==='string','Missing source review');
  assert.ok(item.text===reviewExcerpt(original).text,'Preview must preserve the original opening');
  assert.ok(item.height+1>=item.fullHeight,'Text was visually clipped');
  assert.equal(item.clamp,'none','Do not line-clamp meaningful review text');
  if(width<700){assert.ok(item.width>=item.cardWidth-40,'Photo squeezed mobile text');assert.ok(item.photoBelow,'Mobile photo must follow the text');}
  else if(item.photoWidth)assert.ok(item.photoWidth>=180,'Desktop photo too small');
 }
 const dimensions=await frame.locator('body').evaluate(()=>({required:document.getElementById('widget').getBoundingClientRect().height,
  height:innerHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:getComputedStyle(document.documentElement).overflowY}));
 assert.ok(dimensions.scrollWidth<=dimensions.width+1,'Horizontal overflow');
 if(dimensions.required>height+1){
  assert.equal(dimensions.overflow,'auto');
  await page.mouse.move(width/2,Math.min(height-60,700));await page.mouse.wheel(0,800);
  await frame.locator('body').evaluate(()=>new Promise(r=>setTimeout(r,150)));
  assert.ok(await frame.locator('body').evaluate(()=>scrollY>0),'Short frame traps the user with unreachable reviews');
 }else{
  assert.ok(await frame.locator('.review').evaluateAll(es=>es.slice(0,3).every(c=>c.getBoundingClientRect().bottom<=innerHeight+1)),'Three cards must be visible when frame is tall enough');
 }
 // Verify the third card and final action can be reached, not just that nodes exist.
 await frame.locator('.review').nth(2).scrollIntoViewIfNeeded();
 await frame.locator('#moreLink').scrollIntoViewIfNeeded();
 const button=await frame.locator('#moreLink').evaluate(el=>{const b=el.getBoundingClientRect();return {width:b.width,height:b.height,top:b.top,bottom:b.bottom,viewport:innerHeight};});
 assert.ok(button.width>=118&&button.width<=155&&button.height<=40,'Compact button regressed');
 assert.ok(button.top>=-1&&button.bottom<=button.viewport+1,'View More is unreachable');
 const href=await frame.locator('#moreLink').getAttribute('href');assert.ok(!href.includes('embed'));
 checks.push({width,height,count,requiredHeight:Math.ceil(dimensions.required),firstPreviewCharacters:rendered[0].chars,scrollFallback:dimensions.required>height+1,allThreeReachable:true});
}
try{
 if(local)await new Promise(r=>setTimeout(r,1000));
 const page=await browser.newPage({viewport:{width:390,height:844}});observe(page);
 // The live HTML, at the exact public URL, is the thing being verified.
 const response=await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['true','unavailable'].includes(document.body.dataset.ready),{},{timeout:15000});
 assert.equal(await page.locator('.version').innerText(),expectedVersion);
 assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
 assert.equal(await page.locator('#googleLink').isVisible(),false,'View on Google must stay hidden');
 const html=await response.text();
 const source=JSON.parse(html.match(/<script id="review-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const available=await page.locator('body').getAttribute('data-ready')==='true';
 if(available){
  const eligible=Number(await page.locator('body').getAttribute('data-eligible'));
  const before=await page.locator('.review').count();assert.ok(before>=Math.min(3,eligible)&&before<=5);
  if(await page.locator('#more').isVisible()){await page.locator('#more').click();const added=await page.locator('.review').count()-before;assert.ok(added>=Math.min(3,eligible-before)&&added<=5);}
  const dates=await page.locator('.review time').evaluateAll(es=>es.map(e=>Date.parse(e.dateTime)));
  assert.ok(dates.every((d,i)=>i===0||dates[i-1]>=d),'Chronological ordering failed');
  const ids=await page.locator('.review').evaluateAll(es=>es.map(e=>e.dataset.reviewId));assert.equal(ids.length,new Set(ids).size);
  for(const s of ['.rating','.count','.name','.text'])if(await page.locator(s).count())assert.match(await page.locator(s).first().evaluate(el=>getComputedStyle(el).fontFamily),/Arial/i);
  if(eligible>=3){
   const originals=new Map(source.reviews.map(r=>[r.id,r.text]));
   for(const [w,h] of [[320,600],[390,700],[390,1800],[900,1800]])await checkFrame(page,base,w,h,originals);
  }
 }else assert.equal(await page.locator('.review').count(),0);
 await page.goto(base+'?embed=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['true','unavailable'].includes(document.body.dataset.ready),{},{timeout:15000});
 assert.equal(await page.locator('.version').innerText(),expectedVersion);
 // Synthetic long/photo-heavy reviews, isolated in memory; no customer snapshots/screenshots in artifacts.
 const text='I visited the studio for my first tattoo while travelling in Japan. The artist explained the design clearly in English, listened carefully to my ideas, and helped me choose the placement. The room was clean and private, and I felt comfortable throughout the appointment. I am very happy with the finished tattoo and appreciated the clear aftercare instructions. '+'I would recommend this studio to other travellers. '.repeat(9);
 const fixture={ok:true,averageRating:5,totalReviewCount:3,googleMapsUrl:'https://www.google.com/maps',expiresAt:new Date(Date.now()+3600000).toISOString(),reviews:Array.from({length:3},(_,i)=>({id:'fixture-'+i,reviewerName:'Test reviewer',rating:5,createTime:'2026-09-01T00:00:00Z',text,photos:['https://photo.example.test/sample.svg']}))};
 const fixtureHtml=builtHtml.replace(/(<script id="review-data" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(fixture)+b);
 const fixturePage=await browser.newPage();observe(fixturePage);
 await fixturePage.route('https://widget.example.test/**',r=>r.fulfill({contentType:'text/html',body:fixtureHtml}));
 await fixturePage.route('https://photo.example.test/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#ddd"/></svg>'}));
 await fixturePage.goto('https://widget.example.test/');
 const originals=new Map(fixture.reviews.map(r=>[r.id,r.text]));
 for(const [w,h] of [[320,600],[390,2800]])await checkFrame(fixturePage,'https://widget.example.test/',w,h,originals);
 // Text and photos do not change when the same iframe gets more vertical space.
 const frame=fixturePage.frameLocator('iframe');
 const tallText=await frame.locator('.text').first().textContent();
 await fixturePage.locator('iframe').evaluate(el=>el.style.height='600px');await fixturePage.waitForTimeout(250);
 assert.ok(await frame.locator('.text').first().textContent()===tallText,'Frame resize shortened the review');
 await fixturePage.close();await page.close();
 assert.equal(dataRequests,0,'Browser made a live data request');assert.equal(scriptErrors,0,'Browser script error');
 console.log(JSON.stringify({result:'READABLE_EMBED_VERIFIED',available,liveDataRequests:dataRequests,version:expectedVersion,exactEmbedUrlVerified:true,checks}));
}finally{await browser.close();server?.kill();}
