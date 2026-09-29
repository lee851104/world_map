import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {normalizeRegions} from '../dist/regions.js';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('dist/data/adm1-index.json',root),'utf8'));
const ids=[];for(const scope of ['world','taiwan'])ids.push(...normalizeRegions(JSON.parse(await readFile(new URL(`dist/data/${scope}.json`,root),'utf8')),scope).map(r=>r.id));
ids.push(...catalog.legacyWorldIds||[]);
for(const [iso,entry]of Object.entries(catalog.countries))ids.push(...entry.ids.map(id=>`adm1:${iso}-${id}`));
await mkdir(new URL('worker/',root),{recursive:true});await writeFile(new URL('worker/valid-region-ids.json',root),JSON.stringify(ids));
await mkdir(new URL('dist/server/',root),{recursive:true});await mkdir(new URL('dist/client/',root),{recursive:true});await mkdir(new URL('dist/.openai/',root),{recursive:true});
for(const file of await readdir(new URL('dist/',root),{withFileTypes:true})){if(file.isFile())await cp(new URL(`dist/${file.name}`,root),new URL(`dist/client/${file.name}`,root))}
for(const dir of ['data','vendor'])await cp(new URL(`dist/${dir}`,root),new URL(`dist/client/${dir}`,root),{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('worker/index.js',root))],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:fileURLToPath(new URL('dist/server/index.js',root)),minify:true});
await cp(new URL('.openai/hosting.json',root),new URL('dist/.openai/hosting.json',root));
await writeFile(new URL('dist/server/wrangler.json',root),JSON.stringify({name:'atlas-notes',main:'index.js',compatibility_date:'2026-09-01',assets:{directory:'../client',binding:'ASSETS',run_worker_first:['/api/*']},d1_databases:[{binding:'DB',database_name:'atlas-notes',database_id:'local-preview-only'}]}));
console.log(`Worker built; ${ids.length} valid regions, ${Object.keys(catalog.countries).length} ADM1 datasets.`);
