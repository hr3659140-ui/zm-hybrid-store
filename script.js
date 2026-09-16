/* ============================================================
   ZM HYBRID STORE — app logic
   Hash-router SPA. Cart/wishlist held in memory for this session
   (no localStorage, so state resets on reload — swap in a real
   backend or storage layer to persist across visits).
   ============================================================ */

/* ---------- HTML escaping helper ---------- */
function esc(s){
  return String(s ?? "").replace(/[&<>"\']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "\'":"&#39;"
  }[c]));
}
// Expose explicitly for all storefront handlers and cached/nested page contexts.
window.esc = esc;

/* ============================================================
   STORE CONFIG — edit these 4 lines to go live
   ============================================================ */
const CONFIG = {
  // WhatsApp number in international format, digits only, no + or spaces
  WHATSAPP_NUMBER: "923073659140",
  // Paste your Google Apps Script Web App URL here (see setup guide) to log
  // every order into a Google Sheet automatically. Leave "" to skip.
  ORDER_SHEET_WEBHOOK: "",
  // Google Analytics 4 Measurement ID, e.g. "G-XXXXXXXXXX". Leave "" to skip.
  GA_MEASUREMENT_ID: "G-94TKM8BY1X",
  // Meta (Facebook/Instagram) Pixel ID. Leave "" to skip.
  META_PIXEL_ID: "",
  // Secure server-side checkout Edge Function. Deploy Phase 5 function before enabling.
  ORDER_FUNCTION_URL: "https://iqgoclijgicgzncrjqqt.supabase.co/functions/v1/create-order"
};

/* ---------- SUPABASE (dynamic catalog) ---------- */
const SUPABASE_CONFIG = {
  url: "https://iqgoclijgicgzncrjqqt.supabase.co",
  anonKey: "sb_publishable_pmKqaLISXQHNJD7GidkErw_etZeZ1KU"
};
let supabaseClient = null;
let appliedCoupon = null;
let STORE_CMS = { announcement_bar:"🔥 Sale Is Live! Up To 50% Off — 🚚 Fast Nationwide Delivery — COD Available", whatsapp_number:CONFIG.WHATSAPP_NUMBER, hero_eyebrow:"SALE IS LIVE — UP TO 50% OFF", hero_button_text:"Shop the sale", hero_title:"Beauty and home essentials, done right.", hero_description:"Curated beauty, home, kitchen, watches and electronics — selected for value and delivered across Pakistan.", footer_description:"Pakistan-wide online shopping for beauty, home, kitchen, watches and everyday essentials." };
let SEO_CONFIG = {title:"ZM Hybrid Store — Beauty, Home & Lifestyle Essentials",description:"Shop quality beauty, home & kitchen, watches, fragrance and electronics at ZM Hybrid Store. Cash on delivery available across Pakistan.",keywords:"ZM Hybrid Store, online shopping Pakistan, beauty, home kitchen, watches, fragrance, electronics",canonical:"https://zm-hybrid-store.pages.dev/",og_image:"https://zm-hybrid-store.pages.dev/og-image.svg",twitter_card:"summary_large_image",google_verification:"",bing_verification:"",org_description:"ZM Hybrid Store is a Pakistan-wide online store for curated beauty, home, lifestyle and everyday essentials."};
let HOME_BANNERS = [];
let HERO_CMS = [];
let SHIPPING_METHODS = [];
let SHIPPING_RULES = [];
let selectedShippingMethod = "standard";
let paymentReference = "";
const PAYMENT_SETTINGS = { bank_instructions:"Bank transfer details will be provided after order placement.", jazzcash_instructions:"JazzCash payment instructions will be provided after order placement.", easypaisa_instructions:"Easypaisa payment instructions will be provided after order placement." };
let shippingQuote = {cost:0,method:"Standard Delivery",code:"standard",description:""};

function couponSubtotal(){ return Number(cartTotal() || 0); }
function couponDiscountAmount(){
  if(!appliedCoupon) return 0;
  const sub=couponSubtotal();
  const minimum=Number(appliedCoupon.minimum_order||0);
  if(minimum > 0 && sub < minimum) return 0;
  if(appliedCoupon.discount_type === "percentage") return Math.round((sub * Math.min(Math.max(Number(appliedCoupon.discount_value||0),0),100) / 100) * 100) / 100;
  return Math.min(Math.max(Number(appliedCoupon.discount_value||0),0), sub);
}
function couponTotal(){ return Math.max(couponSubtotal() - couponDiscountAmount(), 0); }
function clearCoupon(){ appliedCoupon=null; }
if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}

async function loadStoreCMS(){
  if(!supabaseClient) return;
  try{
    const [{data:settings},{data:banners}]=await Promise.all([supabaseClient.from("site_settings").select("key,value"),supabaseClient.from("banners").select("id,title,subtitle,image_url,button_text,button_url,sort_order").eq("active",true).order("sort_order",{ascending:true})]);
    (settings||[]).forEach(x=>{ if(Object.prototype.hasOwnProperty.call(STORE_CMS,x.key)) STORE_CMS[x.key]=x.value; const sk=String(x.key||""); if(sk.startsWith("seo.")) SEO_CONFIG[sk.slice(4)] = typeof x.value === "string" ? x.value : (x.value?.value ?? x.value); if(sk==="hero_slides"){ try{ const hv=typeof x.value==="string"?JSON.parse(x.value):x.value; HERO_CMS=Array.isArray(hv)?hv:[]; }catch(_){ HERO_CMS=[]; } } });
    HOME_BANNERS=Array.isArray(banners)?banners:[];
    const hcfg=HERO_CMS.find(x=>x&&x.speed); if(hcfg) window.__heroSpeed=Number(hcfg.speed)||4800;
    const a=document.querySelector('.announce__track'); if(a){a.innerHTML=Array(2).fill(`<span>${esc(STORE_CMS.announcement_bar)}</span>`).join('');}
    const footer=document.querySelector('.footer-brand p'); if(footer) footer.textContent=STORE_CMS.footer_description;
    const wa=document.querySelector('#waFloat'); if(wa && STORE_CMS.whatsapp_number) wa.href=`https://wa.me/${String(STORE_CMS.whatsapp_number).replace(/\D/g,'')}?text=${encodeURIComponent("Hi! I have a question about a product on ZM Hybrid Store.")}`;
  }catch(e){console.warn('CMS unavailable; defaults retained.',e)}
}

async function loadShippingOptions(){
  if(!supabaseClient) return;
  try{
    const [{data:methods},{data:rules}]=await Promise.all([
      supabaseClient.from('shipping_methods').select('id,name,code,description,base_cost,free_threshold,active,sort_order').eq('active',true).order('sort_order',{ascending:true}),
      supabaseClient.from('shipping_rules').select('id,city,shipping_method_id,cost,free_threshold,active').eq('active',true)
    ]);
    SHIPPING_METHODS=methods||[]; SHIPPING_RULES=rules||[];
    if(!SHIPPING_METHODS.some(m=>m.code===selectedShippingMethod)) selectedShippingMethod=SHIPPING_METHODS[0]?.code||'standard';
  }catch(e){console.warn('Shipping options unavailable; free shipping fallback retained.',e);SHIPPING_METHODS=[];SHIPPING_RULES=[];}
}
function getShippingQuote(city){
  const method=SHIPPING_METHODS.find(m=>m.code===selectedShippingMethod)||SHIPPING_METHODS[0];
  if(!method) return {cost:0,method:'Free shipping',code:'standard',description:''};
  const rule=SHIPPING_RULES.find(r=>r.shipping_method_id===method.id && String(r.city||'').trim().toLowerCase()===String(city||'').trim().toLowerCase());
  const subtotal=couponSubtotal(); const threshold=rule?.free_threshold ?? method.free_threshold;
  const base=Number(rule?.cost ?? method.base_cost ?? 0); const cost=threshold!=null && subtotal>=Number(threshold) ? 0 : base;
  return {cost,method:method.name,code:method.code,description:method.description||'',threshold};
}
function refreshShippingQuote(){ const city=qs('#ckCity')?.value||''; shippingQuote=getShippingQuote(city); const el=qs('#checkoutShippingLine'); if(el) el.innerHTML=`<span>Shipping — ${esc(shippingQuote.method)}</span><strong>${shippingQuote.cost?rupees(shippingQuote.cost):'Free'}</strong>`; const total=qs('#checkoutTotal'); if(total) total.textContent=rupees(couponTotal()+shippingQuote.cost); }

