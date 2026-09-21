const $=id=>document.getElementById(id);
const embedded=new URLSearchParams(location.search).has('embed');
const framed=window.self!==window.top;
let data=null,ordered=[],shown=0;
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const httpsUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const mapsUrl=value=>{const url=httpsUrl(value);return /^https:\/\/(www\.)?google\.com\/maps(?:[/?]|$)/i.test(url)?url:'https://www.google.com/maps';};
function reviewLink(id){const url=new URL(location.href);url.search='';if(id)url.searchParams.set('review',id);return url.href;}
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
 const photos=(Array.isArray(review.photos)?review.photos:[]).map(httpsUrl).filter(Boolean).slice(0,4);
 if(photos.length){const grid=make('div','photos');for(const url of photos){const a=make('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';const img=make('img');img.src=url;img.alt='Photo attached to this review';img.loading='lazy';img.width=120;img.height=120;a.append(img);grid.append(a);}el.append(grid);}
 return el;
}
function appendBatch(){
 const list=$('reviews'),start=shown,startHeight=list.getBoundingClientRect().height;
 while(shown<ordered.length&&shown-start<5){
  const el=card(ordered[shown]);list.append(el);
  if(shown-start>=3&&list.getBoundingClientRect().height-startHeight>1000){el.remove();break;}
  shown++;
 }
 $('more').hidden=shown>=ordered.length;
 document.body.dataset.shown=String(shown);
}
function renderEmbed(){
 $('reviews').replaceChildren();shown=0;$('status').hidden=true;
 $('more').hidden=true;$('moreLink').hidden=false;$('moreLink').href=reviewLink();
 const height=framed?window.innerHeight:1140;
 // Never remove every review just because Google Sites gave the iframe a short mobile height.
 // Always keep at least one useful review visible, then fit up to five when space permits.
 const minimum=Math.min(ordered.length,window.innerWidth<=480?1:3);
 for(let i=0;i<minimum;i++){$('reviews').append(card(ordered[i]));shown++;}
 let lines=6;document.documentElement.style.setProperty('--lines',lines);
 while($('widget').scrollHeight>height-6&&lines>2)document.documentElement.style.setProperty('--lines',--lines);
 while(shown>1&&$('widget').scrollHeight>height-6){$('reviews').lastElementChild.remove();shown--;}
 while(shown<ordered.length&&shown<5){
  const el=card(ordered[shown]);$('reviews').append(el);
  if($('widget').scrollHeight>height-6){el.remove();break;}
  shown++;
 }
 for(const el of document.querySelectorAll('.review')){const text=el.querySelector('.text');el.querySelector('.read-full').hidden=text.scrollHeight<=text.clientHeight+1;}
 document.body.dataset.shown=String(shown);
}
function unavailable(){
 $('reviews').replaceChildren();$('summary').hidden=true;$('selectionNote').hidden=true;
 $('more').hidden=true;$('moreLink').hidden=true;$('status').hidden=false;
 $('status').textContent='Please view the latest customer reviews on Google.';
 document.body.dataset.ready='unavailable';ordered=[];data=null;
}
function render(){
 $('summary').hidden=false;$('summary').href=mapsUrl(data.googleMapsUrl);
 $('rating').textContent=data.averageRating.toFixed(1);$('total').textContent=data.totalReviewCount.toLocaleString('en-US');
 $('aggregateStars').style.setProperty('--fill',`${data.averageRating/5*100}%`);$('aggregateStars').setAttribute('aria-label',`${data.averageRating.toFixed(1)} out of 5 stars`);
 $('googleLink').href=mapsUrl(data.googleMapsUrl);
 $('selectionNote').hidden=false;$('status').hidden=true;
 $('backLink').href=httpsUrl(data.siteUrl)||'#';$('backLink').hidden=embedded||!httpsUrl(data.siteUrl);
 document.body.dataset.eligible=String(ordered.length);
 if(!ordered.length){$('status').textContent='View all customer reviews on Google.';$('status').hidden=false;$('more').hidden=true;$('moreLink').hidden=true;return;}
 if(embedded){renderEmbed();return;}
 $('reviews').replaceChildren();shown=0;appendBatch();
 const target=new URLSearchParams(location.search).get('review');
 if(target&&ordered.some(r=>r.id===target)){while(shown<ordered.length&&!$('review-'+target))appendBatch();const el=$('review-'+target);if(el){el.focus({preventScroll:true});el.scrollIntoView({block:'start'});}}
}
function boot(){
 try{
  const payloadNode=$('review-data');
  data=JSON.parse(payloadNode.textContent);payloadNode.remove();
  if(!data?.ok||!Array.isArray(data.reviews)||!Number.isFinite(data.averageRating)||!Number.isInteger(data.totalReviewCount)||!Number.isFinite(Date.parse(data.expiresAt))||Date.now()>=Date.parse(data.expiresAt))throw Error('Unavailable');
  // English/star filtering and chronological sorting were completed during the daily build.
  ordered=data.reviews;render();document.body.dataset.ready='true';
 }catch{unavailable();}
}
$('more').addEventListener('click',()=>{const before=shown;appendBatch();const first=document.querySelectorAll('.review')[before];if(first)first.focus({preventScroll:true});});
let resizeTimer;window.addEventListener('resize',()=>{if(embedded&&data){clearTimeout(resizeTimer);resizeTimer=setTimeout(renderEmbed,100);}});
function checkExpiry(){if(data&&Date.now()>=Date.parse(data.expiresAt))unavailable();}
window.addEventListener('pageshow',checkExpiry);document.addEventListener('visibilitychange',checkExpiry);setInterval(checkExpiry,60000);
boot();
