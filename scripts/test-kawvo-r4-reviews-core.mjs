import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('../api/src/reviews/external-google.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {normalizeGoogleReviewUrl:normalize,parseExternalReviewSettings:parse,publicExternalReviews:visible}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const good=['https://g.page/r/Cabc123/review','https://search.google.com/local/writereview?placeid=ChIJ_abc-123']
for(const url of good)assert.equal(normalize(url),url)
for(const url of ['javascript:alert(1)','http://g.page/r/abc/review','https://g.page.evil.test/r/abc/review','https://g.page@evil.test/r/abc/review','https://evil.test@g.page/r/abc/review','https://g.page:444/r/abc/review','https://g.page/r/abc/review?url=https://evil.test','https://g.page/r/abc','https://search.google.com/local/writereview?placeid=x&placeid=y','https://search.google.com/local/writereview?placeid=x&next=x','https://g.page/r/abc/review#x','https://g.page/r/abc/review\n',null,{},''])assert.equal(normalize(url),null,String(url))
assert.equal(parse({enabled:true,googleReviewUrl:''}),null)
assert.equal(parse({enabled:'true',googleReviewUrl:good[0]}),null)
assert.deepEqual(parse({enabled:false,googleReviewUrl:''}),{enabled:false,googleReviewUrl:''})
for(const eligible of [true,false])for(const published of [true,false])for(const enabled of [true,false]){
 const config={enabled,googleReviewUrl:good[0]}
 assert.deepEqual(visible(config,eligible,published),eligible&&published&&enabled?{googleReviewUrl:good[0]}:null)
}
console.log('PASS R4 Google URL and public visibility contract')