async function loadProductsFromSupabase(){
  if(!supabaseClient) return;
  try{
    const { data, error } = await supabaseClient
      .from("products")
      .select("id,name,slug,description,short_description,regular_price,sale_price,stock,sku,featured,status,seo_title,seo_description,category:categories(name,slug),brand:brands(name,slug),product_images(id,image_url,sort_order),product_variants(id,name,sku,price,stock,active),target_market,product_source,product_status")
      .eq("status","active")
      .order("created_at", {ascending:false});
    if(error) throw error;
    if(Array.isArray(data)){
      PRODUCTS = data.map((p)=>{
        const images=(p.product_images||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
        const variants=(p.product_variants||[]).filter(v=>v.active!==false);
        const basePrice=Number(p.sale_price ?? p.regular_price ?? 0);
        const was=Number(p.regular_price ?? p.sale_price ?? 0);
        return {
          id:p.id, cat:p.category?.name || "Other", categorySlug:p.category?.slug || "", brand:p.brand?.name || "",
          title:p.name, slug:p.slug || slugify(p.name), desc:p.description || p.short_description || "",
          price:basePrice, was, stock:Number(p.stock ?? 0), sku:p.sku || "", featured:!!p.featured,
          rating:4.5, badge:was>basePrice ? `-${Math.round((1-basePrice/was)*100)}%` : "NEW", target_market:p.target_market||"", product_source:p.product_source||"", product_status:p.product_status||"research", seo_title:p.seo_title||"", seo_description:p.seo_description||"",
          image:images[0]?.image_url || null, images:images.map(x=>x.image_url).filter(Boolean), variants, bullets:[]
        };
      });
    }
  }catch(err){ console.warn("Supabase catalog unavailable; retaining built-in catalog.", err); }
}

/* ---------- ICONS (one simple line-icon per category) ---------- */
const ICONS = {
  "Health & Beauty": `<svg viewBox="0 0 64 64" fill="none" stroke="#FF6A00" stroke-width="2"><rect x="24" y="10" width="16" height="10" rx="2"/><path d="M20 20h24l-2 30a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4L20 20z"/><path d="M26 30h12M26 38h12"/></svg>`,
  "Home & Kitchen": `<svg viewBox="0 0 64 64" fill="none" stroke="#FF6A00" stroke-width="2"><path d="M14 30l18-14 18 14"/><path d="M18 28v20h28V28"/><path d="M27 48v-12h10v12"/></svg>`,
  "Watches": `<svg viewBox="0 0 64 64" fill="none" stroke="#FF6A00" stroke-width="2"><circle cx="32" cy="32" r="15"/><path d="M32 24v8l6 4"/><path d="M26 8h12l-2 9H28l-2-9zM26 56h12l-2-9H28l-2 9z"/></svg>`,
  "Fragrance": `<svg viewBox="0 0 64 64" fill="none" stroke="#FF6A00" stroke-width="2"><rect x="20" y="22" width="24" height="30" rx="3"/><path d="M27 22v-6a5 5 0 0 1 10 0v6"/><path d="M20 32h24"/></svg>`,
  "Electronics": `<svg viewBox="0 0 64 64" fill="none" stroke="#FF6A00" stroke-width="2"><rect x="12" y="16" width="40" height="26" rx="3"/><path d="M24 50h16M32 42v8"/><circle cx="32" cy="29" r="6"/></svg>`
};
const MEDIA_CLASS = {
  "Health & Beauty":"media--beauty", "Home & Kitchen":"media--home",
  "Watches":"media--watch", "Fragrance":"media--fragrance", "Electronics":"media--electronics"
};

/* ---------- PRODUCT CATALOG (placeholder data — swap in real SKUs) ---------- */
let PRODUCTS = [
  { id:1, cat:"Health & Beauty", title:"Ultra Vital Glutathione Capsules 30s", price:6900, was:9400, rating:4.6, badge:"-27%", image:"https://images.unsplash.com/photo-1556228720-195a672e8a03?w=700&h=700&fit=crop&q=80",
    desc:"A daily brightening and antioxidant capsule formulated to support even-toned, radiant skin from within.",
    bullets:["30 capsules per bottle, one-a-day dose","Combined with Vitamin C for absorption","Dermatologically tested, non-drowsy"] },
  { id:2, cat:"Health & Beauty", title:"Overnight Acne Spot Gel 20g", price:2450, was:3200, rating:4.4, badge:"-23%", image:"https://images.unsplash.com/photo-1556228720-195a672e8a03?w=700&h=700&fit=crop&q=80",
    desc:"A targeted spot treatment that works while you sleep to calm redness and clear blemishes by morning.",
    bullets:["Salicylic acid + tea tree formula","Fragrance-free, suitable for sensitive skin","Visible results in 3–5 nights"] },
  { id:3, cat:"Health & Beauty", title:"Daily Repair Moisturizing Cream 89ml", price:5950, was:7999, rating:4.8, badge:"-25%", image:"https://images.unsplash.com/photo-1556228720-195a672e8a03?w=700&h=700&fit=crop&q=80",
    desc:"A lightweight ceramide-rich moisturizer that restores the skin barrier and locks in hydration for 24 hours.",
    bullets:["With 3 essential ceramides","Fragrance-free, non-comedogenic","Dermatologist developed"] },
  { id:4, cat:"Health & Beauty", title:"Toleriane Double Repair Face Moisturizer 25ml", price:4650, was:5900, rating:4.7, badge:"-21%", image:"https://images.unsplash.com/photo-1556228720-195a672e8a03?w=700&h=700&fit=crop&q=80",
    desc:"A gentle, fast-absorbing moisturizer for sensitive skin, formulated with thermal spring water and niacinamide.",
    bullets:["24h hydration, non-greasy finish","Suitable for sensitive & reactive skin","Fragrance-free"] },
  { id:5, cat:"Home & Kitchen", title:"5-Layer Stainless Steel Cookware Set", price:18900, was:24500, rating:4.5, badge:"-23%", image:"https://images.unsplash.com/photo-1585515320310-259814833e62?w=700&h=700&fit=crop&q=80",
    desc:"A complete cookware set with even heat distribution, designed for everyday stovetop cooking.",
    bullets:["7 pieces incl. lids","Induction compatible","Dishwasher safe"] },
  { id:6, cat:"Home & Kitchen", title:"Digital Air Fryer 5.5L", price:14200, was:17800, rating:4.6, badge:"-20%", image:"https://images.unsplash.com/photo-1585515320310-259814833e62?w=700&h=700&fit=crop&q=80",
    desc:"Crisp, golden results with up to 85% less oil. Eight preset digital cooking programs.",
    bullets:["5.5 litre non-stick basket","8 preset programs","Auto shut-off timer"] },
  { id:7, cat:"Home & Kitchen", title:"Ceramic Non-Stick Pan, 28cm", price:4300, was:5600, rating:4.3, badge:"-23%", image:"https://images.unsplash.com/photo-1585515320310-259814833e62?w=700&h=700&fit=crop&q=80",
    desc:"A PFOA-free ceramic pan that heats evenly and releases food effortlessly.",
    bullets:["Ceramic non-stick coating","Compatible with all stovetops","Soft-touch heat-resistant handle"] },
  { id:8, cat:"Home & Kitchen", title:"Cordless Handheld Vacuum Cleaner", price:9800, was:12900, rating:4.4, badge:"-24%", image:"https://images.unsplash.com/photo-1585515320310-259814833e62?w=700&h=700&fit=crop&q=80",
    desc:"Lightweight cordless vacuum with strong suction for quick clean-ups around the home and car.",
    bullets:["Up to 30 min runtime","Washable HEPA filter","Includes 3 attachments"] },
  { id:9, cat:"Watches", title:"Chrono Classic Steel Watch — Men", price:8900, was:12500, rating:4.7, badge:"-29%", image:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=700&h=700&fit=crop&q=80",
    desc:"A stainless steel chronograph with sapphire-coated crystal and 5 ATM water resistance.",
    bullets:["Quartz chronograph movement","5 ATM water resistant","Stainless steel strap"] },
  { id:10, cat:"Watches", title:"Minimalist Leather Strap Watch — Women", price:6400, was:8200, rating:4.5, badge:"-22%", image:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=700&h=700&fit=crop&q=80",
    desc:"A slim-profile watch with a genuine leather strap, designed for everyday minimal wear.",
    bullets:["Slim 8mm case","Genuine leather strap","3 ATM water resistant"] },
  { id:11, cat:"Fragrance", title:"Aura Intense EDP for Men, 100ml", price:6599, was:7999, rating:4.8, badge:"-18%", image:"https://images.unsplash.com/photo-1541643600914-78b084683601?w=700&h=700&fit=crop&q=80",
    desc:"A bold, woody-amber fragrance built around cedar, tonka bean and a hint of black pepper.",
    bullets:["100ml Eau de Parfum","8–10 hour longevity","Woody amber fragrance family"] },
  { id:12, cat:"Fragrance", title:"Pacific Bloom EDP for Women, 90ml", price:5800, was:7400, rating:4.6, badge:"-22%", image:"https://images.unsplash.com/photo-1541643600914-78b084683601?w=700&h=700&fit=crop&q=80",
    desc:"A fresh floral-fruity scent with notes of white peach, jasmine and soft musk.",
    bullets:["90ml Eau de Parfum","Floral-fruity fragrance family","Long-lasting sillage"] },
  { id:13, cat:"Electronics", title:"Pressure Tech Bluetooth Earbuds", price:4990, was:6500, rating:4.4, badge:"-24%", image:"https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=700&h=700&fit=crop&q=80",
    desc:"Crystal-clear stereo sound with a wide soundfield, waterproof housing and a digital charging case display.",
    bullets:["Waterproof, sweat-resistant","LED battery display on case","Automatic fast pairing"] },
  { id:14, cat:"Electronics", title:"10000mAh Fast-Charge Power Bank", price:3450, was:4300, rating:4.5, badge:"-20%", image:"https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=700&h=700&fit=crop&q=80",
    desc:"Compact power bank with dual-port fast charging, enough for 2+ full phone charges.",
    bullets:["10000mAh capacity","Dual USB output","LED charge indicator"] },
  { id:15, cat:"Health & Beauty", title:"Vitamin C Brightening Serum 30ml", price:3900, was:5200, rating:4.6, badge:"-25%", image:"https://images.unsplash.com/photo-1556228720-195a672e8a03?w=700&h=700&fit=crop&q=80",
    desc:"A 15% Vitamin C serum that targets dullness and uneven tone for a brighter complexion over time.",
    bullets:["15% stabilized Vitamin C","Lightweight, fast-absorbing","Use AM under sunscreen"] },
  { id:16, cat:"Home & Kitchen", title:"Electric Kettle, 1.7L Stainless Steel", price:3800, was:4900, rating:4.5, badge:"-22%", image:"https://images.unsplash.com/photo-1585515320310-259814833e62?w=700&h=700&fit=crop&q=80",
    desc:"A fast-boil stainless steel kettle with auto shut-off and boil-dry protection.",
    bullets:["1.7 litre capacity","Auto shut-off + boil-dry protection","360° cordless base"] },
];

/* ---------- STATE (persisted in localStorage so cart/wishlist survive reloads) ---------- */
function loadState(){
  try{
    const savedCart = JSON.parse(localStorage.getItem("zm_cart") || "[]");
    const savedWish = JSON.parse(localStorage.getItem("zm_wishlist") || "[]");
    return { cart: Array.isArray(savedCart) ? savedCart : [], wishlist: new Set(savedWish) };
  }catch(e){ return { cart: [], wishlist: new Set() }; }
}
function saveState(){
  try{
    localStorage.setItem("zm_cart", JSON.stringify(state.cart));
    localStorage.setItem("zm_wishlist", JSON.stringify(Array.from(state.wishlist)));
  }catch(e){ /* storage unavailable, fail silently */ }
}
const state = loadState();

/* ---------- MARKET & CURRENCY ---------- */
const MARKET_CONFIG = {
  PK: {country:"Pakistan", currency:"PKR", prefix:"Rs. ", rate:1, locale:"en-PK", decimals:0},
  AE: {country:"United Arab Emirates", currency:"AED", prefix:"AED ", rate:0.0130, locale:"en-AE", decimals:2},
  SA: {country:"Saudi Arabia", currency:"SAR", prefix:"SAR ", rate:0.0134, locale:"en-SA", decimals:2},
  GB: {country:"United Kingdom", currency:"GBP", prefix:"£", rate:0.00278, locale:"en-GB", decimals:2},
  US: {country:"United States", currency:"USD", prefix:"$", rate:0.00358, locale:"en-US", decimals:2},
  EU: {country:"European Union", currency:"EUR", prefix:"€", rate:0.00305, locale:"en-EU", decimals:2},
  QA: {country:"Qatar", currency:"QAR", prefix:"QAR ", rate:0.0130, locale:"en-QA", decimals:2},
  KW: {country:"Kuwait", currency:"KWD", prefix:"KWD ", rate:0.00110, locale:"en-KW", decimals:3}
};
let activeMarketKey = "PK";
try { activeMarketKey = localStorage.getItem("zm_market") || "PK"; } catch(_) {}
if(!MARKET_CONFIG[activeMarketKey]) activeMarketKey="PK";
const activeMarket = () => MARKET_CONFIG[activeMarketKey] || MARKET_CONFIG.PK;
const marketMoney = (n, market=activeMarket()) => {
  const value=Number(n||0)*Number(market.rate||1);
  if(market.currency==="PKR") return market.prefix+Math.round(value).toLocaleString("en-PK");
  return market.prefix+value.toLocaleString(market.locale,{minimumFractionDigits:market.decimals,maximumFractionDigits:market.decimals});
};
const rupees = n => marketMoney(n);
function setMarket(key){
  if(!MARKET_CONFIG[key]) return;
  activeMarketKey=key;
  try{localStorage.setItem("zm_market",key)}catch(_){ }
  const label=document.querySelector("#marketCurrencyLabel"); if(label) label.textContent=MARKET_CONFIG[key].currency;
  try{renderCartBadges();renderCartDrawer();render();}catch(_){ }
}
function marketOptions(){return Object.entries(MARKET_CONFIG).map(([key,m])=>`<option value="${key}" ${key===activeMarketKey?"selected":""}>${esc(m.country)} — ${esc(m.currency)}</option>`).join("");}
const findProduct = id => PRODUCTS.find(p => String(p.id) === String(id));
const qs = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function mediaBlock(cat, extraClass="", imageUrl="") {
  if(imageUrl) return `<div class="${extraClass}" style="width:100%;height:100%;overflow:hidden;background:#f7f3ef;display:flex;align-items:center;justify-content:center;"><img src="${String(imageUrl).replace(/"/g,'&quot;')}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;"></div>`;
  return `<div class="${extraClass} ${MEDIA_CLASS[cat]||""}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${ICONS[cat]||""}</div>`;
}

function toast(msg){
  const t = qs("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=>t.classList.remove("show"), 2200);
}

function stars(rating){
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5-full);
}

/* ---------- CART / WISHLIST LOGIC ---------- */
function getVariant(product, variantId){ return (product?.variants||[]).find(v=>String(v.id)===String(variantId)) || null; }
function cartUnitPrice(item){ const p=findProduct(item.id); const v=getVariant(p,item.variantId); return Number(v?.price ?? p?.price ?? 0); }
function cartAvailable(item){ const p=findProduct(item.id); const v=getVariant(p,item.variantId); return Number(v?.stock ?? p?.stock ?? 0); }
function addToCart(id, qty=1, variantId=null){
  const product=findProduct(id);
  if(!product){ toast("Product unavailable"); return; }
  const variant=getVariant(product,variantId);
  if(variantId && !variant){ toast("Selected option is unavailable"); return; }
  const available=Number(variant?.stock ?? product.stock ?? 0);
  if(available<=0){ toast("This item is out of stock"); return; }
  const existing=state.cart.find(i=>String(i.id)===String(id) && String(i.variantId||"")===String(variantId||""));
  const nextQty=(existing?.qty||0)+qty;
  if(nextQty>available){ toast(`Only ${available} item(s) available`); return; }
  if(existing) existing.qty=nextQty;
  else state.cart.push({id, qty, variantId:variantId||null});
  saveState(); renderCartBadges(); renderCartDrawer(); toast("Added to cart");
  trackAddToCart(product, variant, qty);
}
function removeFromCart(id, variantId=null){
  state.cart=state.cart.filter(i=>!(String(i.id)===String(id)&&String(i.variantId||"")===String(variantId||"")));
  saveState(); renderCartBadges(); renderCartDrawer();
  if(location.pathname.replace(/\/+$/,'')==='/cart') render();
}
function setQty(id, qty, variantId=null){
  const item=state.cart.find(i=>String(i.id)===String(id)&&String(i.variantId||"")===String(variantId||"")); if(!item) return;
  const available=cartAvailable(item);
  if(qty>available){ toast(`Only ${available} item(s) available`); return; }
  if(qty<=0) return removeFromCart(id,variantId);
  item.qty=qty; saveState(); renderCartBadges(); renderCartDrawer();
  if(location.pathname.replace(/\/+$/,'')==='/cart') render();
}
function cartTotal(){ return state.cart.reduce((sum,i)=>sum+cartUnitPrice(i)*i.qty,0); }
function cartCount(){ return state.cart.reduce((sum,i)=>sum+i.qty,0); }
function toggleWishlist(id){
  id = String(id);
  if(state.wishlist.has(id)) state.wishlist.delete(id);
  else state.wishlist.add(id);
  saveState();
  renderCartBadges();
  toast(state.wishlist.has(id) ? "Added to wishlist" : "Removed from wishlist");
}

function renderCartBadges(){
  qs("#cartCount").textContent = cartCount();
  qs("#wishCount").textContent = state.wishlist.size;
}

function renderCartDrawer(){
  const wrap = qs("#cartItems");
  if(state.cart.length === 0){
    wrap.innerHTML = `<div class="empty-cart">Your cart is empty.<br>Browse the catalog to add something you like.</div>`;
  } else {
    wrap.innerHTML = state.cart.map(i => {
      const p = findProduct(i.id);
      return `
      <div class="mini-row">
        <div class="mini-row__media">${mediaBlock(p.cat, "", p.image)}</div>
        <div>
          <div class="mini-row__title">${esc(p.title)}${getVariant(p,i.variantId)?`<small> · ${esc(getVariant(p,i.variantId).name)}</small>`:''}</div>
          <div class="mini-row__ctrl">
            <button data-qty-down="${p.id}" data-variant="${i.variantId||''}">−</button>
            <span>${i.qty}</span>
            <button data-qty-up="${p.id}" data-variant="${i.variantId||''}">+</button>
          </div>
        </div>
        <div>
          <div class="mini-row__price">${rupees(p.price * i.qty)}</div>
          <button class="cart-row__remove" data-remove="${p.id}" data-remove-variant="${i.variantId||''}">Remove</button>
        </div>
      </div>`;
    }).join("");
  }
  qs("#cartSubtotal").textContent = rupees(cartTotal());

  wrap.onclick = e => {
    const up = e.target.closest("[data-qty-up]");
    const down = e.target.closest("[data-qty-down]");
    const rm = e.target.closest("[data-remove]");
    if(up){ const item = state.cart.find(i=>String(i.id)===String(up.dataset.qtyUp)&&String(i.variantId||"")===String(up.dataset.variant||"")); if(item) setQty(item.id,item.qty+1,item.variantId); }
    if(down){ const item = state.cart.find(i=>String(i.id)===String(down.dataset.qtyDown)&&String(i.variantId||"")===String(down.dataset.variant||"")); if(item) setQty(item.id,item.qty-1,item.variantId); }
    if(rm){ removeFromCart(rm.dataset.remove,rm.dataset.removeVariant||null); }
  };
}


/* ---------- CLEAN SEO URL HELPERS ---------- */
const slugify = text => String(text).toLowerCase().trim().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const productPath = p => `/product/${slugify(p.title)}/`;
const categoryPath = c => `/category/${slugify(c)}/`;
const policyPath = k => `/policy/${k}/`;
const productBySlug = slug => PRODUCTS.find(p => slugify(p.title) === slug);
const categoryBySlug = slug => ["Health & Beauty","Home & Kitchen","Watches","Fragrance","Electronics"].find(c => slugify(c) === slug);

function upsertMeta(name, attr, value){
  let el=document.head.querySelector(`meta[${attr}="${name}"]`);
  if(!el){el=document.createElement('meta');el.setAttribute(attr,name);document.head.appendChild(el);}
  el.setAttribute('content',String(value||''));
}
function setMeta({title, description, canonical, type="website", image="", robots="index, follow"}={}){
  const finalTitle=title||SEO_CONFIG.title;
  const finalDesc=description||SEO_CONFIG.description;
  const finalCanonical=canonical||SEO_CONFIG.canonical||location.origin+location.pathname;
  const finalImage=image||SEO_CONFIG.og_image||location.origin+'/og-image.svg';
  document.title=finalTitle;
  upsertMeta('description','name',finalDesc);
  upsertMeta('keywords','name',SEO_CONFIG.keywords||'');
  upsertMeta('og:title','property',finalTitle);
  upsertMeta('og:description','property',finalDesc);
  upsertMeta('og:type','property',type);
  upsertMeta('og:url','property',finalCanonical);
  upsertMeta('og:site_name','property','ZM Hybrid Store');
  upsertMeta('og:image','property',finalImage);
  upsertMeta('twitter:card','name',SEO_CONFIG.twitter_card||'summary_large_image');
  upsertMeta('twitter:title','name',finalTitle);
  upsertMeta('twitter:description','name',finalDesc);
  upsertMeta('twitter:image','name',finalImage);
  let can=document.head.querySelector('link[rel="canonical"]');
  if(!can){can=document.createElement('link');can.rel='canonical';document.head.appendChild(can);}
  can.href=finalCanonical;
  const robotsMeta=document.head.querySelector('meta[name="robots"]');
  if(robotsMeta) robotsMeta.content=robots;
  if(SEO_CONFIG.google_verification) upsertMeta('google-site-verification','name',SEO_CONFIG.google_verification);
  if(SEO_CONFIG.bing_verification) upsertMeta('msvalidate.01','name',SEO_CONFIG.bing_verification);
}
function setOrganizationSchema(){
  const old=document.getElementById('orgSchema');if(old)old.remove();
  const schema=document.createElement('script');schema.type='application/ld+json';schema.id='orgSchema';
  schema.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Organization","name":"ZM Hybrid Store","url":location.origin+"/","logo":location.origin+"/favicon.svg","description":SEO_CONFIG.org_description||SEO_CONFIG.description});
  document.head.appendChild(schema);
}
function setWebsiteSchema(){
  const old=document.getElementById('websiteSchema');if(old)old.remove();
  const schema=document.createElement('script');schema.type='application/ld+json';schema.id='websiteSchema';
  schema.textContent=JSON.stringify({"@context":"https://schema.org","@type":"WebSite","name":"ZM Hybrid Store","url":location.origin+"/","potentialAction":{"@type":"SearchAction","target":location.origin+"/catalog/?q={search_term_string}","query-input":"required name=search_term_string"}});
  document.head.appendChild(schema);
}
function setProductSchema(p){
  const old=document.getElementById('productSchema');if(old)old.remove();
  const schema=document.createElement('script');schema.type='application/ld+json';schema.id='productSchema';
  const available=Number((p.variants||[]).reduce((n,v)=>n+Math.max(0,Number(v.stock||0)),0) || p.stock || 0)>0;
  schema.textContent=JSON.stringify({
    "@context":"https://schema.org","@type":"Product","name":p.title,"description":p.seo_description||p.desc||"",
    "image":(p.images&&p.images.length?p.images:[p.image]).filter(Boolean),
    "category":p.cat,"sku":p.sku||String(p.id),
    "brand":p.brand?{"@type":"Brand","name":p.brand}:undefined,
    "offers":{"@type":"Offer","priceCurrency":activeMarket().currency,"price":Number(p.price||0)*activeMarket().rate,"availability":available?"https://schema.org/InStock":"https://schema.org/OutOfStock","url":location.origin+productPath(p)}
  });
  document.head.appendChild(schema);
}
function clearProductSchema(){ const old=document.getElementById('productSchema'); if(old) old.remove(); }


/* ---------- ROUTER ---------- */
function parseRoute(){
  const clean = location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(location.search || "");
  if(clean === "/" || clean === "/home") return {route:"home", params};
  if(clean === "/catalog") return {route:"catalog", params};
  if(clean.startsWith("/category/")){ const slug=clean.split("/")[2]||""; const cat=categoryBySlug(slug); if(cat) params.set("cat",cat); return {route:"catalog",params,category:cat}; }
  if(clean.startsWith("/product/")){ const slug=clean.split("/")[2]||""; return {route:"product",product:productBySlug(slug)}; }
  if(clean === "/product") { const p=findProduct(params.get("id")); return {route:"product",product:p}; }
  if(clean === "/cart") return {route:"cart",params};
  if(clean === "/checkout") return {route:"checkout",params};
  if(clean === "/wishlist") return {route:"wishlist",params};
  if(clean === "/account") return {route:"account",params};
  if(clean === "/track-order") return {route:"track",params};
  if(clean.startsWith("/order/")) return {route:"order",orderNumber:decodeURIComponent(clean.split("/")[2]||""),params};
  if(clean === "/contact") return {route:"contact",params};
  if(clean === "/affiliate") return {route:"affiliate",params};
  if(clean.startsWith("/policy/")) return {route:"policy",key:clean.split("/")[2]||"",params};
  return {route:"404",params};
}
function render(){
  const r=parseRoute(), app=qs("#app");
  window.scrollTo(0,0); closeCartDrawer(); closeSearch();
  qsa(".main-nav a").forEach(a=>a.classList.remove("active"));
  clearProductSchema();
  setOrganizationSchema(); setWebsiteSchema();
  if(r.route==="home"){ app.innerHTML=viewHome(); wireHome(); wireHeroCarousel(); markNav("/"); setMeta({title:"ZM Hybrid Store — Beauty, Home & Lifestyle Essentials",description:"Shop skincare, home & kitchen upgrades, watches, fragrance and electronics at ZM Hybrid Store. Cash on delivery available across Pakistan."}); }
  else if(r.route==="catalog"){ app.innerHTML=viewCatalog(r.params); wireCatalog(r.params); setMeta({title:(r.category||r.params.get("cat")||"All Products")+" — ZM Hybrid Store",description:`Shop ${r.category||r.params.get("cat")||"quality products"} at ZM Hybrid Store. Browse products, prices and delivery options.`}); }
  else if(r.route==="product"){ const p=r.product; app.innerHTML=viewProduct(p?.id); wireProduct(p?.id); if(p){setMeta({title:(p.seo_title||`${p.title} — ZM Hybrid Store`),description:(p.seo_description||p.desc),canonical:location.origin+productPath(p),type:"product",image:p.image||""});setProductSchema(p);} }
  else if(r.route==="cart"){ app.innerHTML=viewCartPage(); wireCartPage(); setMeta({title:"Your Cart — ZM Hybrid Store",description:"Review your ZM Hybrid Store cart before checkout.",robots:"noindex, follow"}); }
  else if(r.route==="checkout"){ app.innerHTML=viewCheckout(); wireCheckout(); setMeta({title:"Checkout — ZM Hybrid Store",description:"Securely submit your shipping details and choose your payment method.",robots:"noindex, follow"}); }
  else if(r.route==="wishlist"){ app.innerHTML=viewWishlist(); wireWishlist(); setMeta({title:"Wishlist — ZM Hybrid Store",description:"Your saved products at ZM Hybrid Store.",robots:"noindex, follow"}); }
  else if(r.route==="account"){ app.innerHTML=viewAccount(); wireAccount(); setMeta({title:"My Account — ZM Hybrid Store",description:"Sign in, view your orders and manage your ZM Hybrid Store account."}); }
  else if(r.route==="track"){ app.innerHTML=viewTrackOrder(); wireTrackOrder(); setMeta({title:"Track Order — ZM Hybrid Store",description:"Securely track your ZM Hybrid Store order using your order number and phone."}); }
  else if(r.route==="order"){ app.innerHTML=viewOrderDetail(r.orderNumber); wireOrderDetail(r.orderNumber); setMeta({title:`Order ${r.orderNumber} — ZM Hybrid Store`,description:"View your ZM Hybrid Store order status, items and payment details."}); }
  else if(r.route==="contact"){ app.innerHTML=viewContact(); wireContact(); markNav("/contact"); setMeta({title:"Contact — ZM Hybrid Store",description:"Contact ZM Hybrid Store about products, orders, shipping and returns."}); }
  else if(r.route==="policy"){ app.innerHTML=viewPolicy(r.key); setMeta({title:(POLICY[r.key]?.title||"Policy")+" — ZM Hybrid Store",description:"ZM Hybrid Store customer policy and service information."}); }
  else { app.innerHTML=`<div class="container section"><h2>Page not found</h2><a href="/catalog/" data-link class="btn btn--dark">Back to catalog</a></div>`; setMeta({title:"Page Not Found — ZM Hybrid Store",description:"The requested page could not be found."}); }
}
function markNav(href){ const link=qsa(".main-nav a").find(a=>a.getAttribute("href")===href); if(link) link.classList.add("active"); }
window.addEventListener("popstate", render);
/* ---------- VIEW: HOME ---------- */
/* ---------- HERO PRODUCT CUTOUT ---------- */
function autoCutoutHeroImage(img){
  if(!img || img.dataset.cutoutDone==='1' || img.dataset.cutoutBusy==='1') return;
  img.dataset.cutoutBusy='1';
  const run=()=>{
    try{
      const w=img.naturalWidth,h=img.naturalHeight;
      if(!w||!h) return;
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(img,0,0,w,h);
      const d=ctx.getImageData(0,0,w,h), a=d.data;
      const seen=new Uint8Array(w*h), qx=new Int32Array(w*h), qy=new Int32Array(w*h);
      let head=0,tail=0;
      const idx=(x,y)=>(y*w+x), push=(x,y)=>{const k=idx(x,y); if(!seen[k]){seen[k]=1;qx[tail]=x;qy[tail]=y;tail++;}};
      for(let x=0;x<w;x++){push(x,0);push(x,h-1)}
      for(let y=0;y<h;y++){push(0,y);push(w-1,y)}
      const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
      const sample=(x,y)=>{const k=(y*w+x)*4;return [a[k],a[k+1],a[k+2]]};
      const seeds=[]; [[0,0],[w-1,0],[0,h-1],[w-1,h-1]].forEach(([x,y])=>seeds.push(sample(x,y)));
      const nearSeed=(r,g,b)=>seeds.some(s=>Math.hypot(r-s[0],g-s[1],b-s[2])<72);
      const lightBg=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx>224 && (mx-mn)<34;};
      while(head<tail){
        const x=qx[head],y=qy[head++], k=(y*w+x)*4;
        const r=a[k],g=a[k+1],b=a[k+2];
        if(!(nearSeed(r,g,b)||lightBg(r,g,b))) continue;
        a[k+3]=0;
        for(const [dx,dy] of dirs){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h){const nk=idx(nx,ny);if(!seen[nk])push(nx,ny)}}
      }
      // Remove remaining near-white poster/background pixels while preserving colored/dark product details.
      for(let i=0;i<a.length;i+=4){
        const r=a[i],g=a[i+1],b=a[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);
        if(mx>242 && (mx-mn)<22) a[i+3]=0;
      }
      // Poster guard: remove small disconnected text/logo fragments and keep the dominant
      // central product silhouette. This is intentionally conservative so product details survive.
      const rw=Math.max(1,Math.min(360,w)), rh=Math.max(1,Math.min(360,h));
      if(rw!==w || rh!==h){
        const small=document.createElement('canvas'); small.width=rw; small.height=rh;
        const sctx=small.getContext('2d',{willReadFrequently:true});
        sctx.drawImage(c,0,0,rw,rh);
        const sd=sctx.getImageData(0,0,rw,rh), sa=sd.data, n=rw*rh;
        const vis=new Uint8Array(n), comps=[];
        const q=new Int32Array(n);
        for(let yy=0;yy<rh;yy++) for(let xx=0;xx<rw;xx++){
          const ii=(yy*rw+xx), ai=ii*4;
          if(vis[ii] || sa[ai+3]<24) continue;
          let qh=0,qt=0,area=0,sx=0,sy=0; q[qt++]=ii; vis[ii]=1;
          while(qh<qt){
            const ci=q[qh++], cx=ci%rw, cy=(ci/rw)|0; area++; sx+=cx; sy+=cy;
            const ns=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
            for(const [nx,ny] of ns){ if(nx<0||nx>=rw||ny<0||ny>=rh) continue; const ni=ny*rw+nx; if(vis[ni]) continue; if(sa[ni*4+3]<24) continue; vis[ni]=1; q[qt++]=ni; }
          }
          comps.push({area,cx:sx/area,cy:sy/area});
        }
        comps.sort((A,B)=>B.area-A.area);
        const centerX=rw/2,centerY=rh/2;
        const keep=comps.slice(0,Math.min(6,comps.length)).filter((o,i)=>{
          const dist=Math.hypot(o.cx-centerX,o.cy-centerY);
          return i===0 || dist<Math.max(rw,rh)*0.34 || o.area>n*0.012;
        });
        const keepSet=keep.map(o=>o);
        // Re-run components and discard tiny fragments outside the central product zone.
        // Components smaller than 1.2% of the image are treated as poster text/logos.
        for(let yy=0;yy<rh;yy++) for(let xx=0;xx<rw;xx++){
          const ii=yy*rw+xx, ai=ii*4; if(sa[ai+3]<24) continue;
          const nearCentral=Math.hypot(xx-centerX,yy-centerY)<Math.max(rw,rh)*0.48;
          if(!nearCentral && sa[ai+3]>24) sa[ai+3]=0;
        }
        sctx.putImageData(sd,0,0);
        c.width=rw; c.height=rh;
        ctx.clearRect(0,0,rw,rh); ctx.drawImage(small,0,0);
      }
      ctx.putImageData(ctx.getImageData(0,0,c.width,c.height),0,0);
      img.src=c.toDataURL('image/png');
      img.dataset.cutoutDone='1';
    }catch(e){ console.warn('Hero cutout skipped:',e); }
    finally{ img.dataset.cutoutBusy='0'; }
  };
  if(img.complete && img.naturalWidth) run(); else img.addEventListener('load',run,{once:true});
}
function prepareHeroCutouts(root){ qsa('.hero-product-image[data-cutout="1"]',root||document).forEach(autoCutoutHeroImage); }

