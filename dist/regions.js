const names=new Intl.DisplayNames(['zh-Hant'],{type:'region'});
const aliases={'Taiwan':'TW','France':'FR','Norway':'NO','Somaliland':'X-SOMALILAND','Kosovo':'XK','N. Cyprus':'X-N-CYPRUS','Siachen Glacier':'X-SIACHEN','Indian Ocean Ter.':'IO','Ashmore and Cartier Is.':'X-ASHMORE','Coral Sea Is.':'X-CORAL','Baikonur':'X-BAIKONUR','Dhekelia':'X-DHEKELIA','Akrotiri':'X-AKROTIRI'};
export function normalizeRegions(collection,scope){
 return collection.features.map(feature=>{
  const p=feature.properties;
  if(scope==='taiwan')return {id:`taiwan:${p.COUNTYCODE}`,name:p.COUNTYNAME.replaceAll('台','臺'),englishName:p.COUNTYENG,scope,feature};
  const englishName=p.name||p.ADMIN;
  const code=aliases[englishName]||p['ISO3166-1-Alpha-2']||p.ISO_A2;
  const stable=code&&code!=='-99'?code:`X-${englishName.toUpperCase().replace(/[^A-Z0-9]+/g,'-')}`;
  let name=englishName;
  if(/^[A-Z]{2}$/.test(stable))name=names.of(stable)||englishName;
  if(stable==='TW')name='台灣';
  return {id:`world:${stable}`,name,englishName,scope,feature};
 }).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
}
export async function loadRegions(scope){
 const response=await fetch(`./data/${scope==='taiwan'?'taiwan':'world'}.json`);
 if(!response.ok)throw Error('地圖載入失敗，請重新整理。');
 return normalizeRegions(await response.json(),scope);
}
const normalized=s=>s.toLocaleLowerCase().replaceAll('台','臺').trim();
export function searchRegions(regions,query){const q=normalized(query);return regions.filter(r=>normalized(`${r.name} ${r.englishName} ${r.id}`).includes(q));}
