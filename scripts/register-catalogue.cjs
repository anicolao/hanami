// Explicitly authorized, one-document registration in the existing LauncherUI catalog.
// Default is a dry run; --apply commits only Applications/hanami with preconditions.
const {getGlobalDefaultAccount,getAccessToken}=require('firebase-tools/lib/auth');
const {requireAuth}=require('firebase-tools/lib/requireAuth');const fs=require('node:fs');
const record={Title:'Hanami',URL:'https://anicolao.github.io/hanami/pr1/tabletop/',WebURL:'https://anicolao.github.io/hanami/pr1/',Icon:'https://anicolao.github.io/hanami/pr1/assets/watercolor/box.png',Hidden:false,GameroomEnabled:'integrated'};
(async()=>{
 const account=getGlobalDefaultAccount();await requireAuth({project:'launcherui',...account});const {access_token}=await getAccessToken(account.tokens.refresh_token,[]);const headers={Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'};
 const base='https://firestore.googleapis.com/v1/projects/launcherui/databases/(default)/documents',url=`${base}/Applications/hanami`;
 const response=await fetch(url,{headers});let prior=null;if(response.ok)prior=await response.json();else if(response.status!==404)throw Error(`Catalog read failed ${response.status}`);
 const fields=Object.fromEntries(Object.entries(record).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:{stringValue:v}]));
 if(prior){if(JSON.stringify(prior.fields)!==JSON.stringify(fields)){const old=Object.fromEntries(Object.entries(prior.fields).map(([k,v])=>[k,v.stringValue??v.booleanValue]));if(Object.keys(record).every(k=>old[k]===record[k])){console.log('Hanami catalog entry already matches.');return;}throw Error('Applications/hanami already exists with different content; no overwrite performed.');}console.log('Hanami catalog entry already matches.');return;}
 console.log(JSON.stringify({id:'hanami',...record},null,2));
 if(!process.argv.includes('--apply')){console.log('Dry run only.');return;}
 const result=await fetch(`${base}:commit`,{method:'POST',headers,body:JSON.stringify({writes:[{update:{name:'projects/launcherui/databases/(default)/documents/Applications/hanami',fields},currentDocument:{exists:false}}]})});if(!result.ok)throw Error(`Targeted registration failed ${result.status}: ${await result.text()}`);
 const check=await fetch(url,{headers});if(!check.ok)throw Error('Registration read-back failed');const saved=await check.json();fs.writeFileSync('/tmp/hanami-catalogue-receipt.json',JSON.stringify(saved,null,2));console.log('Registered and read back Applications/hanami; all other records untouched.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