function wireHeroCarousel(){
  const root=qs('#heroCarousel'); if(!root) return;
  const slides=qsa('.hero-slide',root); if(!slides.length) return;
  let active=0,timer=null;
  const show=n=>{active=(n+slides.length)%slides.length;slides.forEach((x,i)=>x.classList.toggle('is-active',i===active));root.dataset.theme=String(active%4);qsa('.hero-dot',root).forEach((x,i)=>x.classList.toggle('is-active',i===active));};
  const intervalMs=Math.max(2600,Number(window.__heroSpeed||4800));
  const start=()=>{clearInterval(timer);timer=setInterval(()=>show(active+1),intervalMs)};
  qs('#heroNext',root)?.addEventListener('click',()=>{show(active+1);start()});
  qs('#heroPrev',root)?.addEventListener('click',()=>{show(active-1);start()});
  qsa('.hero-dot',root).forEach((x,i)=>x.addEventListener('click',()=>{show(i);start()})); root.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){show(active+1);start()} if(e.key==='ArrowLeft'){show(active-1);start()}}); root.tabIndex=0;
  root.addEventListener('mouseenter',()=>clearInterval(timer));root.addEventListener('mouseleave',start);show(0);prepareHeroCutouts(root);start();
}
function viewHome(){
  const cats=['Health & Beauty','Home & Kitchen','Watches','Fragrance','Electronics'];
  const valid=PRODUCTS.filter(Boolean);
  const withImages=valid.filter(p=>p.image||(p.images&&p.images.length));
  const heroPool=withImages.slice(0,3);
  const featured=valid.slice(0,8);
  const arrivals=valid.slice(8,16);
  const dealItems=valid.filter(p=>Number(p.was||0)>Number(p.price||0)).slice(0,5);
  const deals=dealItems.length?dealItems:featured.slice(0,5);
  const brands=[...new Set(valid.map(p=>p.brand).filter(Boolean))].slice(0,7);
  const catMeta=[
    ['All Products','Browse everything','/catalog/'],
    ['Health & Beauty','Beauty essentials','/category/health-and-beauty/'],
    ['Electronics','Smart picks','/category/electronics/'],
    ['Home & Kitchen','Everyday upgrades','/category/home-and-kitchen/'],
    ['Watches','Timeless pieces','/category/watches/'],
    ['Fragrance','Signature scents','/category/fragrance/'],
    ['Deals','Limited offers','/catalog/?sale=1'],
    ['New Arrivals','Fresh drops','/catalog/?sort=newest']
  ];
  const heroMain=heroPool[0]||valid[0]||{};
  const heroImg=p=>p?.image?`<img src="${esc(p.image)}" alt="${esc(p.title||'Featured product')}" loading="lazy">`:'';
  const heroTiles=heroPool.map((p,i)=>`<a href="${productPath(p)}" class="zm-hero-float zm-hero-float-${i}" data-link>${heroImg(p)}<span>${esc(p.title||'Featured')}</span></a>`).join('');
  const heroTitle=STORE_CMS.hero_title||'Upgrade Your Shopping';
  const heroDesc=STORE_CMS.hero_description||'Discover trending beauty, home, lifestyle and everyday essentials. Premium picks, fair prices.';
  const heroEyebrow=STORE_CMS.hero_eyebrow||'SPECIAL COLLECTION';
  const heroCTA=STORE_CMS.hero_button_text||'Shop Now';
  const catTiles=catMeta.map((c,i)=>`<a href="${c[2]}" class="zm-cat-tile" data-link><span class="zm-cat-icon">${ICONS[c[0]]||ICONS[c[0].replace(' & Beauty','') ]||'✦'}</span><strong>${esc(c[0])}</strong><small>${esc(c[1])}</small></a>`).join('');
  const dealCards=deals.map(productCard).join('');
  const arrivalCards=arrivals.map(productCard).join('');
  const promoScripts=['Super','Big','Mega','Weekend','Flash'];
  const promoSlideData=cats.map((c,i)=>{
    const cp=valid.find(p=>p.cat===c && (p.image||(p.images&&p.images.length))) || valid.find(p=>p.cat===c) || {};
    const img=cp.image||(cp.images&&cp.images[0])||'';
    return {cat:c, product:cp, img, script:promoScripts[i%promoScripts.length]};
  });
  const promoSlides=promoSlideData.map((s,i)=>`
    <div class="zm-promo-slide zm-promo-slide--${i%5} ${i===0?'is-active':''}">
      <div class="zm-promo-copy">
        <span class="zm-promo-script">${esc(s.script)} SALE</span>
        <h2 class="zm-promo-title">${esc(s.cat)}</h2>
        <span class="zm-promo-sub">This weekend only</span>
        <a href="${s.product&&s.product.id?productPath(s.product):categoryPath(s.cat)}" class="zm-promo-cta" data-link>Order Now →</a>
      </div>
      <div class="zm-promo-visual">${s.img?`<img src="${esc(s.img)}" alt="${esc(s.cat)}" loading="lazy">`:`<div class="zm-promo-visual-icon">${ICONS[s.cat]||'✦'}</div>`}</div>
      <div class="zm-promo-badge">Up to<br><strong>50%</strong><br>Off</div>
    </div>`).join('');
  const promoDots=promoSlideData.map((s,i)=>`<button class="zm-promo-dot ${i===0?'is-active':''}" data-i="${i}" aria-label="Slide ${i+1}"></button>`).join('');
  return `<div class="zm-home">
    <section class="zm-promo-hero" id="zmPromoHero">
      <div class="zm-promo-track">
        ${promoSlides}
        <button class="zm-promo-arrow zm-promo-arrow--prev" id="zmPromoPrev" aria-label="Previous">‹</button>
        <button class="zm-promo-arrow zm-promo-arrow--next" id="zmPromoNext" aria-label="Next">›</button>
        <div class="zm-promo-dots">${promoDots}</div>
      </div>
    </section>
    <section class="zm-category-strip">${catTiles}</section>
    <section class="zm-section"><div class="zm-section-head"><div><span class="zm-kicker">TODAY'S PICKS</span><h2>Featured Deals</h2><p>Hand-picked offers from across the store.</p></div><a href="/catalog/?sale=1" data-link>View All Deals →</a></div><div class="zm-products-grid">${dealCards}</div></section>
    <section class="zm-brand-banner"><div><span>Big Savings On Top Categories</span><small>Limited-time offers • Fresh drops every week</small></div><a href="/catalog/?sale=1" class="btn btn--primary" data-link>Shop Now →</a><div class="zm-brand-list">${(brands.length?brands:['ZM BEAUTY','HOME','TECH','WATCHES','LIFESTYLE']).map(b=>`<b>${esc(b)}</b>`).join('')}</div></section>
    <section class="zm-section"><div class="zm-section-head"><div><span class="zm-kicker">JUST LANDED</span><h2>New Arrivals</h2><p>Fresh products ready to discover.</p></div><a href="/catalog/?sort=newest" data-link>View All Products →</a></div><div class="zm-products-grid">${arrivalCards||dealCards}</div></section>
    <section class="zm-trust-strip"><div><b>🚚</b><span><strong>Free Worldwide Shipping</strong><small>On selected orders</small></span></div><div><b>◷</b><span><strong>Easy 7-Day Returns</strong><small>Clear return policy</small></span></div><div><b>▣</b><span><strong>Secure &amp; Safe Payments</strong><small>Protected checkout</small></span></div><div><b>♡</b><span><strong>24/7 Customer Support</strong><small>We're here when needed</small></span></div></section>
  </div>`;
}
function wireHome(){ wireCardEvents(qs("#app")); wireZmPromoHero(); }
function wireZmPromoHero(){
  const root=qs('#zmPromoHero'); if(!root) return;
  const slides=qsa('.zm-promo-slide',root); if(!slides.length) return;
  const dots=qsa('.zm-promo-dot',root);
  let active=0, timer=null;
  const show=n=>{ active=(n+slides.length)%slides.length; slides.forEach((x,i)=>x.classList.toggle('is-active',i===active)); dots.forEach((x,i)=>x.classList.toggle('is-active',i===active)); };
  const start=()=>{ clearInterval(timer); timer=setInterval(()=>show(active+1),4500); };
  qs('#zmPromoNext',root)?.addEventListener('click',()=>{show(active+1);start();});
  qs('#zmPromoPrev',root)?.addEventListener('click',()=>{show(active-1);start();});
  dots.forEach((d,i)=>d.addEventListener('click',()=>{show(i);start();}));
  root.addEventListener('mouseenter',()=>clearInterval(timer));
  root.addEventListener('mouseleave',start);
  start();
}

