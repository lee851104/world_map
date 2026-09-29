import {linearGeometry} from './geometry.js';
const names=new Intl.DisplayNames(['zh-Hant'],{type:'region'});
const japanNames='北海道,青森縣,岩手縣,宮城縣,秋田縣,山形縣,福島縣,茨城縣,栃木縣,群馬縣,埼玉縣,千葉縣,東京都,神奈川縣,新潟縣,富山縣,石川縣,福井縣,山梨縣,長野縣,岐阜縣,靜岡縣,愛知縣,三重縣,滋賀縣,京都府,大阪府,兵庫縣,奈良縣,和歌山縣,鳥取縣,島根縣,岡山縣,廣島縣,山口縣,德島縣,香川縣,愛媛縣,高知縣,福岡縣,佐賀縣,長崎縣,熊本縣,大分縣,宮崎縣,鹿兒島縣,沖繩縣'.split(',');
const aliases={'Taiwan':'TW','France':'FR','Norway':'NO','Somaliland':'X-SOMALILAND','Kosovo':'XK','N. Cyprus':'X-N-CYPRUS','Siachen Glacier':'X-SIACHEN','Indian Ocean Ter.':'IO','Ashmore and Cartier Is.':'X-ASHMORE','Coral Sea Is.':'X-CORAL','Baikonur':'X-BAIKONUR','Dhekelia':'X-DHEKELIA','Akrotiri':'X-AKROTIRI'};
export function normalizeRegions(collection,scope){
 // Retain the retired ID in the catalog for old backups, but never render or
 // export Taiwan through China's administrative dataset.
 return collection.features.filter(f=>!(scope==='adm1:CHN'&&f.properties.id==='43563684B32372453033755')).map(source=>{
 const feature={...source,geometry:linearGeometry(source.geometry)};
 const p=feature.properties;
  if(scope.startsWith('adm1:'))return {id:`adm1:${scope.slice(5)}-${p.id}`,name:p.nameZh||(scope==='adm1:JPN'?(japanNames[Number(p.iso?.slice(3))-1]||p.name):p.name),englishName:p.name,scope,feature};
  if(scope==='taiwan')return {id:`taiwan:${p.COUNTYCODE}`,name:p.COUNTYNAME.replaceAll('台','臺'),englishName:p.COUNTYENG,scope,feature};
  const englishName=p.name||p.ADMIN;
  const code=aliases[englishName]||p['ISO3166-1-Alpha-2']||p.ISO_A2;
  const stable=code&&code!=='-99'?code:`X-${englishName.toUpperCase().replace(/[^A-Z0-9]+/g,'-')}`;
  let name=englishName;
  if(/^[A-Z]{2}$/.test(stable))name=names.of(stable)||englishName;
  if(stable==='TW')name='台灣';
  if(stable==='CN')name='中國大陸';
  return {id:`world:${stable}`,name,englishName,scope,iso3:({FR:'FRA',NO:'NOR',XK:'XKX'})[stable]||p['ISO3166-1-Alpha-3'],feature};
 }).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
}
export async function loadRegions(scope){
 if(!['world','taiwan'].includes(scope)&&!/^adm1:[A-Z]{3}$/.test(scope))throw Error('未知地圖範圍。');
 const response=await fetch(scope.startsWith('adm1:')?`./data/adm1/${scope.slice(5)}.json`:`./data/${scope==='taiwan'?'taiwan':'world'}.json`);
 if(!response.ok)throw Error('地圖載入失敗，請重新整理。');
 return normalizeRegions(await response.json(),scope);
}
const normalized=s=>s.toLocaleLowerCase().replaceAll('台','臺').trim();
export function searchRegions(regions,query){const q=normalized(query);return regions.filter(r=>normalized(`${r.name} ${r.englishName} ${r.id}`).includes(q));}
