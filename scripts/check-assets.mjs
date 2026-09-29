import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
for(const name of ['index.html','credits.html']){
 const content=await readFile(path.join(root,name),'utf8');
 for(const [,ref] of content.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await access(path.join(root,ref));
}
for(const name of ['app.js','map.js','regions.js','geometry.js','store.js','documents.js','kml.js','map-view.js','image-export.js']){const result=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr)}
console.log('Static assets and JavaScript syntax: PASS');