/* ---------- PRODUCT CARD (shared) ---------- */
function productCard(p){
  const isWish = state.wishlist.has(p.id);
  return `
  <div class="card">
    <div class="card__media ${MEDIA_CLASS[p.cat]}">
      <span class="card__badge">${p.badge}</span>
      <button class="card__wish ${isWish?'active':''}" data-wish="${p.id}" aria-label="Toggle wishlist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWish?'currentColor':'none'}"><path d="M12 20s-7.5-4.6-10-9.3C.6 7 2.4 3.6 6 3.2c2-.2 3.7.9 6 3.3 2.3-2.4 4-3.5 6-3.3 3.6.4 5.4 3.8 4 7.5C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      </button>
      ${p.image ? `<img src="${p.image}" alt="${p.title}" style="width:100%;height:100%;object-fit:cover;">` : (ICONS[p.cat] || "")}
    </div>
    <div class="card__body">
      <span class="card__cat">${p.cat}</span>
      <div class="card__title"><a href="${productPath(p)}" data-link>${p.title}</a></div>
      <div class="card__price"><span class="now">${rupees(p.price)}</span><span class="was">${rupees(p.was)}</span></div>
      <button class="card__add" data-add="${p.id}">Add to cart</button>
    </div>
  </div>`;
}
function wireCardEvents(root){
  qsa("[data-add]", root).forEach(btn => btn.addEventListener("click", () => addToCart(btn.dataset.add, 1)));
  qsa("[data-wish]", root).forEach(btn => btn.addEventListener("click", () => { toggleWishlist(btn.dataset.wish); render(); }));
}

/* ---------- VIEW: CATALOG ---------- */
function viewCatalog(params){
  const activeCat = params.get("cat") || "";
  const q = (params.get("q") || "").trim().toLowerCase();
  const sort = params.get("sort") || "featured";
  const min = Number(params.get("min") || 0);
  const maxParam = params.get("max");
  const max = maxParam === null || maxParam === "" ? Math.max(0, ...PRODUCTS.map(p=>Number(p.price)||0)) : Number(maxParam);
  const rating = Number(params.get("rating") || 0);
  const availability = params.get("availability") || "";
  const sale = params.get("sale") === "1";
  const featured = params.get("featured") === "1";
  const selectedBrand = params.get("brand") || "";
  const pageSize = 12;
  const page = Math.max(1, Number(params.get("page") || 1));
  const cats = [...new Set(PRODUCTS.map(p=>p.cat).filter(Boolean))];
  const brands = [...new Set(PRODUCTS.map(p=>p.brand).filter(Boolean))].sort();

  let items = PRODUCTS.filter(p => {
    const hay = `${p.title} ${p.sku||""} ${p.brand||""} ${p.cat||""} ${p.desc||""}`.toLowerCase();
    return (!activeCat || p.cat === activeCat) &&
      (!q || hay.includes(q)) &&
      (!selectedBrand || p.brand === selectedBrand) &&
      ((Number(p.price)||0) >= min) &&
      ((Number(p.price)||0) <= max) &&
      (!rating || Number(p.rating||0) >= rating) &&
      (!availability || (availability==="in-stock" ? Number(p.stock)>0 : Number(p.stock)<=0)) &&
      (!sale || Number(p.was||0) > Number(p.price||0)) &&
      (!featured || !!p.featured);
  });

  if(sort === "price-asc") items = [...items].sort((a,b)=>a.price-b.price);
  else if(sort === "price-desc") items = [...items].sort((a,b)=>b.price-a.price);
  else if(sort === "rating") items = [...items].sort((a,b)=>Number(b.rating||0)-Number(a.rating||0));
  else if(sort === "newest") items = [...items].reverse();

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total/pageSize));
  const safePage = Math.min(page,pages);
  const visible = items.slice((safePage-1)*pageSize, safePage*pageSize);
  const priceMax = Math.max(1000, Math.ceil(Math.max(...PRODUCTS.map(p=>Number(p.price)||0),1000)/500)*500);
  return `
  <div class="container section">
    <div class="breadcrumb"><a href="/" data-link>Home</a> / Catalog${activeCat ? " / " + esc(activeCat) : ""}</div>
    <div class="page-head">
      <h1>${esc(activeCat || "All products")}</h1>
      <p>${q ? `Results for "${esc(q)}"` : "Discover products with smart filters, sorting and search."}</p>
    </div>

    <div class="catalog-mobile-actions">
      <button class="btn btn--dark" id="mobileFilterBtn">☰ Filters</button>
      <span>${total} result${total!==1?'s':''}</span>
    </div>

    <div class="catalog-layout">
      <aside class="filters" id="catalogFilters">
        <div class="filter-mobile-head"><strong>Filters</strong><button type="button" id="closeFilters">×</button></div>
        <div class="filter-group">
          <h4>Category</h4>
          <label class="filter-opt"><input type="radio" name="cat" value="" ${!activeCat?'checked':''}> All categories</label>
          ${cats.map(c => `<label class="filter-opt"><input type="radio" name="cat" value="${esc(c)}" ${activeCat===c?'checked':''}> ${esc(c)}</label>`).join("")}
        </div>
        ${brands.length?`<div class="filter-group"><h4>Brand</h4><select id="brandFilter"><option value="">All brands</option>${brands.map(b=>`<option value="${esc(b)}" ${selectedBrand===b?'selected':''}>${esc(b)}</option>`).join("")}</select></div>`:""}
        <div class="filter-group">
          <h4>Price</h4>
          <div class="price-filter"><input id="minPrice" type="number" min="0" value="${min||0}" placeholder="Min"><span>—</span><input id="maxPrice" type="number" min="0" value="${max||priceMax}" placeholder="Max"></div>
          <div class="filter-hint">Up to ${rupees(priceMax)}</div>
        </div>
        <div class="filter-group">
          <h4>Rating</h4>
          ${[4,3,2].map(n=>`<label class="filter-opt"><input type="radio" name="rating" value="${n}" ${rating===n?'checked':''}> ${"★".repeat(n)} &amp; up</label>`).join("")}
          <label class="filter-opt"><input type="radio" name="rating" value="0" ${!rating?'checked':''}> All ratings</label>
        </div>
        <div class="filter-group">
          <h4>Availability</h4>
          <label class="filter-opt"><input type="radio" name="availability" value="" ${!availability?'checked':''}> All products</label>
          <label class="filter-opt"><input type="radio" name="availability" value="in-stock" ${availability==='in-stock'?'checked':''}> In stock</label>
          <label class="filter-opt"><input type="radio" name="availability" value="out" ${availability==='out'?'checked':''}> Out of stock</label>
        </div>
        <div class="filter-group">
          <label class="filter-check"><input id="saleFilter" type="checkbox" ${sale?'checked':''}> On sale</label>
          <label class="filter-check"><input id="featuredFilter" type="checkbox" ${featured?'checked':''}> Featured</label>
        </div>
        <button class="btn btn--outline filter-clear" id="clearFilters">Clear all filters</button>
      </aside>

      <div>
        <div class="catalog-toolbar">
          <span class="result-count"><strong>${total}</strong> product${total!==1?'s':''}</span>
          <select id="sortSelect">
            <option value="featured" ${sort==='featured'?'selected':''}>Sort: Featured</option>
            <option value="newest" ${sort==='newest'?'selected':''}>Newest</option>
            <option value="price-asc" ${sort==='price-asc'?'selected':''}>Price: Low to High</option>
            <option value="price-desc" ${sort==='price-desc'?'selected':''}>Price: High to Low</option>
            <option value="rating" ${sort==='rating'?'selected':''}>Top Rated</option>
          </select>
        </div>
        <div class="grid" id="catalogGrid">
          ${visible.length ? visible.map(productCard).join("") : `<div class="empty-state" style="grid-column:1/-1"><h3>No products found</h3><p>Try removing a filter or searching for another product.</p><button class="btn btn--dark" id="emptyClear">Clear filters</button></div>`}
        </div>
        ${pages>1?`<div class="catalog-pagination">${Array.from({length:pages},(_,i)=>i+1).map(n=>`<button class="page-btn ${n===safePage?'active':''}" data-page="${n}">${n}</button>`).join("")}</div>`:""}
      </div>
    </div>
  </div>`;
}
function wireCatalog(params){
  const root=qs("#app");
  wireCardEvents(root);
  const update=(changes={})=>{
    const p=new URLSearchParams(location.search||"");
    Object.entries(changes).forEach(([k,v])=>{ if(v===null||v===""||v===false||v===0&&["min","rating","page"].includes(k)) p.delete(k); else p.set(k,String(v)); });
    if(!("page" in changes)) p.delete("page");
    const qsx=p.toString();
    history.pushState({}, "", "/catalog/" + (qsx?"?"+qsx:"")); render();
  };
  qsa('input[name="cat"]',root).forEach(r=>r.addEventListener("change",()=>update({cat:r.value})));
  qsa('input[name="rating"]',root).forEach(r=>r.addEventListener("change",()=>update({rating:Number(r.value)})));
  qsa('input[name="availability"]',root).forEach(r=>r.addEventListener("change",()=>update({availability:r.value})));
  const brand=qs("#brandFilter",root); if(brand) brand.addEventListener("change",()=>update({brand:brand.value}));
  const minEl=qs("#minPrice",root), maxEl=qs("#maxPrice",root);
  const applyPrice=()=>update({min:Number(minEl.value)||0,max:Number(maxEl.value)||null});
  if(minEl) minEl.addEventListener("change",applyPrice);
  if(maxEl) maxEl.addEventListener("change",applyPrice);
  const saleEl=qs("#saleFilter",root); if(saleEl) saleEl.addEventListener("change",()=>update({sale:saleEl.checked?"1":null}));
  const featEl=qs("#featuredFilter",root); if(featEl) featEl.addEventListener("change",()=>update({featured:featEl.checked?"1":null}));
  const sortEl=qs("#sortSelect",root); if(sortEl) sortEl.addEventListener("change",()=>update({sort:sortEl.value}));
  const clear=()=>{ history.pushState({}, "", "/catalog/"); render(); };
  const clearBtn=qs("#clearFilters",root); if(clearBtn) clearBtn.addEventListener("click",clear);
  const emptyClear=qs("#emptyClear",root); if(emptyClear) emptyClear.addEventListener("click",clear);
  qsa("[data-page]",root).forEach(b=>b.addEventListener("click",()=>update({page:Number(b.dataset.page)})));
  const mf=qs("#mobileFilterBtn"), cf=qs("#closeFilters"), panel=qs("#catalogFilters");
  if(mf&&panel) mf.addEventListener("click",()=>panel.classList.add("filters--open"));
  if(cf&&panel) cf.addEventListener("click",()=>panel.classList.remove("filters--open"));
}
/* ---------- VIEW: PRODUCT DETAIL ---------- */
function viewProduct(id){
  const p=findProduct(id);
  if(!p) return `<div class="container section"><h2>Product not found</h2><a href="/catalog/" data-link class="btn btn--dark">Back to catalog</a></div>`;
  const related=PRODUCTS.filter(x=>x.cat===p.cat&&x.id!==p.id).slice(0,4);
  const isWish=state.wishlist.has(p.id);
  const images=(p.images&&p.images.length?p.images:[p.image]).filter(Boolean);
  const variants=p.variants||[];
  const initial=variants.find(v=>Number(v.stock)>0)||variants[0]||null;
  const initialPrice=Number(initial?.price??p.price);
  const initialWas=Number(p.was||initialPrice);
  const offPct=initialWas>initialPrice?Math.round((1-initialPrice/initialWas)*100):0;
  return `
  <div class="container section">
    <div class="breadcrumb"><a href="/" data-link>Home</a> / <a href="${categoryPath(p.cat)}" data-link>${p.cat}</a> / ${esc(p.title)}</div>
    <div class="pdp">
      <div class="pdp__gallery">
        <div class="pdp__main-media ${MEDIA_CLASS[p.cat]}" id="pdpMainMedia">${images[0]?`<img src="${esc(images[0])}" alt="${esc(p.title)}" class="pdp__real-image">`:(ICONS[p.cat]||'')}</div>
        <div class="pdp__thumbs" id="pdpThumbs">${images.length?images.map((img,i)=>`<button type="button" class="pdp__thumb ${i===0?'active':''}" data-image="${esc(img)}"><img src="${esc(img)}" alt="${esc(p.title)} image ${i+1}"></button>`).join(''):`<div class="pdp__thumb active ${MEDIA_CLASS[p.cat]}">${ICONS[p.cat]||''}</div>`}</div>
      </div>
      <div class="pdp__info">
        <div class="pdp__cat">${esc(p.cat).toUpperCase()}${p.brand?` · ${esc(p.brand)}`:''}</div>
        <h1>${esc(p.title)}</h1>
        <p class="pdp__short">${esc(p.desc||'Quality product from ZM Hybrid Store.')}</p>
        <div class="pdp__price"><span class="now" id="pdpPrice">${rupees(initialPrice)}</span>${initialWas>initialPrice?`<span class="was" id="pdpWas">${rupees(initialWas)}</span><span class="off" id="pdpOff">-${offPct}%</span>`:''}</div>
        <div class="pdp__viewers">${stars(p.rating||4.5)} · Customer rating</div>
        ${variants.length?`<div class="pdp__variants"><strong>Select option</strong><div class="variant-list">${variants.map((v,i)=>`<button type="button" class="variant-chip ${String(v.id)===String(initial?.id)?'active':''} ${Number(v.stock)<=0?'disabled':''}" data-variant="${esc(v.id)}" ${Number(v.stock)<=0?'disabled':''}>${esc(v.name)}${Number(v.stock)<=0?' — Out of stock':''}</button>`).join('')}</div></div>`:''}
        <div class="qty-row"><div class="qty-selector"><button id="qtyMinus">−</button><span id="qtyVal">1</span><button id="qtyPlus">+</button></div><span class="stock-note" id="stockNote">${Number(initial?.stock??p.stock)>0?`${Number(initial?.stock??p.stock)} available`:'Out of stock'}</span></div>
        <div class="pdp__actions"><button class="btn btn--outline" id="addCartBtn" ${Number(initial?.stock??p.stock)<=0?'disabled':''}>Add to cart</button><button class="btn btn--primary" id="buyNowBtn" ${Number(initial?.stock??p.stock)<=0?'disabled':''}>Buy it now</button><button class="icon-fav ${isWish?'active':''}" id="favBtn" aria-label="Wishlist"><svg width="19" height="19" viewBox="0 0 24 24" fill="${isWish?'currentColor':'none'}"><path d="M12 20s-7.5-4.6-10-9.3C.6 7 2.4 3.6 6 3.2c2-.2 3.7.9 6 3.3 2.3-2.4 4-3.5 6-3.3 3.6.4 5.4 3.8 4 7.5C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.6"/></svg></button></div>
        <div class="pdp__perks"><div class="pdp__perk">✓ Free shipping on this item, delivered in 2–5 business days</div><div class="pdp__perk">✓ 7-day returns on unused items in original packaging</div><div class="pdp__perk">✓ Secure checkout · Cash on delivery available</div></div>
        <div class="pdp__tabs"><div class="pdp__tab-heads"><button class="pdp__tab-head active" data-tab="desc">Description</button><button class="pdp__tab-head" data-tab="details">Details</button><button class="pdp__tab-head" data-tab="shipping">Shipping</button></div><div class="pdp__tab-panel active" data-panel="desc"><p>${esc(p.desc||p.short_description||'')}</p></div><div class="pdp__tab-panel" data-panel="details"><ul>${(p.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join('')||'<li>Original product · carefully packed</li><li>Pakistan-wide delivery</li>'}</ul></div><div class="pdp__tab-panel" data-panel="shipping"><p>Orders ship within 24 hours and normally arrive in 2–5 business days. Free shipping is available according to the store shipping policy.</p></div></div>
      </div>
    </div>
    <section class="reviews-section" id="reviewsSection" style="margin-top:56px;"><div class="section-head"><div><h2>Customer reviews</h2><p>Verified feedback from customers who received this product.</p></div></div><div id="reviewsMount"><div class="muted">Loading reviews…</div></div></section>
    ${related.length?`<div class="section-head" style="margin-top:64px;"><div><h2>You may also like</h2><p>More from ${esc(p.cat)}.</p></div></div><div class="grid">${related.map(productCard).join('')}</div>`:''}
  </div>`;
}
function wireProduct(id){
  const p=findProduct(id); if(!p) return; const app=qs('#app'); let qty=1; let selected=(p.variants||[]).find(v=>Number(v.stock)>0)||null;
  const qtyVal=qs('#qtyVal'), priceEl=qs('#pdpPrice'), wasEl=qs('#pdpWas'), offEl=qs('#pdpOff'), stockNote=qs('#stockNote');
  const refresh=()=>{ const price=Number(selected?.price??p.price), was=Number(p.was||price), stock=Number(selected?.stock??p.stock??0); if(priceEl) priceEl.textContent=rupees(price); if(wasEl){wasEl.textContent=rupees(was);wasEl.style.display=was>price?'':'none';} if(offEl){offEl.textContent=was>price?`-${Math.round((1-price/was)*100)}%`:'';offEl.style.display=was>price?'':'none';} if(stockNote) stockNote.textContent=stock>0?`${stock} available`:'Out of stock'; ['addCartBtn','buyNowBtn'].forEach(x=>{const b=qs('#'+x);if(b)b.disabled=stock<=0||qty>stock;}); };
  qs('#qtyPlus').addEventListener('click',()=>{qty++;qtyVal.textContent=qty;refresh();});
  qs('#qtyMinus').addEventListener('click',()=>{qty=Math.max(1,qty-1);qtyVal.textContent=qty;refresh();});
  qsa('[data-variant]',app).forEach(btn=>btn.addEventListener('click',()=>{selected=getVariant(p,btn.dataset.variant);qsa('[data-variant]',app).forEach(x=>x.classList.remove('active'));btn.classList.add('active');qty=1;qtyVal.textContent='1';refresh();}));
  qs('#addCartBtn').addEventListener('click',()=>addToCart(p.id,qty,selected?.id||null));
  qs('#buyNowBtn').addEventListener('click',()=>{addToCart(p.id,qty,selected?.id||null);history.pushState({},'', '/checkout/');render();});
  qs('#favBtn').addEventListener('click',()=>{toggleWishlist(p.id);render();});
  qsa('[data-image]',app).forEach(btn=>btn.addEventListener('click',()=>{qs('#pdpMainMedia').innerHTML=`<img src="${esc(btn.dataset.image)}" alt="${esc(p.title)}" class="pdp__real-image">`;qsa('[data-image]',app).forEach(x=>x.classList.remove('active'));btn.classList.add('active');}));
  qsa('.pdp__tab-head',app).forEach(btn=>btn.addEventListener('click',()=>{qsa('.pdp__tab-head',app).forEach(b=>b.classList.remove('active'));qsa('.pdp__tab-panel',app).forEach(x=>x.classList.remove('active'));btn.classList.add('active');qs(`[data-panel="${btn.dataset.tab}"]`,app).classList.add('active');}));
  wireCardEvents(app); refresh();
  loadProductReviews(p.id);
}

