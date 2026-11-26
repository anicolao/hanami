import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceURL,offloadManifest,offloadReadme} from '../../scripts/review-hosting.mjs';
const sha='a'.repeat(40),resolve=path=>evidenceURL('anicolao/hanami',sha,path);
test('review links retain exact source paths under an immutable commit',()=>{
 const image='screenshots/game/001-linux.png',dom='screenshots/game/001-linux.dom.txt';
 const manifest={steps:[{views:[{image,dom}]}]};offloadManifest(manifest,resolve);
 assert.equal(manifest.steps[0].views[0].image,`https://raw.githubusercontent.com/anicolao/hanami/${sha}/tests/e2e/${image}`);
 const readme=`![Step](../../../${image})\n[DOM](../../../${dom})`;
 assert.equal(offloadReadme(readme,resolve),`![Step](${resolve(image)})\n[DOM](${resolve(dom)})`);
 assert.equal(resolve('../private.png'),null);assert.equal(resolve('screenshots/../private.png'),null);
 assert.throws(()=>evidenceURL('anicolao/hanami','main',image));
});
test('unverified and already absolute review links remain unchanged',()=>{
 const manifest={steps:[{views:[{image:'https://example.com/a.png',dom:'screenshots/not-in-source.dom.txt'}]}]};
 assert.deepEqual(offloadManifest(structuredClone(manifest),()=>null),manifest);
 assert.equal(offloadReadme('[DOM](../../../screenshots/local.dom.txt)',()=>null),'[DOM](../../../screenshots/local.dom.txt)');
});
