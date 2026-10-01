// ZM Hybrid Store — AliExpress Importer bridge
function b64urlDecode(s){try{const t=s.replace(/-/g,'+').replace(/_/g,'/');return decodeURIComponent(escape(atob(t+'='.repeat((4-t.length%4)%4))))}catch{return null}}
function importPayloadFromHash(){const m=location.hash.match(/(?:^|[&#])import=([^&]+)/);if(!m)return null;const raw=b64urlDecode(m[1]);if(!raw)return null;try{return JSON.parse(raw)}catch{return null}}
function clearImportHash(){history.replaceState(null,'',location.pathname+location.search)}
function moneyInput(v){return Number.isFinite(Number(v))?Number(v).toFixed(2):''}
async function aliexpressImporter(prefill=null){
  let p=prefill||importPayloadFromHash();
  const defaults={title:p?.title||'',description:p?.description||'',image_urls:p?.image_urls||[],source_url:p?.source_url||'',supplier_sku:p?.supplier_sku||'',supplier_cost_usd:p?.supplier_cost_usd||'',target_market:'United Arab Emirates',markup:2.5,affiliate_commission:10,category:'',sku:p?.sku||'',stock:0};
  const cat=await api('categories?select=id,name&order=name.asc&limit=200').catch(()=>({data:[]}));
  const opts=(cat.data||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  const imgs=defaults.image_urls.map(x=>`<img src="${esc(x)}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #ddd">`).join('');
  $('#content').innerHTML=`<div class="box"><div class="page-head"><div><h2>AliExpress One-Click Importer</h2><p class="muted">Use the ZM Importer Chrome extension on an AliExpress product page, then this screen prepares a store product draft. Review price, commission and market before publishing.</p></div><a class="button" href="https://www.dsers.com/" target="_blank" rel="noopener">DSers</a></div>
  <div class="notice"><strong>Fast workflow:</strong> Install the included Chrome extension → open an AliExpress product → click the ZM Importer extension → this page → review → Create Product. Images, supplier URL and product details are carried over when available.</div><div class="notice" style="margin-top:10px"><strong>Extension:</strong> This ZIP includes <code>chrome-extension/</code>. Chrome → Extensions → Developer mode → Load unpacked → select that folder.</div>
  <div class="form-grid" style="margin-top:16px">
   <label class="wide">Product title<input id="aeTitle" value="${esc(defaults.title)}"></label>
   <label>Target market<select id="aeMarket"><option>United Arab Emirates</option><option>Saudi Arabia</option><option>United Kingdom</option><option>United States</option><option>European Union</option><option>Qatar</option><option>Kuwait</option><option>Pakistan</option></select></label>
   <label>Affiliate commission (%)<input id="aeCommission" type="number" min="0" max="100" step="0.01" value="${defaults.affiliate_commission}"></label>
   <label>Supplier cost (USD)<input id="aeCost" type="number" min="0" step="0.01" value="${moneyInput(defaults.supplier_cost_usd)}"></label>
   <label>Markup multiplier<input id="aeMarkup" type="number" min="1" step="0.1" value="${defaults.markup}"></label>
   <label>Stock quantity<input id="aeStock" type="number" min="0" step="1" value="${defaults.stock}"></label>
   <label>Category<select id="aeCategory"><option value="">No category</option>${opts}</select></label>
   <label>Supplier SKU<input id="aeSupplierSku" value="${esc(defaults.supplier_sku)}"></label>
   <label class="wide">AliExpress product URL<input id="aeUrl" value="${esc(defaults.source_url)}"></label>
   <label class="wide">Description<textarea id="aeDescription" rows="8">${esc(defaults.description)}</textarea></label>
  </div>
  <div class="form-section"><h3>Imported images (${defaults.image_urls.length})</h3><div style="display:flex;gap:10px;flex-wrap:wrap">${imgs||'<span class="muted">No images were detected.</span>'}</div></div>
  <div id="aeMsg" class="form-error" hidden></div>
  <div class="row-actions"><button class="primary" id="aeCreate">Create product draft</button><button id="aeClear">Clear</button></div></div>`;
  $('#aeMarket').value=defaults.target_market;
  if(defaults.category)$('#aeCategory').value=defaults.category;
  $('#aeClear').onclick=()=>{clearImportHash();aliexpressImporter(null)};
  $('#aeCreate').onclick=async()=>{
    const msg=$('#aeMsg');msg.hidden=true;const title=$('#aeTitle').value.trim();const costUsd=Number($('#aeCost').value||0);const markup=Math.max(1,Number($('#aeMarkup').value||2.5));const commission=Number($('#aeCommission').value);
    if(!title){msg.textContent='Product title is required.';msg.hidden=false;return} if(!Number.isFinite(commission)||commission<0||commission>100){msg.textContent='Affiliate commission must be between 0 and 100%.';msg.hidden=false;return}
    const costPkr=costUsd>0?Math.round(costUsd*280*100)/100:0;const regular=Math.round(costPkr*markup*100)/100;
    const slug=await uniqueProductSlug(title);
    const body={name:title,slug,description:$('#aeDescription').value.trim()||null,short_description:($('#aeDescription').value.trim()||'').slice(0,500)||null,regular_price:regular,sale_price:null,compare_at_price:null,cost_price:costPkr||null,stock:Number($('#aeStock').value||0),low_stock_threshold:5,weight_grams:null,status:'draft',featured:false,tags:['AliExpress','Dropshipping'],supplier_name:'AliExpress',supplier_url:$('#aeUrl').value.trim()||null,supplier_sku:$('#aeSupplierSku').value.trim()||null,supplier_cost:costPkr||null,supplier_shipping_cost:null,target_market:$('#aeMarket').value,fulfillment_method:'DSers / AliExpress',estimated_delivery:null,product_source:'AliExpress',product_status:'research',estimated_ad_cost:null,affiliate_commission_rate:commission,category_id:$('#aeCategory').value||null};
    try{ $('#aeCreate').disabled=true; const r=await api('products',{method:'POST',body,headers:{Prefer:'return=representation'}});const product=r.data?.[0];if(!product)throw new Error('Product was not created.');
      for(let i=0;i<defaults.image_urls.length;i++){const url=defaults.image_urls[i];if(!/^https?:\/\//i.test(url))continue;await api('product_images',{method:'POST',body:{product_id:product.id,image_url:url,storage_path:null,sort_order:i},headers:{Prefer:'return=minimal'}})}
      clearImportHash();msg.className='notice';msg.textContent='Imported successfully as a draft. Open Products to review and publish.';msg.hidden=false;setTimeout(()=>loadTab('products'),900);
    }catch(e){msg.className='form-error';msg.textContent='Import failed: '+e.message;msg.hidden=false;$('#aeCreate').disabled=false}
  };
}