async function loadProductReviews(productId){
  const mount=qs('#reviewsMount'); if(!mount||!supabaseClient)return;
  try{
    const {data,error}=await supabaseClient.from('reviews').select('rating,title,body,created_at').eq('product_id',productId).eq('status','approved').order('created_at',{ascending:false}).limit(20);
    if(error)throw error; const rows=data||[];
    const avg=rows.length?rows.reduce((n,r)=>n+Number(r.rating||0),0)/rows.length:0;
    const cards=rows.map(r=>`<article class="box review-card" style="margin-bottom:12px"><div><strong>${'★'.repeat(Number(r.rating||0))}${'☆'.repeat(5-Number(r.rating||0))}</strong><span class="muted" style="margin-left:10px">Verified purchase</span></div>${r.title?`<h4 style="margin:7px 0 4px">${esc(r.title)}</h4>`:''}<p style="margin:0">${esc(r.body||'')}</p><small class="muted">${new Date(r.created_at).toLocaleDateString()}</small></article>`).join('');
    mount.innerHTML=`<div class="reviews-summary box"><strong>${rows.length?avg.toFixed(1):'No ratings yet'}</strong>${rows.length?` <span>${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))} · ${rows.length} review${rows.length===1?'':'s'}</span>`:' <span>Be the first verified customer to review this product.</span>'}</div>${cards||''}<div class="box" style="margin-top:16px"><h3>Leave a review</h3><p class="muted">Only customers with a delivered order for this product can submit a review. Reviews are published after approval.</p><form id="reviewForm"><div class="form-row"><div><label>Rating</label><select id="reviewRating"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Poor</option></select></div><div><label>Title</label><input id="reviewTitle" maxlength="120" placeholder="What did you think?"></div></div><label>Your review</label><textarea id="reviewBody" rows="4" maxlength="1200" placeholder="Share your experience…" required></textarea><button class="btn btn--primary" type="submit">Submit review</button><p id="reviewMsg" class="form-msg"></p></form></div>`;
    qs('#reviewForm')?.addEventListener('submit',async e=>{e.preventDefault();const msg=qs('#reviewMsg');msg.textContent='Submitting…';try{const {error}=await supabaseClient.rpc('submit_review_secure',{p_product_id:productId,p_rating:Number(qs('#reviewRating').value),p_title:qs('#reviewTitle').value.trim()||null,p_body:qs('#reviewBody').value.trim()});if(error)throw error;msg.textContent='Review submitted. It will appear after approval.';qs('#reviewForm').reset();}catch(err){msg.textContent=err.message||'Could not submit review.';}});
  }catch(e){mount.innerHTML=`<div class="box"><p class="muted">Reviews are temporarily unavailable.</p></div>`;}
}

/* ---------- VIEW: CART PAGE ---------- */
function viewCartPage(){
  if(!state.cart.length) return `<div class="container section"><div class="empty-state"><h2 style="margin-bottom:12px;">Your cart is empty</h2><p style="margin-bottom:24px;">Looks like you haven't added anything yet.</p><a href="/catalog/" class="btn btn--primary" data-link>Start shopping</a></div></div>`;
  const rows=state.cart.map((i,idx)=>{const p=findProduct(i.id),v=getVariant(p,i.variantId),img=p.images?.[0]||p.image;return `<div class="cart-row"><div class="cart-row__media">${img?`<img src="${esc(img)}" alt="${esc(p.title)}">`:(ICONS[p.cat]||'')}</div><div><div class="cart-row__title"><a href="${productPath(p)}" data-link>${esc(p.title)}</a></div><div class="cart-row__cat">${esc(p.cat)}${v?` · ${esc(v.name)}`:''}</div><button class="cart-row__remove" data-remove="${esc(p.id)}" data-remove-variant="${esc(i.variantId||'')}">Remove</button></div><div class="qty-selector"><button data-qty-down="${esc(p.id)}" data-variant="${esc(i.variantId||'')}">−</button><span>${i.qty}</span><button data-qty-up="${esc(p.id)}" data-variant="${esc(i.variantId||'')}">+</button></div><div class="cart-row__price">${rupees(cartUnitPrice(i)*i.qty)}</div></div>`}).join('');
  const subtotal=couponSubtotal(), discount=couponDiscountAmount(), total=couponTotal();
  return `<div class="container section"><div class="page-head"><h1>Your cart</h1><p>${cartCount()} item${cartCount()!==1?'s':''} ready for checkout.</p></div><div class="cart-page"><div><div>${rows}</div><div class="coupon-box"><div class="coupon-box__title">Have a coupon?</div><div class="coupon-box__row"><input id="cartCouponCode" value="${esc(appliedCoupon?.code||'')}" placeholder="Enter coupon code" maxlength="40" autocomplete="off"><button class="btn btn--outline" type="button" id="cartApplyCoupon">${appliedCoupon?'Applied':'Apply coupon'}</button></div><p id="cartCouponMsg" class="coupon-msg ${appliedCoupon?'coupon-msg--success':''}">${appliedCoupon?`${esc(appliedCoupon.code)} applied — ${rupees(discount)} discount`:''}</p></div></div><div class="order-summary"><h3>Order summary</h3><div class="summary-line"><span>Subtotal</span><strong>${rupees(subtotal)}</strong></div>${discount?`<div class="summary-line summary-line--discount"><span>Coupon (${esc(appliedCoupon.code)})</span><strong>−${rupees(discount)}</strong></div>`:''}<div class="summary-line"><span>Shipping</span><strong>Free</strong></div><div class="summary-total"><span>Total</span><span>${rupees(total)}</span></div><a href="/checkout/" class="btn btn--primary btn--block" data-link style="margin-top:18px;">Proceed to checkout</a><a href="/catalog/" class="btn btn--outline btn--block" data-link style="margin-top:10px;">Continue shopping</a></div></div></div>`;
}

function wireCartPage(){
  const app=qs('#app');
  app.onclick=async e=>{
    const up=e.target.closest('[data-qty-up]'),down=e.target.closest('[data-qty-down]'),rm=e.target.closest('[data-remove]'),apply=e.target.closest('#cartApplyCoupon');
    if(up){const i=state.cart.find(x=>String(x.id)===String(up.dataset.qtyUp)&&String(x.variantId||'')===String(up.dataset.variant||''));if(i){setQty(i.id,i.qty+1,i.variantId);clearCoupon();render();}}
    if(down){const i=state.cart.find(x=>String(x.id)===String(down.dataset.qtyDown)&&String(x.variantId||'')===String(down.dataset.variant||''));if(i){setQty(i.id,i.qty-1,i.variantId);clearCoupon();render();}}
    if(rm){removeFromCart(rm.dataset.remove,rm.dataset.removeVariant||null);clearCoupon();render();}
    if(apply){await applyCouponFromInput('#cartCouponCode','#cartCouponMsg');}
  };
}
async function applyCouponFromInput(inputSel,msgSel){
  const input=qs(inputSel), msg=qs(msgSel), code=(input?.value||'').trim().toUpperCase();
  if(!code){ clearCoupon(); render(); return; }
  if(couponSubtotal()<=0){ msg.textContent='Your cart is empty.'; return; }
  if(msg){msg.className='coupon-msg';msg.textContent='Checking coupon…';}
  try{
    if(!supabaseClient) throw new Error('Coupon service is unavailable.');
    const {data,error}=await supabaseClient.rpc('validate_coupon_public',{p_code:code,p_subtotal:couponSubtotal()});
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||'Invalid coupon.');
    appliedCoupon={...data,code};
    render();
  }catch(err){
    const errorText=err?.message||'Could not apply coupon.';
    clearCoupon();
    render();
    const freshMsg=qs(msgSel);
    if(freshMsg){freshMsg.className='coupon-msg coupon-msg--error';freshMsg.textContent=errorText;}
  }
}

/* ---------- VIEW: WISHLIST ---------- */
function viewWishlist(){ const items=PRODUCTS.filter(p=>state.wishlist.has(String(p.id))||state.wishlist.has(p.id)); return `<div class="container section"><div class="page-head"><h1>Your wishlist</h1><p>${items.length} saved item${items.length!==1?'s':''}.</p></div>${items.length?`<div class="grid">${items.map(productCard).join('')}</div>`:`<div class="empty-state"><h2>No saved products yet</h2><p style="margin:10px 0 24px;">Tap the heart on any product to save it here.</p><a href="/catalog/" class="btn btn--primary" data-link>Browse products</a></div>`}</div>`; }
function wireWishlist(){ wireCardEvents(qs('#app')); }

