import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {evidenceURL,offloadManifest,offloadReadme} from './review-hosting.mjs';
const repo=process.env.GITHUB_REPOSITORY||'anicolao/hanami';
if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('Invalid repository');
const token=process.env.GH_TOKEN||execFileSync('gh',['auth','token'],{encoding:'utf8'}).trim();
async function api(path,body){
 const response=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Error(`GitHub ${path}: ${response.status} ${await response.text()}`);
 return response.json();
}
const ref=await api('git/ref/heads/gh-pages'),parent=ref.object.sha,commit=await api(`git/commits/${parent}`),tree=await api(`git/trees/${commit.tree.sha}?recursive=1`);
if(tree.truncated)throw Error('Refusing to change an incomplete Pages tree');
const files=new Map(tree.tree.filter(e=>e.type==='blob').map(e=>[e.path,e])),sources=new Map(),edits=[];
const blob=async sha=>Buffer.from((await api(`git/blobs/${sha}`)).content.replace(/\s/g,''),'base64').toString('utf8');
const viewer=await readFile(new URL('../tests/e2e/index.html',import.meta.url),'utf8');
let removed=0,bytes=0,sites=0;
for(const [path] of files){
 if(!/^(pr\d+\/)?review\/index\.html$/.test(path))continue;
 const root=path.slice(0,-'index.html'.length),site=root.slice(0,-'review/'.length),build=files.get(`${site}build.json`);
 if(!build)continue;
 const sha=JSON.parse(await blob(build.sha)).sha;
 if(!/^[a-f\d]{40}$/.test(sha||''))continue;
 if(!sources.has(sha)){
  const source=await api(`git/trees/${sha}?recursive=1`);
  if(source.truncated)throw Error(`Incomplete source tree ${sha}`);
  sources.set(sha,new Map(source.tree.filter(e=>e.type==='blob').map(e=>[e.path,e.sha])));
 }
 const source=sources.get(sha),verified=new Set();
 for(const [name,file] of files)if(name.startsWith(`${root}screenshots/`)&&/\.(png|dom\.txt)$/.test(name)){
  const relative=name.slice(root.length);
  // Never remove evidence unless the immutable source contains the same bytes.
  if(source.get(`tests/e2e/${relative}`)!==file.sha)continue;
  verified.add(relative);edits.push({path:name,mode:'100644',type:'blob',sha:null});removed++;bytes+=file.size;
 }
 if(!verified.size)continue;
 const resolve=name=>verified.has(name)?evidenceURL(repo,sha,name):null;
 for(const [name,file] of files)if(name.startsWith(`${root}walkthroughs/`)&&(name.endsWith('/steps.json')||name.endsWith('/README.md'))){
  const original=await blob(file.sha),content=name.endsWith('/steps.json')?JSON.stringify(offloadManifest(JSON.parse(original),resolve),null,2)+'\n':offloadReadme(original,resolve);
  if(content!==original)edits.push({path:name,mode:'100644',type:'blob',content});
 }
 // All retained manifests use the same TestStepHelper schema. Keep one viewer
 // implementation, including absolute evidence URLs and native phone sizing.
 if(await blob(files.get(path).sha)!==viewer)edits.push({path,mode:'100644',type:'blob',content:viewer});
 sites++;
}
console.log(JSON.stringify({sites,removed,bytes,remainingBytes:[...files.values()].reduce((n,f)=>n+f.size,0)-bytes,dryRun:process.argv.includes('--dry-run')}));
if(!edits.length||process.argv.includes('--dry-run'))process.exit(0);
const updated=await api('git/trees',{base_tree:commit.tree.sha,tree:edits});
const next=await api('git/commits',{message:'Serve Pages review evidence from identical immutable source files',tree:updated.sha,parents:[parent]});
const response=await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/gh-pages`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({sha:next.sha,force:false})});
if(!response.ok)throw Error(`Pages advanced; retry against its latest tree: ${response.status} ${await response.text()}`);
console.log(`Updated gh-pages: ${next.sha}`);
