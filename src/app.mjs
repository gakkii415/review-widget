import {selectReviews,newest} from './selection.mjs';
const $=id=>document.getElementById(id);
const embedded=new URLSearchParams(location.search).has('embed');
const framed=window.self!==window.top;
let config={},data=null,ordered=[],shown=0,busy=false;
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const httpsUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const mapsUrl=value=>{const url=httpsUrl(value);return /^https:\/\/(www\.)?google\.com\/maps(?:[/?]|$)/i.test(url)?url:'https://www.google.com/maps';};
function reviewLink(id){const url=new URL(location.href);url.search='';if(id)url.searchParams.set('review',id);return url.href;}
function readData(endpoint){
 return new Promise((resolve,reject)=>{
   const url=new URL(endpoint);
   if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname))return reject(Error('Invalid endpoint'));
   const callback='rwcb_'+crypto.randomUUID().replaceAll('-','');
   const script=document.createElement('script');
   const finish=(error,payload)=>{clearTimeout(timer);script.remove();window[callback]=()=>{};setTimeout(()=>delete window[callback],60000);error?reject(error):resolve(payload);};
   const timer=setTimeout(()=>finish(Error('Loading timed out')),45000);
   window[callback]=payload=>finish(null,payload);
   script.onerror=()=>finish(Error('Network error'));
   url.searchParams.set('callback',callback);script.src=url.href;document.head.append(script);
 });
}
function card(review){
 const el=make('article','review');el.id='review-'+review.id;el.dataset.reviewId=review.id;el.tabIndex=-1;
 const author=make('div','author');
 const fallback=()=>make('span','avatar initial',Array.from(review.reviewerName||'G')[0].toUpperCase());
 const photo=httpsUrl(review.profilePhotoUrl);
 if(photo){const img=make('img','avatar');img.src=photo;img.alt='';img.width=44;img.height=44;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.replaceWith(fallback());author.append(img);}else author.append(fallback());
 const info=make('div','author-info');info.append(make('div','name',review.reviewerName||'Google user'));
 const date=new Date(review.createTime);
 if(Number.isFinite(date.getTime())){const t=make('time','date',new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(date));t.dateTime=date.toISOString();info.append(t);}
 author.append(info);el.append(author);
 const stars=make('span','review-stars','★★★★★');stars.setAttribute('role','img');stars.setAttribute('aria-label','5 out of 5 stars');el.append(stars,make('p','text',review.text));
 if(embedded){const a=make('a','read-full','Read full review');a.href=reviewLink(review.id);a.target='_blank';a.rel='noopener noreferrer';el.append(a);}
 // Only adapter-supplied, explicitly linked review photos are eligible.
 const photos=(Array.isArray(review.photos)?review.photos:[]).map(httpsUrl).filter(Boolean).slice(0,4);
 if(photos.length){const grid=make('div','photos');for(const url of photos){const a=make('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';const img=make('img');img.src=url;img.alt='Photo attached to this review';img.loading='lazy';a.append(img);grid.append(a);}el.append(grid);}
 return el;
}
function appendBatch(){
 const list=$('reviews'),start=shown,startHeight=list.getBoundingClientRect().height;
 while(shown<ordered.length && shown-start<5){
  const el=card(ordered[shown]);list.append(el);
  const fullHeight=list.getBoundingClientRect().height-startHeight;
  if(shown-start>=3 && fullHeight>1000){el.remove();break;}
  shown++;
 }
 $('more').hidden=shown>=ordered.length;
 document.body.dataset.shown=String(shown);
}
function renderEmbed(){
 $('reviews').replaceChildren();shown=0;
 $('more').hidden=true;$('moreLink').hidden=false;$('moreLink').href=reviewLink();
 // Fit the actual frame without an inner scrolling list.
 const height=framed?window.innerHeight:1140;
 for(let i=0;i<Math.min(3,ordered.length);i++){ $('reviews').append(card(ordered[i]));shown++; }
 let lines=6;document.documentElement.style.setProperty('--lines',lines);
 while($('widget').scrollHeight>height-6 && lines>2){document.documentElement.style.setProperty('--lines',--lines);}
 if($('widget').scrollHeight>height-6 && framed){
  $('reviews').replaceChildren();shown=0;$('status').textContent='Read customer reviews on the full page.';$('status').hidden=false;
 }else{
  while(shown<ordered.length&&shown<5){const el=card(ordered[shown]);$('reviews').append(el);if($('widget').scrollHeight>height-6){el.remove();break;}shown++;}
 }
 for(const el of document.querySelectorAll('.review')){const text=el.querySelector('.text');el.querySelector('.read-full').hidden=text.scrollHeight<=text.clientHeight+1;}
 document.body.dataset.shown=String(shown);
}
function render(){
 const total=Number(data.totalReviewCount),rating=Number(data.averageRating);
 if(!Number.isFinite(total)||!Number.isFinite(rating)||rating<0||rating>5)throw Error('Invalid summary');
 $('summary').hidden=false;$('summary').href=mapsUrl(data.googleMapsUrl);
 $('rating').textContent=rating.toFixed(1);$('total').textContent=total.toLocaleString('en-US');
 $('aggregateStars').style.setProperty('--fill',`${rating/5*100}%`);$('aggregateStars').setAttribute('aria-label',`${rating.toFixed(1)} out of 5 stars`);
 $('googleLink').href=mapsUrl(data.googleMapsUrl);
 $('selectionNote').hidden=false;$('status').hidden=true;$('retry').hidden=true;
 $('backLink').href=httpsUrl(data.siteUrl)||'#';$('backLink').hidden=embedded||!httpsUrl(data.siteUrl);
 document.body.dataset.eligible=String(ordered.length);
 if(!ordered.length){$('status').textContent='View all customer reviews on Google.';$('status').hidden=false;$('more').hidden=true;$('moreLink').hidden=true;return;}
 if(embedded){renderEmbed();return;}
 $('controls').hidden=false;$('reviews').replaceChildren();shown=0;appendBatch();
 const target=new URLSearchParams(location.search).get('review');
 if(target){while(shown<ordered.length&&!$('review-'+target))appendBatch();const el=$('review-'+target);if(el){el.focus({preventScroll:true});el.scrollIntoView({block:'start'});}}
}
async function load(){
 if(busy)return;busy=true;$('retry').hidden=true;$('status').hidden=true;$('status').textContent='';
 try{
  if(!config.endpoint){const response=await fetch('config.json',{cache:'force-cache'});if(!response.ok)throw Error('Configuration unavailable');config=await response.json();}
  data=await readData(config.endpoint);if(!data?.ok)throw Error('Data unavailable');
  ordered=selectReviews(data.reviews,config.pinnedReviewIds||[]);render();document.body.dataset.ready='true';
 }catch(error){$('status').hidden=false;$('status').textContent='Reviews could not be loaded. Please try again or view them on Google.';$('retry').hidden=false;document.body.dataset.ready='error';}
 finally{busy=false;}
}
$('retry').addEventListener('click',load);
$('more').addEventListener('click',()=>{const before=shown;appendBatch();const first=document.querySelectorAll('.review')[before];if(first)first.focus({preventScroll:true});});
$('sort').addEventListener('change',()=>{ordered=selectReviews(data.reviews,config.pinnedReviewIds||[]);if($('sort').value==='newest')ordered.sort(newest);$('reviews').replaceChildren();shown=0;appendBatch();});
let resizeTimer;window.addEventListener('resize',()=>{if(embedded&&data){clearTimeout(resizeTimer);resizeTimer=setTimeout(renderEmbed,100);}});
load();