/* ---------- VIEW: CHECKOUT ---------- */
function viewCheckout(){
  if(state.cart.length === 0){
    return `<div class="container section"><div class="empty-state"><h2>Your cart is empty</h2><p style="margin-bottom:20px;">Add a product before checking out.</p><a href="/catalog/" class="btn btn--primary" data-link>Browse products</a></div></div>`;
  }
  const subtotal = couponSubtotal();
  const discount = couponDiscountAmount();
  const total = couponTotal();
  const shippingOptions = SHIPPING_METHODS.length ? SHIPPING_METHODS.map(m => `<option value="${esc(m.code)}" ${m.code===selectedShippingMethod?"selected":""}>${esc(m.name)} — ${Number(m.base_cost||0)?rupees(m.base_cost):"Free"}</option>`).join("") : `<option value="standard">Standard Delivery — Free</option>`;
  return `
  <div class="container section">
    <div class="page-head"><h1>Checkout</h1><p>Enter your shipping details to complete your order.</p></div>
    <form class="checkout-layout" id="checkoutForm">
      <div>
        <div class="form-row">
          <div class="form-group"><label>First name</label><input id="ckFirstName" required></div>
          <div class="form-group"><label>Last name</label><input id="ckLastName" required></div>
        </div>
        <div class="form-group"><label>Phone number</label><input id="ckPhone" type="tel" required placeholder="03xx-xxxxxxx"></div>
        <div class="form-group"><label>Address</label><input id="ckAddress" required placeholder="House no, street, area"></div>
        <div class="form-row">
          <div class="form-group"><label>City <span class="ur">شہر</span></label>
            <select id="ckCity" required>
              <option value="" disabled selected>Select your city</option>
              <option>Karachi</option><option>Lahore</option><option>Islamabad</option>
              <option>Rawalpindi</option><option>Faisalabad</option><option>Multan</option>
              <option>Peshawar</option><option>Quetta</option><option>Sialkot</option>
              <option>Gujranwala</option><option>Hyderabad</option><option>Sargodha</option>
              <option>Other</option>
            </select>
          </div>
          <div class="form-group"><label>Postal code</label><input id="ckPostal"></div>
        </div>
        <div class="form-group"><label>Order notes (optional)</label><textarea id="ckNotes" rows="3"></textarea></div>
        <div class="form-group"><label>Delivery method <span class="ur">ترسیل</span></label><select id="ckShippingMethod">${shippingOptions}</select><small id="shippingHelp" class="muted">Shipping is calculated for your city and order total.</small></div>

        <div class="coupon-box checkout-coupon"><div class="coupon-box__title">Coupon code</div><div class="coupon-box__row"><input id="checkoutCouponCode" value="${esc(appliedCoupon?.code||"")}" placeholder="Enter coupon code" maxlength="40" autocomplete="off"><button class="btn btn--outline" type="button" id="checkoutApplyCoupon">${appliedCoupon?"Applied":"Apply coupon"}</button></div><p id="checkoutCouponMsg" class="coupon-msg ${appliedCoupon?"coupon-msg--success":""}">${appliedCoupon?`${esc(appliedCoupon.code)} applied — ${rupees(discount)} discount`:""}</p></div>

        <h4 style="font-size:.85rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin:22px 0 6px;">Payment method</h4>
        <div class="pay-methods">
          <label class="pay-method pay-method--recommended"><input type="radio" name="pay" value="Cash on delivery" checked> Cash on delivery <span class="ur">کیش آن ڈیلیوری</span> <span class="recommend-tag">Recommended</span></label>
          <label class="pay-method"><input type="radio" name="pay" value="Bank transfer"> Bank transfer <small>Manual verification</small></label>
          <label class="pay-method"><input type="radio" name="pay" value="JazzCash"> JazzCash <small>Manual verification</small></label>
          <label class="pay-method"><input type="radio" name="pay" value="Easypaisa"> Easypaisa <small>Manual verification</small></label>
        </div>
        <div id="paymentInstructions" class="box" style="margin-top:10px;display:none;"></div>
        <div class="form-group" id="paymentReferenceWrap" style="display:none;margin-top:10px;"><label>Payment transaction/reference ID <span class="muted">(optional)</span></label><input id="paymentReference" maxlength="120" placeholder="e.g. transaction ID / bank reference"><small class="muted">For prepaid methods, add the reference if you have already paid.</small></div>
        <button type="submit" class="btn btn--primary btn--block" id="placeOrderBtn">Place order</button>
        <p style="font-size:.78rem;color:var(--ink-soft);margin-top:10px;text-align:center;">Prepaid methods are recorded securely and remain pending until payment is verified. No card details are collected.</p>
      </div>

      <div class="order-summary">
        <h3>Order summary</h3>
        ${state.cart.map(i => {
          const p = findProduct(i.id);
          return `<div class="summary-mini-row">
            <div class="summary-mini-media ${MEDIA_CLASS[p.cat]}">${ICONS[p.cat]}</div>
            <div style="flex:1;">
              <div style="font-weight:700;">${p.title}</div>
              <div style="color:var(--ink-soft);">Qty ${i.qty}</div>
            </div>
            <div style="font-weight:800;color:var(--maroon);">${rupees(cartUnitPrice(i)*i.qty)}</div>
          </div>`;
        }).join("")}
        <div class="summary-line" style="margin-top:16px;"><span>Subtotal</span><strong>${rupees(subtotal)}</strong></div>
        ${discount?`<div class="summary-line summary-line--discount"><span>Coupon (${esc(appliedCoupon.code)})</span><strong>−${rupees(discount)}</strong></div>`:""}
        <div class="summary-line" id="checkoutShippingLine"><span>Shipping — ${esc(shippingQuote.method)}</span><strong>${shippingQuote.cost?rupees(shippingQuote.cost):"Free"}</strong></div>
        <div class="summary-total"><span>Total</span><span id="checkoutTotal">${rupees(total+shippingQuote.cost)}</span></div>
      </div>
    </form>
  </div>`;
}
function buildOrderText(order){
  const lines = order.items.map(i => `• ${i.title} × ${i.qty} — ${rupees(i.price * i.qty)}`).join("%0A");
  return `New order #${order.id}%0A%0A` +
    `Name: ${order.name}%0APhone: ${order.phone}%0AAddress: ${order.address}, ${order.city}%0A` +
    (order.postal ? `Postal code: ${order.postal}%0A` : "") +
    (order.notes ? `Notes: ${order.notes}%0A` : "") +
    `Payment: ${order.pay}%0A%0AItems:%0A${lines}%0A%0ATotal: ${rupees(order.total)}`;
}

async function sendOrderToSheet(order){
  if(!CONFIG.ORDER_SHEET_WEBHOOK) return;
  try{
    await fetch(CONFIG.ORDER_SHEET_WEBHOOK, {
      method: "POST",
      mode: "no-cors", // Apps Script web apps don't return CORS headers; fire-and-forget
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });
  }catch(err){
    console.error("Order webhook failed:", err);
  }
}

function trackPurchase(order){
  if(CONFIG.GA_MEASUREMENT_ID && typeof gtag === "function"){
    gtag("event", "purchase", {
      transaction_id: order.id,
      value: Number(order.total||0)*activeMarket().rate,
      currency: activeMarket().currency,
      items: (order.items||[]).map(i=>({ item_id:String(i.id), item_name:i.title, quantity:i.qty, price:Number(i.price||0)*activeMarket().rate }))
    });
  }
  if(CONFIG.META_PIXEL_ID && typeof fbq === "function"){
    fbq("track", "Purchase", { value: Number(order.total||0)*activeMarket().rate, currency: activeMarket().currency });
  }
}
function trackAddToCart(product, variant, qty){
  if(!(CONFIG.GA_MEASUREMENT_ID && typeof gtag === "function")) return;
  const price=Number(variant?.price ?? product?.price ?? 0)*activeMarket().rate;
  gtag("event", "add_to_cart", {
    currency: activeMarket().currency,
    value: price*qty,
    items: [{ item_id:String(product.id), item_name:product.title, item_category:product.cat, item_variant:variant?.name||undefined, price, quantity:qty }]
  });
}
function trackBeginCheckout(){
  if(!(CONFIG.GA_MEASUREMENT_ID && typeof gtag === "function")) return;
  gtag("event", "begin_checkout", {
    currency: activeMarket().currency,
    value: Number(cartTotal()||0)*activeMarket().rate,
    items: state.cart.map(i=>{ const p=findProduct(i.id); const v=getVariant(p,i.variantId); return { item_id:String(p.id), item_name:p.title, item_category:p.cat, item_variant:v?.name||undefined, price:Number(v?.price??p.price??0)*activeMarket().rate, quantity:i.qty }; })
  });
}

async function createSecureOrder(order){
  if(!SUPABASE_CONFIG.url || !CONFIG.ORDER_FUNCTION_URL) throw new Error("Secure checkout is not configured.");
  const items = state.cart.map(i => {
    const p = findProduct(i.id);
    return { product_id: p.id, variant_id: i.variantId || null, quantity: i.qty };
  });
  const response = await fetch(CONFIG.ORDER_FUNCTION_URL, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":SUPABASE_CONFIG.anonKey
    },
    body:JSON.stringify({
      name:order.name, phone:order.phone, address:order.address, city:order.city,
      postal:order.postal, notes:order.notes, payment_method:order.pay,
      shipping_method:order.shipping_method || selectedShippingMethod,
      coupon_code:order.coupon_code || "", payment_reference:order.payment_reference || "", affiliate_code:getAffiliateReferral(), items
    })
  });
  let data={};
  try{ data=await response.json(); }catch{}
  if(!response.ok || !data.ok) throw new Error(data.error || "Could not create your order.");
  return data.order;
}

function wireCheckout(){
  const form = qs("#checkoutForm");
  if(!form) return;
  trackBeginCheckout();
  const checkoutApply=qs("#checkoutApplyCoupon");
  qs("#ckCity")?.addEventListener("change", refreshShippingQuote);
  qs("#ckShippingMethod")?.addEventListener("change", e=>{selectedShippingMethod=e.target.value;refreshShippingQuote();});
  refreshShippingQuote();
  checkoutApply?.addEventListener("click", async ()=>{ await applyCouponFromInput("#checkoutCouponCode","#checkoutCouponMsg"); });
  const payInputs=[...document.querySelectorAll('input[name="pay"]')];
  const syncPaymentUI=()=>{
    const pay=qs('input[name="pay"]:checked')?.value || "Cash on delivery";
    const prepaid=pay!=="Cash on delivery";
    const wrap=qs("#paymentReferenceWrap"), box=qs("#paymentInstructions");
    if(wrap) wrap.style.display=prepaid?"block":"none";
    if(box){ box.style.display=prepaid?"block":"none"; const key=pay==='Bank transfer'?'bank_instructions':pay==='JazzCash'?'jazzcash_instructions':'easypaisa_instructions'; box.innerHTML='<strong>'+esc(pay)+'</strong><p class="muted" style="margin-top:6px;white-space:pre-line;">'+esc(PAYMENT_SETTINGS[key])+'</p>'; }
  };
  payInputs.forEach(i=>i.addEventListener('change',syncPaymentUI));
  syncPaymentUI();
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn=qs("#placeOrderBtn");
    if(btn?.disabled) return;
    const pay = qs('input[name="pay"]:checked')?.value || "Cash on delivery";
    const order = {
      id:"pending",
      name:`${qs("#ckFirstName").value} ${qs("#ckLastName").value}`.trim(),
      phone:qs("#ckPhone").value.trim(),
      address:qs("#ckAddress").value.trim(),
      city:qs("#ckCity").value.trim(),
      postal:qs("#ckPostal").value.trim(),
      notes:qs("#ckNotes").value.trim(),
      pay,
      shipping_method:selectedShippingMethod,
      coupon_code:appliedCoupon?.code || "",
      payment_reference:qs("#paymentReference")?.value.trim() || "",
      items:state.cart.map(i=>({ ...findProduct(i.id), qty:i.qty })),
      total:couponTotal(),
      placedAt:new Date().toISOString()
    };
    if(!order.name || !order.phone || !order.address || !order.city){
      alert("Please complete your name, phone, address and city.");
      return;
    }
    if(!state.cart.length){ alert("Your cart is empty."); return; }

    if(btn){btn.disabled=true;btn.textContent="Placing order…";}
    try{
      const created=await createSecureOrder(order);
      order.id=created.order_number;
      order.total=Number(created.total||0);
      trackPurchase(order);
      sendOrderToSheet({...order,secureOrderId:created.order_id});

      const waLink=`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${buildOrderText(order)}`;
      if(CONFIG.WHATSAPP_NUMBER && CONFIG.WHATSAPP_NUMBER!=="923073659140") window.open(waLink,"_blank");

      state.cart=[]; clearCoupon(); renderCartBadges(); renderCartDrawer();
      qs("#app").innerHTML=`
        <div class="container section">
          <div class="empty-state">
            <h2 style="margin-bottom:12px;">Thank you, ${window.esc(order.name.split(" ")[0])} — order ${window.esc(order.id)} received 🎉</h2>
            <p style="margin-bottom:12px;">Your order has been securely recorded. We'll contact you to confirm delivery.</p>
            <p style="margin-bottom:24px;">Total: <strong>${rupees(order.total)}</strong> · Payment: <strong>${window.esc(order.pay)}</strong></p>
            ${CONFIG.WHATSAPP_NUMBER && CONFIG.WHATSAPP_NUMBER!=="923073659140" ? `<p style="margin-bottom:24px;">For faster confirmation: <a href="${waLink}" target="_blank" rel="noopener" style="text-decoration:underline;">Confirm on WhatsApp</a></p>` : ""}
            <a href="/catalog/" class="btn btn--primary" data-link>Continue shopping</a>
          </div>
        </div>`;
    }catch(err){
      console.error("Secure checkout failed:",err);
      const msg=err?.message||"Could not place the order.";
      alert(msg);
      if(btn){btn.disabled=false;btn.textContent="Place order";}
    }
  });
}


