// One-document maintenance of the existing shared LauncherUI catalog.
// Default is a dry run; --apply creates Hanami or updates only its three URLs.
const {getGlobalDefaultAccount,getAccessToken}=require('firebase-tools/lib/auth');
const {requireAuth}=require('firebase-tools/lib/requireAuth');
const fs=require('node:fs');
const record={Title:'Hanami',URL:'https://anicolao.github.io/hanami/tabletop/',WebURL:'https://anicolao.github.io/hanami/',Icon:'https://anicolao.github.io/hanami/assets/watercolor/box.png',Hidden:false,GameroomEnabled:'integrated'};
(async()=>{
 const account=getGlobalDefaultAccount();await requireAuth({project:'launcherui',...account});
 const {access_token}=await getAccessToken(account.tokens.refresh_token,[]);
 const headers={Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'};
 const base='https://firestore.googleapis.com/v1/projects/launcherui/databases/(default)/documents';
 const document='projects/launcherui/databases/(default)/documents/Applications/hanami',url=`${base}/Applications/hanami`;
 const response=await fetch(url,{headers});let prior=null;
 if(response.ok)prior=await response.json();else if(response.status!==404)throw Error(`Catalog read failed ${response.status}`);
 const old=Object.fromEntries(Object.entries(prior?.fields||{}).map(([k,v])=>[k,v.stringValue??v.booleanValue]));
 const keys=prior?['URL','WebURL','Icon']:Object.keys(record);
 const changes=Object.fromEntries(keys.filter(k=>old[k]!==record[k]).map(k=>[k,record[k]]));
 if(!Object.keys(changes).length){console.log('Hanami catalog entry already matches production.');return;}
 console.log(JSON.stringify({id:'hanami',before:old,changes},null,2));
 if(!process.argv.includes('--apply')){console.log('Dry run only.');return;}
 for(const link of [record.URL,record.WebURL,record.Icon]){
  const res=await fetch(link,{method:'HEAD'});if(!res.ok)throw Error(`Production URL is not ready: ${link} (${res.status})`);
 }
 const fields=Object.fromEntries(Object.entries(prior?changes:record).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:{stringValue:v}]));
 const write={update:{name:document,fields},currentDocument:prior?{updateTime:prior.updateTime}:{exists:false},...(prior?{updateMask:{fieldPaths:Object.keys(changes)}}:{})};
 const result=await fetch(`${base}:commit`,{method:'POST',headers,body:JSON.stringify({writes:[write]})});
 if(!result.ok)throw Error(`Targeted catalog update failed ${result.status}: ${await result.text()}`);
 const check=await fetch(url,{headers});if(!check.ok)throw Error('Catalog read-back failed');
 const saved=await check.json();for(const key of keys)if((saved.fields[key]?.stringValue??saved.fields[key]?.booleanValue)!==record[key])throw Error(`Read-back mismatch: ${key}`);
 fs.writeFileSync('/tmp/hanami-catalogue-receipt.json',JSON.stringify(saved,null,2));
 console.log('Read back production URLs in Applications/hanami. Other fields and records untouched.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
