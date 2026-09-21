import test from 'node:test';
import assert from 'node:assert/strict';
import {isEnglish,originalText,selectReviews,newest,score} from '../src/selection.mjs';
const now=Date.parse('2026-09-21');
// Synthetic unit fixtures, never customer testimonials or production data.
const english='This was my first tattoo and I was nervous, but the artist explained the design in English and made me feel comfortable. The studio was clean and the result was wonderful.';
const french="Le studio est très propre et le tatoueur est très gentil. Nous avons passé un excellent moment et nous recommandons ce studio pour un beau tatouage.";
const review=(id,text=english,createTime='2026-09-15T00:00:00Z',rating=5)=>({id,text,createTime,rating,reviewerName:'Test fixture'});
test('English original filter rejects other languages and empty/ambiguous text',()=>{
 assert.equal(isEnglish(english),true);assert.equal(isEnglish('Great tattoo!'),true);
 for(const s of [french,'Das Studio ist sehr sauber und der Künstler war sehr freundlich. Ich würde dieses Studio sehr empfehlen.','とても丁寧で綺麗なスタジオでした。ありがとうございました。','','★★★★★','Super']) assert.equal(isEnglish(s),false,s);
});
test('A translated English paragraph must not admit a French original',()=>{
 const text=english+'\n\n(Original)\n'+french;
 assert.equal(originalText(text),french);assert.equal(isEnglish(text),false);
});
test('Five stars only, deduplicated; pinning cannot bypass eligibility',()=>{
 const raw=[review('a'),review('a'),review('b',english,undefined,4),review('fr',french),review('c')];
 assert.deepEqual(selectReviews(raw,['fr','c'],now).map(x=>x.id),['c','a']);
});
test('Keep older eligible reviews and use creation dates for newest sort',()=>{
 const raw=Array.from({length:10},(_,i)=>review(String(i),english,'2026-09-'+String(i+1).padStart(2,'0')+'T00:00:00Z'));
 raw.push(review('old',english,'2020-01-01T00:00:00Z'));
 assert.equal(selectReviews(raw,[],now).length,11);assert.equal(selectReviews(raw,[],now).at(-1).id,'old');
 assert.deepEqual(selectReviews(raw,[],now),selectReviews(raw,[],now));
 assert.equal([...raw].sort(newest)[0].id,'9');
});
test('Content scoring is not just length',()=>{
 const detailed=review('detail',english),generic=review('generic','I had a great experience. '.repeat(6));
 assert.ok(score(detailed,now)>score(generic,now));
});