/* ---------- PHASE 9: ACCOUNT + ORDERS ---------- */
let authSession = null;
async function getAuthSession(){
  if(!supabaseClient) return null;
  const {data}=await supabaseClient.auth.getSession();
  authSession=data?.session||null; return authSession;
}
function accountHeader(){
  const user=authSession?.user;
  return user ? `<div class="account-banner"><div><strong>${esc(user.email||'Customer')}</strong><div class="muted">Signed in</div></div><button class="btn btn--outline" id="accountLogout">Sign out</button></div>` : '';
}
function viewAccount(){
  return `<div class="container section"><div class="page-head"><h1>My account</h1><p>Manage your profile, saved addresses, wishlist and orders in one place.</p></div><div id="accountArea"><div class="empty-state">Loading account…</div></div><div class="account-help"><h3>Guest order?</h3><p>Track an order without signing in using your order number and phone number.</p><a href="/track-order/" class="btn btn--outline" data-link>Track an order</a></div></div>`;
}
async function wireAccount(){
  const area=qs('#accountArea'); if(!area) return;
  const session=await getAuthSession();
  if(!session){
    area.innerHTML=`<div class="account-auth-grid"><form id="accountLogin" class="account-form"><h2>Sign in</h2><p class="muted">Access orders, wishlist and saved addresses.</p><div class="form-group"><label>Email</label><input id="accEmail" type="email" required autocomplete="email"></div><div class="form-group"><label>Password</label><input id="accPassword" type="password" required autocomplete="current-password"></div><button class="btn btn--primary btn--block">Sign in</button><p id="accMsg" class="form-msg"></p><div class="account-divider">New customer?</div><button type="button" class="btn btn--outline btn--block" id="showRegister">Create account</button></form><div class="account-benefits"><h3>Why create an account?</h3><p>Keep your orders, wishlist and delivery addresses together.</p><ul><li>View order history</li><li>Save delivery addresses</li><li>Manage your wishlist</li><li>Submit verified product reviews</li></ul></div></div>`;
    qs('#accountLogin').addEventListener('submit',async e=>{e.preventDefault();const msg=qs('#accMsg');msg.textContent='Signing in…';try{const {error}=await supabaseClient.auth.signInWithPassword({email:qs('#accEmail').value.trim(),password:qs('#accPassword').value});if(error)throw error;render();}catch(err){msg.textContent=err.message;}});
    qs('#showRegister').addEventListener('click',()=>{area.innerHTML=`<form id="accountRegister" class="account-form account-form--wide"><h2>Create account</h2><p class="muted">Join ZM Hybrid Store to manage your orders and saved details.</p><div class="form-group"><label>Full name</label><input id="regName" required autocomplete="name"></div><div class="form-group"><label>Email</label><input id="regEmail" type="email" required autocomplete="email"></div><div class="form-group"><label>Password</label><input id="regPassword" type="password" minlength="6" required autocomplete="new-password"><small class="muted">Minimum 6 characters.</small></div><button class="btn btn--primary btn--block">Create account</button><p id="regMsg" class="form-msg"></p><button type="button" class="btn btn--outline btn--block" id="backLogin">Back to sign in</button></form>`;qs('#accountRegister').addEventListener('submit',async e=>{e.preventDefault();const msg=qs('#regMsg');msg.textContent='Creating account…';try{const {data,error}=await supabaseClient.auth.signUp({email:qs('#regEmail').value.trim(),password:qs('#regPassword').value,options:{data:{full_name:qs('#regName').value.trim()}}});if(error)throw error;msg.textContent=data.session?'Account created.':'Account created — check your email to confirm it.';}catch(err){msg.textContent=err.message;}});qs('#backLogin').addEventListener('click',()=>{render();});});
    return;
  }
  const uid=session.user.id;
  const [{data:profile},{data:orders,error:orderError},{data:addresses,error:addressError}]=await Promise.all([
    supabaseClient.from('profiles').select('id,email,full_name,phone').eq('id',uid).maybeSingle(),
    supabaseClient.from('orders').select('id,order_number,status,payment_method,payment_status,total_amount,currency,courier_name,tracking_number,created_at').eq('customer_id',uid).order('created_at',{ascending:false}),
    supabaseClient.from('addresses').select('id,label,full_name,phone,line1,line2,city,state,postal_code,country,is_default').eq('user_id',uid).order('is_default',{ascending:false}).order('created_at',{ascending:false})
  ]);
  if(orderError){area.innerHTML=`<div class="empty-state"><p>${esc(orderError.message)}</p></div>`;return;}
  const p=profile||{};
  area.innerHTML=`<div class="account-dashboard"><div class="account-top"><div><span class="eyebrow">ACCOUNT</span><h2>${esc(p.full_name||session.user.email?.split('@')[0]||'Customer')}</h2><p class="muted">${esc(session.user.email||'')}</p></div><button class="btn btn--outline" id="accountLogout">Sign out</button></div>
  <div class="account-stats"><div><strong>${orders?.length||0}</strong><span>Orders</span></div><div><strong>${addresses?.length||0}</strong><span>Saved addresses</span></div><div><strong>${state.wishlist.size||0}</strong><span>Wishlist items</span></div></div><section class="account-panel account-panel--full notification-panel"><div class="section-head"><div><h3>Notifications</h3><p class="muted">Order, payment, shipping and return updates.</p></div><button type="button" class="btn btn--outline btn--sm" id="markAllNotificationsRead">Mark all as read</button></div><div id="accountNotifications"><div class="empty-state">Loading notifications…</div></div></section>
  <div class="account-panels"><section class="account-panel"><div class="section-head"><div><h3>Profile</h3><p class="muted">Keep your contact details up to date.</p></div></div><form id="profileForm" class="account-form"><div class="form-grid"><div class="form-group"><label>Full name</label><input id="profileName" value="${esc(p.full_name||'')}" required></div><div class="form-group"><label>Phone</label><input id="profilePhone" value="${esc(p.phone||'')}" inputmode="tel"></div></div><button class="btn btn--primary">Save profile</button><span id="profileMsg" class="form-msg"></span></form></section>
  <section class="account-panel"><div class="section-head"><div><h3>Saved addresses</h3><p class="muted">Use these details faster at checkout.</p></div><button type="button" class="btn btn--outline" id="addAddress">+ Add address</button></div><div id="addressList">${renderAddresses(addresses||[])}</div><div id="addressFormWrap"></div></section>
  <section class="account-panel account-panel--full"><div class="section-head"><div><h3>My orders</h3><p class="muted">Your latest orders and delivery status.</p></div><a href="/track-order/" class="btn btn--outline" data-link>Track order</a></div>${(orders||[]).length?(orders||[]).map(o=>`<a class="order-card" href="/order/${encodeURIComponent(o.order_number)}" data-link><div><strong>${esc(o.order_number)}</strong><span>${new Date(o.created_at).toLocaleString()}</span></div><div><span class="badge badge--status">${esc(o.status)}</span><strong>${formatStoredOrderMoney(o.total_amount,o.currency)}</strong></div></a>`).join(''):`<div class="empty-state"><h3>No orders yet</h3><p>Your orders will appear here after checkout.</p><a href="/catalog/" class="btn btn--primary" data-link>Start shopping</a></div>`}</section></div></div>`;
  qs('#accountLogout')?.addEventListener('click',async()=>{await supabaseClient.auth.signOut();render();});
  qs('#profileForm')?.addEventListener('submit',async e=>{e.preventDefault();const msg=qs('#profileMsg');msg.textContent='Saving…';const {error}=await supabaseClient.from('profiles').update({full_name:qs('#profileName').value.trim(),phone:qs('#profilePhone').value.trim()}).eq('id',uid);msg.textContent=error?error.message:'Profile saved.';});
  async function loadAccountNotifications(){
    const wrap=qs('#accountNotifications'); if(!wrap)return;
    const {data,error}=await supabaseClient.from('notifications').select('id,type,title,body,order_id,return_id,read_at,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(30);
    if(error){wrap.innerHTML=`<div class="empty-state"><p>${esc(error.message)}</p></div>`;return;}
    wrap.innerHTML=(data||[]).length?(data||[]).map(n=>`<div class="notification-card ${n.read_at?'':'is-unread'}"><div><span class="badge">${esc(n.type)}</span><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p><small>${new Date(n.created_at).toLocaleString()}</small></div>${n.read_at?'':'<button type="button" class="btn btn--outline btn--sm" data-read-notification="'+esc(n.id)+'">Mark read</button>'}</div>`).join(''):'<div class="empty-state"><p>No notifications yet.</p></div>';
    wrap.querySelectorAll('[data-read-notification]').forEach(btn=>btn.addEventListener('click',async()=>{await supabaseClient.rpc('mark_notification_read',{p_notification_id:btn.dataset.readNotification});loadAccountNotifications();}));
  }
  qs('#markAllNotificationsRead')?.addEventListener('click',async()=>{await supabaseClient.rpc('mark_all_notifications_read');loadAccountNotifications();});
  loadAccountNotifications();
  qs('#addAddress')?.addEventListener('click',()=>showAddressForm(uid,null));
  qs('#addAddressInline')?.addEventListener('click',()=>showAddressForm(uid,null));
  qs('#addressList')?.querySelectorAll('[data-edit-address]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.getAttribute('data-edit-address');showAddressForm(uid,(addresses||[]).find(x=>String(x.id)===String(id)));}));
  qs('#addressList')?.querySelectorAll('[data-delete-address]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Delete this saved address?'))return;const {error}=await supabaseClient.from('addresses').delete().eq('id',btn.getAttribute('data-delete-address')).eq('user_id',uid);if(error)alert(error.message);else wireAccount();}));
}
function renderAddresses(list){if(!list.length)return `<div class="empty-state"><p>No saved addresses yet.</p><button type="button" class="btn btn--primary" id="addAddressInline">Add your first address</button></div>`;return list.map(a=>`<div class="address-card"><div><div class="address-card__head"><strong>${esc(a.label||'Address')}</strong>${a.is_default?'<span class="badge">Default</span>':''}</div><p>${esc(a.full_name)} · ${esc(a.phone)}</p><p>${esc(a.line1)}${a.line2?`, ${esc(a.line2)}`:''}, ${esc(a.city)}${a.state?', '+esc(a.state):''}${a.postal_code?' '+esc(a.postal_code):''}</p></div><div class="address-actions"><button type="button" class="btn btn--outline btn--sm" data-edit-address="${esc(a.id)}">Edit</button><button type="button" class="btn btn--outline btn--sm" data-delete-address="${esc(a.id)}">Delete</button></div></div>`).join('');}
function showAddressForm(uid,address){const wrap=qs('#addressFormWrap');if(!wrap)return;const a=address||{};wrap.innerHTML=`<form id="addressForm" class="account-form address-form"><div class="section-head"><div><h3>${address?'Edit address':'Add address'}</h3></div><button type="button" class="btn btn--outline btn--sm" id="cancelAddress">Cancel</button></div><div class="form-grid"><div class="form-group"><label>Label</label><input id="addrLabel" value="${esc(a.label||'Home')}" required></div><div class="form-group"><label>Full name</label><input id="addrName" value="${esc(a.full_name||'')}" required></div><div class="form-group"><label>Phone</label><input id="addrPhone" value="${esc(a.phone||'')}" required inputmode="tel"></div><div class="form-group form-grid__full"><label>Address line</label><input id="addrLine1" value="${esc(a.line1||'')}" required></div><div class="form-group form-grid__full"><label>Apartment / area (optional)</label><input id="addrLine2" value="${esc(a.line2||'')}"></div><div class="form-group"><label>City</label><input id="addrCity" value="${esc(a.city||'')}" required></div><div class="form-group"><label>State / province</label><input id="addrState" value="${esc(a.state||'Punjab')}"></div><div class="form-group"><label>Postal code</label><input id="addrPostal" value="${esc(a.postal_code||'')}"></div><div class="form-group"><label>Country</label><input id="addrCountry" value="${esc(a.country||'Pakistan')}" required></div></div><label class="check-row"><input id="addrDefault" type="checkbox" ${a.is_default?'checked':''}> Make default address</label><button class="btn btn--primary">Save address</button><span id="addrMsg" class="form-msg"></span></form>`;qs('#cancelAddress').addEventListener('click',()=>{wrap.innerHTML='';});qs('#addressForm').addEventListener('submit',async e=>{e.preventDefault();const msg=qs('#addrMsg');msg.textContent='Saving…';const payload={user_id:uid,label:qs('#addrLabel').value.trim(),full_name:qs('#addrName').value.trim(),phone:qs('#addrPhone').value.trim(),line1:qs('#addrLine1').value.trim(),line2:qs('#addrLine2').value.trim()||null,city:qs('#addrCity').value.trim(),state:qs('#addrState').value.trim()||null,postal_code:qs('#addrPostal').value.trim()||null,country:qs('#addrCountry').value.trim(),is_default:qs('#addrDefault').checked};if(payload.is_default)await supabaseClient.from('addresses').update({is_default:false}).eq('user_id',uid);const q=address?supabaseClient.from('addresses').update(payload).eq('id',address.id).eq('user_id',uid):supabaseClient.from('addresses').insert(payload);const {error}=await q;if(error){msg.textContent=error.message;return;}wireAccount();});}

function viewTrackOrder(){return `<div class="container section"><div class="page-head"><h1>Track your order</h1><p>Enter the order number and the phone number used at checkout.</p></div><form id="trackForm" class="account-form"><div class="form-group"><label>Order number</label><input id="trackNumber" required placeholder="ZM-20260903-XXXXXXXX"></div><div class="form-group"><label>Phone number</label><input id="trackPhone" type="tel" required placeholder="03xx-xxxxxxx"></div><button class="btn btn--primary btn--block">Track order</button><p id="trackMsg" class="form-msg"></p></form><div id="trackResult"></div></div>`;}
function statusSteps(current){const steps=['pending','confirmed','processing','packed','shipped','delivered'];const idx=steps.indexOf(current);return `<div class="status-timeline">${steps.map((s,i)=>`<div class="status-step ${i<=idx?'done':''} ${s===current?'current':''}"><span>${i<=idx?'✓':i+1}</span><strong>${s[0].toUpperCase()+s.slice(1)}</strong></div>`).join('')}</div>`;}
function formatStoredOrderMoney(amount,currency){
  const code=String(currency||"PKR").toUpperCase();
  const m=Object.values(MARKET_CONFIG).find(x=>x.currency===code);
  if(m) return marketMoney(amount,m);
  return code+" "+Number(amount||0).toLocaleString();
}
function renderOrderData(payload){const o=payload?.order,items=payload?.items||[],history=payload?.history||[];if(!o)return '<div class="empty-state">Order not found.</div>';return `<div class="order-detail"><div class="order-detail-head"><div><div class="muted">Order</div><h2>${esc(o.order_number)}</h2><div class="muted">${new Date(o.created_at).toLocaleString()}</div></div><span class="badge badge--status">${esc(o.status)}</span></div>${statusSteps(o.status)}<div class="order-detail-grid"><div class="box"><h3>Items</h3>${items.map(i=>`<div class="order-item"><div><strong>${esc(i.product_name)}</strong><div class="muted">${i.sku?esc(i.sku)+' · ':''}Qty ${i.quantity}</div></div><strong>${formatStoredOrderMoney(i.line_total,o.currency)}</strong></div>`).join('')}</div><div class="box"><h3>Payment</h3><p><strong>${esc(o.payment_method||'')}</strong></p><p>Status: <span class="badge">${esc(o.payment_status||'pending')}</span></p><div class="summary-line"><span>Subtotal</span><strong>${formatStoredOrderMoney(o.subtotal,o.currency)}</strong></div><div class="summary-line"><span>Shipping</span><strong>${formatStoredOrderMoney(o.shipping_cost,o.currency)}</strong></div><div class="summary-total"><span>Total</span><strong>${formatStoredOrderMoney(o.total_amount,o.currency)}</strong></div></div></div><div class="box"><h3>Delivery</h3><p>${esc(o.shipping_name||'')} · ${esc(o.shipping_address||'')}</p>${o.courier_name||o.tracking_number?`<p><strong>${esc(o.courier_name||'Courier')}</strong>${o.tracking_number?` · Tracking: <strong>${esc(o.tracking_number)}</strong>`:''}</p>`:''}</div><div class="box"><h3>Status history</h3>${history.map(h=>`<div class="history-row"><span>${new Date(h.created_at).toLocaleString()}</span><strong>${esc(h.status)}</strong><span>${esc(h.note||'')}</span></div>`).join('')}</div>${o.status==='delivered' && o.customer_id?`<div class="box return-request-box"><h3>Request a return</h3><p class="muted">Eligible delivered items can be selected below. Refunds are reviewed by the store team.</p><form id="returnRequestForm"><div class="return-items">${items.map(i=>`<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" data-return-item="${esc(i.id)}" data-max-qty="${Number(i.quantity||1)}"> <span>${esc(i.product_name)} · Qty ${Number(i.quantity||1)}</span><input type="number" min="1" max="${Number(i.quantity||1)}" value="1" data-return-qty="${esc(i.id)}" style="max-width:90px"></label>`).join('')}</div><label>Reason</label><select id="returnReason" required><option value="">Select a reason…</option><option>Damaged or defective</option><option>Wrong item received</option><option>Item not as described</option><option>Other</option></select><label>Additional note</label><textarea id="returnNote" rows="3" maxlength="500" placeholder="Optional details"></textarea><button class="btn btn--primary" type="submit">Submit return request</button><p id="returnMsg" class="form-msg"></p></form></div>`:''}</div>`;} 
async function lookupOrder(number,phone){const {data,error}=await supabaseClient.rpc('track_order_secure',{p_order_number:number,p_phone:phone});if(error)throw error;return data;}
function wireTrackOrder(){qs('#trackForm')?.addEventListener('submit',async e=>{e.preventDefault();const msg=qs('#trackMsg'),result=qs('#trackResult');msg.textContent='Looking up order…';result.innerHTML='';try{const data=await lookupOrder(qs('#trackNumber').value.trim(),qs('#trackPhone').value.trim());msg.textContent='';result.innerHTML=renderOrderData(data);}catch(err){msg.textContent=err.message;}});}
function viewOrderDetail(number){return `<div class="container section"><div id="orderDetailMount" class="empty-state">Loading order…</div></div>`;}
function wireOrderDetail(number){getAuthSession().then(async session=>{if(!session){qs('#orderDetailMount').innerHTML=`<div class="account-form"><h2>Track order</h2><p>For privacy, please verify the phone number used for this order.</p><form id="inlineTrack"><input id="inlinePhone" type="tel" required placeholder="Phone number"><button class="btn btn--primary btn--block">View order</button><p id="inlineMsg" class="form-msg"></p></form></div>`;qs('#inlineTrack').addEventListener('submit',async e=>{e.preventDefault();try{const d=await lookupOrder(number,qs('#inlinePhone').value.trim());qs('#orderDetailMount').outerHTML=renderOrderData(d);}catch(err){qs('#inlineMsg').textContent=err.message;}});return;}const {data,error}=await supabaseClient.from('orders').select('*').eq('order_number',number).eq('customer_id',session.user.id).limit(1);if(error||!data?.[0]){qs('#orderDetailMount').innerHTML='<div class="empty-state"><h2>Order not found</h2><p>This order is not linked to your account.</p></div>';return;}const o=data[0];const [{data:items},{data:history}]=await Promise.all([supabaseClient.from('order_items').select('*').eq('order_id',o.id),supabaseClient.from('order_status_history').select('*').eq('order_id',o.id).order('created_at')]);qs('#orderDetailMount').outerHTML=renderOrderData({order:o,items,history}); const rf=qs('#returnRequestForm'); if(rf){rf.addEventListener('submit',async e=>{e.preventDefault();const msg=qs('#returnMsg');try{const selected=[...document.querySelectorAll('[data-return-item]:checked')].map(cb=>({order_item_id:cb.getAttribute('data-return-item'),quantity:Number(qs('[data-return-qty=\"'+cb.getAttribute('data-return-item')+'\"]')?.value||1)}));if(!selected.length)throw new Error('Select at least one item.');const {data,error}=await supabaseClient.rpc('request_return_secure',{p_order_id:o.id,p_reason:qs('#returnReason').value,p_note:qs('#returnNote').value.trim()||null,p_items:selected});if(error)throw error;msg.textContent=`Return request ${data?.return_number||''} submitted successfully.`;rf.reset();}catch(err){msg.textContent=err.message||'Could not submit return request.';}});} });}

