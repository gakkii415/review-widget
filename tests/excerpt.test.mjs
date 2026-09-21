import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewExcerpt} from '../src/excerpt.mjs';
const opening='I visited the studio for my first tattoo while travelling in Japan. The artist explained the design clearly in English, listened carefully to my ideas, and helped me choose the placement. The room was clean and private, and I felt comfortable throughout the appointment. I am very happy with the finished tattoo and appreciated the clear aftercare instructions. ';
test('Short reviews are shown verbatim in full',()=>{
 const text='The studio was clean and the artist explained the design clearly.';
 assert.deepEqual(reviewExcerpt(text),{text,truncated:false});
});
test('Long reviews retain several complete sentences, not a two-line fragment',()=>{
 const original=opening+'I would recommend this studio to other travellers. '.repeat(9);
 const preview=reviewExcerpt(original);
 assert.equal(preview.truncated,true);
 assert.ok(preview.text.length>=380&&preview.text.length<=705);
 assert.ok(original.startsWith(preview.text.slice(0,-2)));
 assert.match(preview.text,/[.!?] …$/);
});
test('No sentence punctuation falls back to whole words, never rewrites or truncates a word',()=>{
 const original=('A clear review without punctuation describing a comfortable experience ').repeat(15);
 const preview=reviewExcerpt(original);
 assert.ok(preview.text.length>=300);
 const prefix=preview.text.slice(0,-2);
 assert.ok(original.startsWith(prefix+' '));
});
test('Frame height cannot hide reviews or reduce their text',()=>{
 const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
 assert.ok(!css.includes('-webkit-line-clamp'));
 assert.ok(!app.includes("setProperty('--lines'"));
 assert.ok(!/\.embed\.framed\s*\{[^}]*overflow\s*:\s*hidden/.test(css));
 assert.ok(css.includes('overflow-y:auto'));
});
