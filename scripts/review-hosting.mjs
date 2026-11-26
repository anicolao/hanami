export function evidenceURL(repository,sha,path) {
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository)||!/^[a-f\d]{40}$/.test(sha))throw Error('Evidence requires a repository and immutable commit');
 if(!path.startsWith('screenshots/')||path.split('/').some(part=>part==='..')||!/(\.png|\.dom\.txt)$/.test(path))return null;
 return `https://raw.githubusercontent.com/${repository}/${sha}/tests/e2e/${path.split('/').map(encodeURIComponent).join('/')}`;
}
export function offloadManifest(manifest,resolve) {
 for(const step of manifest.steps)for(const view of step.views)for(const field of ['image','dom'])view[field]=resolve(view[field])||view[field];
 return manifest;
}
export function offloadReadme(text,resolve) {
 return text.replace(/\]\((?:\.\.\/){3}(screenshots\/[^)]+)\)/g,(match,path)=>{const url=resolve(path);return url?`](${url})`:match;});
}