/* ---------- VIEW: CONTACT ---------- */
function viewContact(){
  return `
  <div class="container section">
    <div class="page-head"><h1>Get in touch</h1><p>Questions about an order, a product, or a return? We usually reply within a few hours.</p></div>
    <div class="contact-layout">
      <div>
        <div class="contact-info-item">
          <div class="icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.8"/><path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.8"/></svg></div>
          <div><h4>Email</h4><p>support@zmhybridstore.example</p></div>
        </div>
        <div class="contact-info-item">
          <div class="icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5c0 8 7 15 15 15l3-4-6-3-2 2c-2-1-4-3-5-5l2-2-3-6-4 0z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
          <div><h4>Phone / WhatsApp</h4><p>+92 307 3659140</p></div>
        </div>
        <div class="contact-info-item">
          <div class="icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg></div>
          <div><h4>Hours</h4><p>Mon–Sat, 10am–7pm</p></div>
        </div>
      </div>
      <form id="contactForm">
        <div class="form-group"><label>Name</label><input required></div>
        <div class="form-group"><label>Email</label><input type="email" required></div>
        <div class="form-group"><label>Message</label><textarea rows="5" required placeholder="How can we help?"></textarea></div>
        <button type="submit" class="btn btn--primary btn--block">Send message</button>
        <p id="contactMsg" style="margin-top:12px;font-size:.85rem;color:var(--ink-soft);"></p>
      </form>
    </div>
  </div>`;
}
function wireContact(){
  const form = qs("#contactForm");
  form.addEventListener("submit", e => {
    e.preventDefault();
    qs("#contactMsg").textContent = "Thanks — your message has been sent. We'll get back to you soon.";
    form.reset();
  });
}

/* ---------- VIEW: POLICY PAGES ---------- */
const POLICY = {
  privacy:{title:"Privacy Policy",body:`<h3>Information we collect</h3><p>When you place an order or contact us, we may collect your name, phone number, email address, shipping address, city and order details needed to fulfil your request.</p><h3>How we use information</h3><p>We use order information to process and deliver orders, provide customer support, handle returns and improve the store. We do not sell customer information.</p><h3>WhatsApp and service providers</h3><p>If you choose WhatsApp confirmation, relevant order details are shared with the WhatsApp account you contact. Payment, hosting, analytics or delivery providers may process information only as needed to provide their services.</p><h3>Cookies and local storage</h3><p>This storefront uses browser local storage for cart and wishlist preferences. Optional analytics may be enabled later using the IDs configured by the store owner.</p><h3>Contact</h3><p>For privacy questions, contact the store through the contact page or the published support details.</p>`},
  terms:{title:"Terms & Conditions",body:`<h3>Orders</h3><p>An order request is subject to product availability and confirmation. Prices and promotions may change before an order is confirmed.</p><h3>Payment</h3><p>Cash on delivery is available where supported. JazzCash, Easypaisa and bank-transfer orders are treated as prepaid/manual-confirmation methods until a payment is verified.</p><h3>Products</h3><p>Product descriptions are provided to help customers make informed choices. Actual product photos, specifications and availability should be verified before launch for each SKU.</p><h3>Returns</h3><p>Returns are governed by the current Returns & Exchanges policy. Items must meet the stated eligibility requirements.</p><h3>Changes</h3><p>These terms may be updated as the store, payment methods and fulfilment arrangements change.</p>`},
  shipping:{title:"Shipping & delivery",body:`<h3>Delivery timelines</h3><p>Orders normally ship within 24 hours of confirmation and typically arrive in 2–5 business days depending on the destination and courier.</p><h3>Shipping cost</h3><p>Shipping is currently advertised as free nationwide. If this changes for a particular promotion or destination, the applicable charge will be shown before confirmation.</p><h3>Tracking</h3><p>Where courier tracking is available, tracking details will be shared after dispatch.</p>`},
  returns:{title:"Returns & exchanges",body:`<h3>Return window</h3><p>Eligible items may be returned within 7 days of delivery when unused and in original packaging.</p><h3>How to start a return</h3><p>Contact support with your order number and reason for return. We will confirm eligibility and the next steps.</p><h3>Refunds</h3><p>Approved refunds are processed after the returned item is received and inspected. Timing depends on the original payment method.</p>`},
  faq:{title:"Frequently asked questions",body:`<h3>Do you offer cash on delivery?</h3><p>Yes, COD is available nationwide where courier service supports it.</p><h3>How do I pay by JazzCash or Easypaisa?</h3><p>Select the relevant method at checkout. The order is then confirmed through WhatsApp and payment instructions can be provided manually.</p><h3>How do I track my order?</h3><p>Tracking details are shared after dispatch when available.</p><h3>Can I change my order?</h3><p>Contact support as soon as possible after ordering; changes are only possible before dispatch.</p>`}
};
function viewPolicy(key){
  const p = POLICY[key] || { title:"Not found", body:"<p>This page doesn't exist.</p>" };
  return `<div class="container section"><div class="page-head"><h1>${p.title}</h1></div><div class="policy-body">${p.body}</div></div>`;
}

/* ---------- CART DRAWER CONTROLS ---------- */
function openCartDrawer(){ qs("#cartDrawer").classList.add("open"); qs("#drawerOverlay").classList.add("open"); }
function closeCartDrawer(){ qs("#cartDrawer").classList.remove("open"); qs("#drawerOverlay").classList.remove("open"); }
qs("#cartToggle").addEventListener("click", () => { renderCartDrawer(); openCartDrawer(); });
qs("#cartClose").addEventListener("click", closeCartDrawer);
qs("#drawerOverlay").addEventListener("click", closeCartDrawer);

/* ---------- SEARCH ---------- */
function closeSearch(){ qs("#searchBar").classList.remove("open"); }
qs("#searchToggle").addEventListener("click", () => {
  qs("#searchBar").classList.toggle("open");
  if(qs("#searchBar").classList.contains("open")) qs("#searchInput").focus();
});
function doSearch(){
  const q = qs("#searchInput").value.trim();
  if(!q) return;
  history.pushState({}, "", "/catalog/?q=" + encodeURIComponent(q)); render();
}
qs("#searchGo").addEventListener("click", doSearch);
qs("#searchInput").addEventListener("keydown", e => { if(e.key === "Enter") doSearch(); });
function refreshSearchSuggestions(){
  const input=qs("#searchInput"); if(!input) return;
  let box=qs("#searchSuggestions");
  if(!box){ box=document.createElement("div"); box.id="searchSuggestions"; box.className="search-suggestions"; input.parentElement.appendChild(box); }
  const q=input.value.trim().toLowerCase();
  if(!q){ box.innerHTML=""; box.classList.remove("open"); return; }
  const matches=PRODUCTS.filter(p=>`${p.title} ${p.sku||""} ${p.brand||""}`.toLowerCase().includes(q)).slice(0,6);
  box.innerHTML=matches.map(p=>`<a href="${productPath(p)}" data-link><span>${esc(p.title)}</span><small>${rupees(p.price)}</small></a>`).join("") || `<div class="search-no-results">No matching products</div>`;
  box.classList.add("open");
  qsa("[data-link]",box).forEach(a=>a.addEventListener("click",()=>{ box.classList.remove("open"); }));
}
qs("#searchInput").addEventListener("input", refreshSearchSuggestions);
qs("#searchInput").addEventListener("focus", refreshSearchSuggestions);
document.addEventListener("click",e=>{ const b=qs("#searchSuggestions"); if(b && !e.target.closest("#searchBar")) b.classList.remove("open"); });


/* ---------- WISHLIST TOGGLE (header icon just jumps to catalog view for now) ---------- */
qs("#wishToggle").addEventListener("click", () => { history.pushState({}, "", "/wishlist/"); render(); });

/* ---------- MOBILE NAV ---------- */
qs("#navToggle").addEventListener("click", () => {
  qs("#mainNav").classList.toggle("open-mobile");
});
document.addEventListener("click", e => {
  if(e.target.closest(".main-nav a")) qs("#mainNav").classList.remove("open-mobile");
});

/* ---------- NEWSLETTER ---------- */
const newsletterForm = qs("#newsletterForm");
if (newsletterForm) newsletterForm.addEventListener("submit", e => {
  e.preventDefault();
  const msg = qs("#newsletterMsg");
  if (msg) msg.textContent = "You're subscribed — welcome!";
  e.target.reset();
});

/* ---------- GLOBAL LINK HANDLER (keeps drawers/menus in sync) ---------- */
document.addEventListener("click", e => {
  const link = e.target.closest("[data-link]");
  if(link){ closeCartDrawer(); }
});

/* ---------- FLOATING WHATSAPP BUTTON ---------- */
const waFloat = qs("#waFloat");
if (waFloat) waFloat.href = `https://wa.me/${String(STORE_CMS.whatsapp_number||CONFIG.WHATSAPP_NUMBER).replace(/\D/g,"")}?text=${encodeURIComponent("Hi! I have a question about a product on ZM Hybrid Store.")}`;

/* ---------- AFFILIATE ATTRIBUTION ---------- */
(function captureAffiliateReferral(){
  try{
    const p=new URLSearchParams(location.search);
    const code=(p.get("ref")||p.get("affiliate")||"").trim().toUpperCase();
    if(!code) return;
    const productId=(p.get("product_id")||p.get("id")||"").trim() || null;
    const data={code,productId,expiresAt:Date.now()+30*24*60*60*1000};
    localStorage.setItem("zm_affiliate_referral",JSON.stringify(data));
    if(supabaseClient) supabaseClient.rpc("record_affiliate_click",{p_code:code,p_product_id:productId,p_landing_path:location.pathname+location.search}).catch(()=>{});
  }catch(_){}
})();
function getAffiliateReferral(){
  try{ const x=JSON.parse(localStorage.getItem("zm_affiliate_referral")||"null"); if(!x||!x.code||Number(x.expiresAt||0)<Date.now()){localStorage.removeItem("zm_affiliate_referral");return "";} return String(x.code).toUpperCase(); }catch(_){return "";}
}

/* ---------- MARKETING ATTRIBUTION ---------- */
(function captureCampaignAttribution(){
  try{
    const p=new URLSearchParams(location.search); const keys=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"];
    const data={}; let found=false; keys.forEach(k=>{const v=p.get(k);if(v){data[k]=v;found=true;}});
    if(found) sessionStorage.setItem("zm_campaign_attribution",JSON.stringify(data));
  }catch(_){ }
})();

/* ---------- STABLE BOOTSTRAP + CONVERSION UX ---------- */
function renderBootError(err){
  console.error("ZM storefront render error", err);
  const app=qs("#app");
  if(app && !app.innerHTML.trim()) app.innerHTML=`<section class="section container"><div class="store-error"><h2>Storefront is loading</h2><p>Please refresh once. Your cart and account are safe.</p><button class="btn btn--primary" type="button" onclick="location.reload()">Refresh store</button></div></section>`;
}
window.addEventListener("error", e => { if(!qs("#app")?.innerHTML.trim()) renderBootError(e.error||new Error(e.message)); });
window.addEventListener("unhandledrejection", e => { if(!qs("#app")?.innerHTML.trim()) renderBootError(e.reason||new Error("Unexpected storefront error")); });
try {
  const actions=document.querySelector(".header-actions");
  if(actions && !document.querySelector("#marketSwitcherWrap")){
    const wrap=document.createElement("label"); wrap.id="marketSwitcherWrap"; wrap.className="market-switcher"; wrap.title="Choose your shopping country and currency";
    wrap.innerHTML=`<span class="market-switcher__globe">🌐</span><select id="marketSwitcher" aria-label="Shopping country">${marketOptions()}</select>`;
    actions.insertBefore(wrap, actions.firstElementChild);
    document.querySelector("#marketSwitcher").addEventListener("change",e=>setMarket(e.target.value));
  }
  renderCartBadges(); renderCartDrawer(); render();
} catch(err) { renderBootError(err); }
document.addEventListener("click", e => {
  const link=e.target.closest("a[data-link]"); if(!link) return;
  const href=link.getAttribute("href"); if(!href || href.startsWith("#") || href.startsWith("http")) return;
  e.preventDefault(); history.pushState({}, "", href); try { render(); } catch(err) { renderBootError(err); }
});
(async()=>{
  try { await Promise.allSettled([loadStoreCMS(),loadShippingOptions(),loadProductsFromSupabase()]);
    try { render(); } catch(err) { renderBootError(err); }
    document.documentElement.dataset.catalogReady="true";
  } catch(err) { renderBootError(err); }
})();
window.ZMStorefront={refresh:()=>{try{render();}catch(e){renderBootError(e);}}};
