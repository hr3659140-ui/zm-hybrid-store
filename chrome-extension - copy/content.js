function pick(...sels){for(const s of sels){const e=document.querySelector(s);if(e?.content||e?.value||e?.textContent)return e.content||e.value||e.textContent.trim()}return ''}
function unique(arr){return [...new Set(arr.filter(x=>x&&/^https?:\/\//i.test(x)).map(x=>x.replace(/\\u002F/g,'/').replace(/^\/\//,'https://')))];}
function extract(){
 const ld=[...document.querySelectorAll('script[type="application/ld+json"]')].map(x=>{try{return JSON.parse(x.textContent)}catch{return null}}).flatMap(x=>Array.isArray(x)?x:[x]).filter(Boolean);
 const prod=ld.find(x=>x['@type']==='Product')||{}; const offers=Array.isArray(prod.offers)?prod.offers[0]:(prod.offers||{});
 const title=prod.name||pick('meta[property="og:title"]','h1')||document.title;
 const description=prod.description||pick('meta[name="description"]','meta[property="og:description"]');
 const price=offers.price||pick('meta[property="product:price:amount"]');
 let imgs=[]; if(Array.isArray(prod.image))imgs.push(...prod.image); else if(prod.image)imgs.push(prod.image); imgs.push(pick('meta[property="og:image"]')); document.querySelectorAll('img').forEach(i=>{const u=i.currentSrc||i.src||i.getAttribute('data-src'); if(u&&/alicdn|aliexpress/i.test(u))imgs.push(u)});
 const sku=prod.sku||prod.mpn||'';
 return {title:String(title||'').trim(),description:String(description||'').trim(),image_urls:unique(imgs).slice(0,12),supplier_sku:String(sku||''),supplier_cost_usd:String(price||'')};
}
chrome.runtime.onMessage.addListener((m,_,send)=>{if(m?.action==='extract')send(extract());return true});