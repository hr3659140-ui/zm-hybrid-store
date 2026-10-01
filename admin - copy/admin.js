const SUPABASE_URL="https://iqgoclijgicgzncrjqqt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_pmKqaLISXQHNJD7GidkErw_etZeZ1KU";
const PRODUCT_BUCKET="product-images";
let currentSession=null,currentRole=null,currentTab="dashboard";
const $=s=>document.querySelector(s);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(msg,error=true){const el=$("#configStatus");el.hidden=false;el.textContent=msg;el.classList.toggle("error",error)}
function setBusy(v){const b=$("#loginButton");b.disabled=v;b.textContent=v?"Signing in…":"Login"}
function timeoutFetch(url,options={},ms=20000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(url,{...options,signal:c.signal}).finally(()=>clearTimeout(t))}
async function readJson(r){try{return await r.json()}catch{return {}}}
async function authLogin(email,password){const r=await timeoutFetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({email,password})},15000);const j=await readJson(r);if(!r.ok)throw new Error(j.error_description||j.msg||j.message||"Invalid email or password.");if(!j.access_token)throw new Error("Supabase did not return a session.");return {token:j.access_token,refresh_token:j.refresh_token||null,user_id:j.user?.id||null,email:j.user?.email||email,expires_at:Date.now()+Number(j.expires_in||3600)*1000}}
async function refreshAdminSession(){if(!currentSession?.refresh_token)throw new Error("Session expired. Please login again.");const r=await timeoutFetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({refresh_token:currentSession.refresh_token})},15000);const j=await readJson(r);if(!r.ok||!j.access_token)throw new Error(j.error_description||j.msg||j.message||"Session refresh failed.");currentSession={...currentSession,token:j.access_token,refresh_token:j.refresh_token||currentSession.refresh_token,user_id:j.user?.id||currentSession.user_id,email:j.user?.email||currentSession.email,expires_at:Date.now()+Number(j.expires_in||3600)*1000};localStorage.setItem("zm_admin_session",JSON.stringify(currentSession));return currentSession}
async function ensureAdminSession(){if(!currentSession?.token)throw new Error("Session expired. Please login again.");if(currentSession.expires_at && currentSession.expires_at-Date.now()<120000){await refreshAdminSession();}}
async function api(path,{method="GET",body=null,headers={},_retried=false}={}){await ensureAdminSession();const r=await timeoutFetch(SUPABASE_URL+"/rest/v1/"+path,{method,headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+currentSession.token,Accept:"application/json",...(body!=null?{"Content-Type":"application/json"}:{}),...headers},body:body==null?undefined:JSON.stringify(body)},20000);if(r.status===401&&!_retried){await refreshAdminSession();return api(path,{method,body,headers,_retried:true})}if(r.status===401){clearSession();throw new Error("Session expired. Please login again.")}const j=await readJson(r);if(!r.ok)throw new Error(j.message||j.error_description||j.hint||j.details||`Request failed (${r.status})`);return {data:j,headers:r.headers,status:r.status}}
async function getRole(){const {data}=await api("profiles?select=id,email,full_name,role&id=eq."+encodeURIComponent(currentSession.user_id)+"&limit=1");const p=data?.[0];if(!p||!['admin','manager'].includes(p.role))throw new Error("This account is not authorized for the admin panel.");return p}

const SITE_ORIGIN = location.origin;
const PASSWORD_RESET_URL = SITE_ORIGIN + "/admin/update-password/";
async function requestPasswordReset(){
  const email=$("#email").value.trim().toLowerCase();
  if(!email){ status("Enter your admin email first."); $("#email").focus(); return; }
  try{
    status("Sending password reset email…",false);
    const r=await timeoutFetch(SUPABASE_URL+"/auth/v1/recover",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({email,redirect_to:PASSWORD_RESET_URL})},15000);
    const j=await readJson(r);
    if(!r.ok) throw new Error(j.error_description||j.msg||j.message||"Could not send reset email.");
    status("Reset email sent. Check your inbox and use the newest link.",false);
  }catch(e){ status("Reset failed: "+(e?.name==="AbortError"?"Request timed out. Try again.":e.message)); }
}
if($("#forgotPassword")) $("#forgotPassword").onclick=requestPasswordReset;

function clearSession(){localStorage.removeItem("zm_admin_session");currentSession=null;currentRole=null}
function showApp(){$("#loginView").hidden=true;$("#appView").hidden=false;$("#roleLabel").textContent=currentRole?.role||"Admin";document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===currentTab));loadTab("dashboard")}
async function login(){setBusy(true);status("Signing in securely…",false);try{const email=$("#email").value.trim().toLowerCase(),password=$("#password").value;if(!email||!password)throw new Error("Email and password are required.");currentSession=await authLogin(email,password);currentRole=await getRole();localStorage.setItem("zm_admin_session",JSON.stringify(currentSession));$("#configStatus").hidden=true;showApp();if(location.hash.includes("import="))loadTab("aliexpress")}catch(e){clearSession();status("Login failed: "+(e?.name==="AbortError"?"Request timed out. Try again.":e.message))}finally{setBusy(false)}}
$("#loginForm").addEventListener("submit",e=>{e.preventDefault();login()});$("#logout").onclick=()=>{clearSession();location.reload()};document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>loadTab(b.dataset.tab));$("#newProduct").onclick=()=>productForm();
async function restore(){const raw=localStorage.getItem("zm_admin_session");if(!raw)return;try{currentSession=JSON.parse(raw);if(!currentSession?.token)throw 0;if(currentSession.expires_at<Date.now()){await refreshAdminSession();}else if(currentSession.expires_at-Date.now()<120000){await refreshAdminSession();}currentRole=await getRole();showApp();if(location.hash.includes("import="))loadTab("aliexpress")}catch{clearSession()}}
setInterval(()=>{if(currentSession?.refresh_token)refreshAdminSession().catch(()=>{});},10*60*1000);


async function finance(){
  const [{data:c},{data:m},{data:r}]=await Promise.all([
    api("store_payout_currencies?select=country_code,country_name,currency_code,rate_from_pkr,minimum_amount&active=eq.true&order=country_name.asc"),
    api("store_payout_methods?select=country_code,currency_code,method_code,method_name&active=eq.true&order=country_code.asc,method_name.asc"),
    api("store_payout_requests?select=id,country_code,currency_code,method_code,method_name,amount,base_amount_pkr,status,payout_details,payout_reference,requested_at,processed_at,admin_note&order=requested_at.desc&limit=500")
  ]);
  const currencies=c||[], methods=m||[], requests=r||[];
  let bal={available_balance_pkr:0,gross_collected_pkr:0,refunds_pkr:0,affiliate_commissions_reserved_pkr:0,owner_withdrawals_pkr:0};
  try{const q=await api("rpc/store_finance_summary",{method:"POST",body:{}}); if(q.data) bal=Array.isArray(q.data)?(q.data[0]||bal):q.data;}catch(e){console.warn(e)}
  const curOpts=currencies.map(x=>`<option value="${esc(x.country_code)}">${esc(x.country_name)} — ${esc(x.currency_code)}</option>`).join('');
  const fmt=(n,cc='PKR')=>`${esc(cc)} ${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:cc==='KWD'?3:2,maximumFractionDigits:cc==='KWD'?3:2})}`;
  const rows=requests.map(x=>`<tr><td>${new Date(x.requested_at).toLocaleString()}</td><td>${esc(x.country_code)} / ${esc(x.currency_code)}</td><td>${esc(x.method_name)}</td><td>${fmt(x.amount,x.currency_code)}</td><td>${esc(x.payout_details||'')}</td><td><span class="badge">${esc(x.status)}</span></td><td>${x.status==='pending'?`<button onclick="storePayoutStatus('${x.id}','processing')">Processing</button> <button onclick="storePayoutStatus('${x.id}','rejected')">Reject</button>`:x.status==='processing'?`<button onclick="storePayoutStatus('${x.id}','paid')">Mark Paid</button>`:x.status==='paid'?esc(x.payout_reference||'Paid'):'—'}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">No store withdrawal requests yet.</td></tr>';
  const html=`<div class="grid" style="margin-bottom:16px">
    <div class="stat"><span>Available to Withdraw</span><strong>${money(bal.available_balance_pkr)}</strong><small class="muted">Internal store balance</small></div>
    <div class="stat"><span>Gross Collected</span><strong>${money(bal.gross_collected_pkr)}</strong><small class="muted">Paid orders</small></div>
    <div class="stat"><span>Refunds</span><strong>${money(bal.refunds_pkr)}</strong><small class="muted">Refunded returns</small></div>
    <div class="stat"><span>Affiliate Reserve</span><strong>${money(bal.affiliate_commissions_reserved_pkr)}</strong><small class="muted">Pending/approved/paid commissions</small></div>
  </div>
  <div class="box"><div class="page-head"><div><h2>Store Finance & Withdrawals</h2><p class="muted">Track collected store funds and record owner withdrawals. Actual money movement is completed through your bank/payment provider.</p></div></div>
    <div class="form-grid">
      <label>Country<select id="sfCountry">${curOpts}</select></label>
      <label>Currency<input id="sfCurrency" readonly></label>
      <label>Payout method<select id="sfMethod"></select></label>
      <label>Amount<input id="sfAmount" type="number" min="0" step="0.01" placeholder="Amount in selected currency"></label>
      <label>Payout details<textarea id="sfDetails" rows="3" placeholder="Bank account / IBAN / PayPal email / wallet details"></textarea></label>
      <label>Note (optional)<textarea id="sfNote" rows="3" placeholder="Internal note"></textarea></label>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="primary" id="sfWithdraw" type="button">Request Store Withdrawal</button><span id="sfMsg" class="muted"></span></div>
    <p class="muted small" style="margin-top:12px">The dashboard balance is calculated in PKR and converted using the configured country rate. This does not automatically pull money from Stripe, PayPal, a bank, JazzCash or Easypaisa.</p>
  </div>
  <div class="box" style="margin-top:16px"><h3>Store Withdrawal History</h3><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Country / Currency</th><th>Method</th><th>Amount</th><th>Details</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  $('#content').innerHTML=html;
  const country=$('#sfCountry'), currency=$('#sfCurrency'), method=$('#sfMethod'), amount=$('#sfAmount');
  function refreshMethods(){const ccode=country.value;const cur=currencies.find(x=>x.country_code===ccode);currency.value=cur?.currency_code||'';method.innerHTML=methods.filter(x=>x.country_code===ccode).map(x=>`<option value="${esc(x.method_code)}">${esc(x.method_name)}</option>`).join('');}
  country.onchange=refreshMethods; refreshMethods();
  $('#sfWithdraw').onclick=async()=>{const ccode=country.value, cur=currencies.find(x=>x.country_code===ccode);const amt=Number(amount.value||0);const details=$('#sfDetails').value.trim();if(!cur){return alert('Select a country.')}if(!amt||amt<=0)return alert('Enter a valid withdrawal amount.');if(!details)return alert('Enter payout details.');const min=Number(cur.minimum_amount||0);if(amt<min)return alert(`Minimum withdrawal is ${cur.currency_code} ${min}`);if(!confirm(`Request ${cur.currency_code} ${amt.toLocaleString()} store withdrawal?`))return;$('#sfWithdraw').disabled=true;$('#sfMsg').textContent='Submitting…';try{const q=await api('rpc/request_store_payout',{method:'POST',body:{p_country_code:ccode,p_currency_code:cur.currency_code,p_method_code:method.value,p_payout_details:details,p_amount:amt,p_admin_note:$('#sfNote').value.trim()||null}});$('#sfMsg').textContent=`Withdrawal requested. Available balance: ${money(q.data?.available_balance_pkr||0)}`;await finance();}catch(e){$('#sfMsg').textContent=e.message;}finally{$('#sfWithdraw').disabled=false;}};
}
window.storePayoutStatus=async(id,status)=>{let ref=null;if(status==='paid'){ref=prompt('Payout reference / transaction ID:','');if(ref===null)return;}try{const body={status,processed_at:status==='paid'?new Date().toISOString():null};if(ref)body.payout_reference=ref;await api('store_payout_requests?id=eq.'+encodeURIComponent(id),{method:'PATCH',body,headers:{Prefer:'return=minimal'}});await finance();}catch(e){alert(e.message)}};
async function affiliates(){
  const [{data:a},{data:c},{data:p}]=await Promise.all([
    api("affiliates?select=id,user_id,affiliate_code,display_name,status,commission_rate,total_clicks,payout_country,payout_currency,payout_method,created_at&order=created_at.desc&limit=500"),
    api("affiliate_commissions?select=id,affiliate_id,order_id,product_id,affiliate_code,commission_rate,sale_amount,commission_amount,status,payout_reference,paid_at,created_at&order=created_at.desc&limit=1000"),
    api("affiliate_payout_requests?select=id,affiliate_id,country_code,currency_code,method_code,method_name,amount,base_amount_pkr,status,payout_details,payout_reference,requested_at,processed_at&order=requested_at.desc&limit=500")
  ]);
  const aff=a||[], comm=c||[], payouts=p||[];
  const totalPending=comm.filter(x=>x.status==='pending').reduce((n,x)=>n+Number(x.commission_amount||0),0);
  const totalApproved=comm.filter(x=>x.status==='approved').reduce((n,x)=>n+Number(x.commission_amount||0),0);
  const totalPaid=comm.filter(x=>x.status==='paid').reduce((n,x)=>n+Number(x.commission_amount||0),0);
  const rows=aff.map(x=>`<tr><td><b>${esc(x.affiliate_code)}</b><div class="muted">${esc(x.display_name||'Affiliate')}</div></td><td>${esc(x.status)}</td><td>${Number(x.total_clicks||0)}</td><td>${Number(x.commission_rate||0)}%</td><td>${comm.filter(c=>c.affiliate_id===x.id).length}</td><td class="actions"><button onclick="affiliateStatus('${x.id}','${x.status==='active'?'suspended':'active'}')">${x.status==='active'?'Suspend':'Activate'}</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No affiliates yet.</td></tr>';
  const cr=comm.slice(0,150).map(x=>`<tr><td>${esc(x.affiliate_code)}</td><td>${esc(x.order_id?.slice(0,8)||'—')}</td><td>${money(x.sale_amount)}</td><td>${money(x.commission_amount)}</td><td><span class="badge">${esc(x.status)}</span></td><td>${x.status==='approved'?`<button onclick="markAffiliatePaid('${x.id}')">Mark paid</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No commission records yet.</td></tr>';
  const payoutRows=payouts.map(x=>`<tr><td><b>${esc(x.affiliate_id?.slice(0,8)||'—')}</b></td><td>${esc(x.country_code)} / ${esc(x.currency_code)}</td><td>${esc(x.method_name)}</td><td>${esc(x.currency_code)} ${Number(x.amount||0).toFixed(x.currency_code==='KWD'?3:2)}</td><td><span class="badge">${esc(x.status)}</span></td><td>${x.status==='pending'?`<button onclick="affiliatePayoutStatus('${x.id}','approved')">Approve</button> <button onclick="affiliatePayoutStatus('${x.id}','rejected')">Reject</button>`:x.status==='approved'?`<button onclick="affiliatePayoutStatus('${x.id}','processing')">Processing</button>`:x.status==='processing'?`<button onclick="affiliatePayoutStatus('${x.id}','paid')">Mark Paid</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No withdrawal requests yet.</td></tr>';
  const html=`<div class="grid" style="margin-bottom:16px"><div class="stat"><span>Affiliates</span><strong>${aff.length}</strong></div><div class="stat"><span>Pending</span><strong>${money(totalPending)}</strong></div><div class="stat"><span>Approved</span><strong>${money(totalApproved)}</strong></div><div class="stat"><span>Paid</span><strong>${money(totalPaid)}</strong></div></div><div class="box"><div class="page-head"><div><h2>Affiliate Program</h2><p class="muted">Manage affiliate accounts, commission rates and payouts.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Affiliate</th><th>Status</th><th>Clicks</th><th>Default rate</th><th>Commissions</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="box" style="margin-top:16px"><h3>Commission Ledger</h3><p class="muted small">Commissions become approved when an order reaches Delivered. Cancelled/refunded/returned orders are reversed.</p><div class="table-wrap"><table class="table"><thead><tr><th>Affiliate</th><th>Order</th><th>Sale</th><th>Commission</th><th>Status</th><th>Action</th></tr></thead><tbody>${cr}</tbody></table></div></div><div class="box" style="margin-top:16px"><h3>Withdrawal Requests</h3><p class="muted small">Review affiliate payout requests. Details are visible only to authorized admins.</p><div class="table-wrap"><table class="table"><thead><tr><th>Affiliate</th><th>Country / Currency</th><th>Method</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>${payoutRows}</tbody></table></div></div>`;
  window.__affiliateCommissions=comm; window.__affiliates=aff; window.__affiliateLedgerMoney=money; $("#content").innerHTML=html;
}
function money(n){return 'Rs. '+Number(n||0).toLocaleString();}
window.affiliateStatus=async(id,status)=>{try{await api('affiliates?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{status},headers:{Prefer:'return=minimal'}});await affiliates();}catch(e){alert(e.message)}};
window.markAffiliatePaid=async id=>{const ref=prompt('Optional payout reference:','');if(ref===null)return;try{await api('affiliate_commissions?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{status:'paid',payout_reference:ref||null,paid_at:new Date().toISOString(),updated_at:new Date().toISOString()},headers:{Prefer:'return=minimal'}});await affiliates();}catch(e){alert(e.message)}};
window.affiliatePayoutStatus=async(id,status)=>{let ref=null;if(status==='paid'){ref=prompt('Payout reference / transaction ID:','');if(ref===null)return;}try{const body={status,processed_at:status==='paid'?new Date().toISOString():null};if(ref)body.payout_reference=ref;await api('affiliate_payout_requests?id=eq.'+encodeURIComponent(id),{method:'PATCH',body,headers:{Prefer:'return=minimal'}});await affiliates();}catch(e){alert(e.message)}};
async function communications(){
  const {data:ordersData}=await api("orders?select=id,order_number,shipping_name,shipping_phone,status,payment_status,payment_method,total_amount,tracking_number,courier_name&order=created_at.desc&limit=300");
  const orders=ordersData||[];
  const options=orders.map(o=>`<option value="${esc(o.id)}">${esc(o.order_number||o.id.slice(0,8))} — ${esc(o.shipping_name||"Customer")} — ${esc(o.shipping_phone||"")}</option>`).join("");
  $("#content").innerHTML=`<div class="box">
    <div class="page-head"><div><h2>Customer Communication</h2><p class="muted">Generate ready-to-send updates from real order data.</p></div></div>
    <div class="form-row"><div><label>Order</label><select id="comm_order"><option value="">Select an order…</option>${options}</select></div>
    <div><label>Message template</label><select id="comm_template">
      <option value="confirmed">Order confirmed</option><option value="processing">Order processing</option><option value="packed">Order packed</option>
      <option value="shipped">Order shipped</option><option value="delivered">Order delivered</option><option value="payment">Payment received</option>
      <option value="cod">COD reminder</option><option value="custom">Custom message</option></select></div></div>
    <div id="commExtra" class="form-row" hidden><div><label>Courier</label><input id="comm_courier" placeholder="e.g. TCS"></div><div><label>Tracking number</label><input id="comm_tracking" placeholder="Tracking number"></div></div>
    <div id="commCustomWrap" hidden><label>Custom message</label><textarea id="comm_custom" rows="4" maxlength="700" placeholder="Write your message…"></textarea></div>
    <div class="form-group"><label>Message preview</label><textarea id="comm_preview" rows="9" readonly placeholder="Select an order to generate a message."></textarea></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="primary" id="commGenerate" type="button">Generate message</button><button id="commCopy" type="button">Copy message</button><button id="commWhatsApp" type="button">Open WhatsApp</button></div>
    <p id="commMsg" class="muted"></p></div>`;
  const byId=Object.fromEntries(orders.map(o=>[String(o.id),o]));
  const getOrder=()=>byId[String($("#comm_order").value)];
  const sync=()=>{const shipped=$("#comm_template").value==="shipped";$("#commExtra").hidden=!shipped;$("#commCustomWrap").hidden=$("#comm_template").value!=="custom";};
  const build=()=>{const o=getOrder();if(!o)return "";const name=o.shipping_name||"Customer",number=o.order_number||"your order",total=`Rs. ${Number(o.total_amount||0).toLocaleString()}`,t=$("#comm_template").value,courier=$("#comm_courier")?.value.trim()||o.courier_name||"",tracking=$("#comm_tracking")?.value.trim()||o.tracking_number||"";
    if(t==="custom")return $("#comm_custom").value.trim();
    if(t==="confirmed")return `Assalam-o-Alaikum ${name},

Your ZM Hybrid Store order ${number} has been confirmed. Total: ${total}.

Thank you for shopping with us!`;
    if(t==="processing")return `Assalam-o-Alaikum ${name},

Your ZM Hybrid Store order ${number} is now being processed. We will update you when it is packed.`;
    if(t==="packed")return `Assalam-o-Alaikum ${name},

Good news! Your ZM Hybrid Store order ${number} has been packed and is ready for dispatch.

Total: ${total}.`;
    if(t==="shipped")return `Assalam-o-Alaikum ${name},

Your ZM Hybrid Store order ${number} has been shipped.

Courier: ${courier||"Our delivery partner"}${tracking?`
Tracking: ${tracking}`:""}
Total: ${total}.

Thank you for shopping with ZM Hybrid Store!`;
    if(t==="delivered")return `Assalam-o-Alaikum ${name},

Your ZM Hybrid Store order ${number} has been delivered successfully.

We hope you enjoy your purchase. Thank you for shopping with us!`;
    if(t==="payment")return `Assalam-o-Alaikum ${name},

We have received/verified the payment for your ZM Hybrid Store order ${number}.

Order total: ${total}.
Payment method: ${o.payment_method||"Online payment"}.`;
    if(t==="cod")return `Assalam-o-Alaikum ${name},

Your ZM Hybrid Store order ${number} is on Cash on Delivery.

Amount payable on delivery: ${total}.
Please keep the required amount ready when your parcel arrives.`;
    return "";};
  const generate=()=>{sync();$("#comm_preview").value=build();};
  $("#comm_order").onchange=generate;$("#comm_template").onchange=generate;$("#comm_courier").oninput=generate;$("#comm_tracking").oninput=generate;$("#comm_custom").oninput=generate;$("#commGenerate").onclick=generate;
  $("#commCopy").onclick=async()=>{const text=$("#comm_preview").value||build();if(!text){$("#commMsg").textContent="Select an order first.";return;}try{await navigator.clipboard.writeText(text);$("#commMsg").textContent="Message copied.";}catch{$("#commMsg").textContent="Copy failed. Select the message manually.";}};
  $("#commWhatsApp").onclick=()=>{const o=getOrder(),text=$("#comm_preview").value||build();if(!o||!text){$("#commMsg").textContent="Select an order and generate a message first.";return;}const phone=String(o.shipping_phone||"").replace(/\D/g,"");if(!phone){$("#commMsg").textContent="This order has no customer phone number.";return;}window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");};
  sync();
}


const adminMoney=n=>{const v=Number(n||0);return 'PKR '+v.toLocaleString('en-PK',{maximumFractionDigits:2})};
async function notifications(){
  const {data}=await api("notifications?select=*,profiles(email,full_name),orders(order_number)&order=created_at.desc&limit=500");
  const rows=data||[];
  const unread=rows.filter(x=>!x.read_at).length;
  const money=n=>'Rs. '+Number(n||0).toLocaleString();
  $("#content").innerHTML=`<div class="page-head"><div><h2>Customer Notifications</h2><p class="muted">Review in-app notifications generated for signed-in customers.</p></div><div class="row-actions"><span class="badge">${unread} unread</span><button id="refreshNotifications">Refresh</button></div></div>
  <div class="grid notifications-stats"><div class="stat"><span>Total notifications</span><strong>${rows.length}</strong></div><div class="stat"><span>Unread</span><strong>${unread}</strong></div><div class="stat"><span>Orders</span><strong>${rows.filter(x=>x.type==='order'||x.type==='shipping').length}</strong></div><div class="stat"><span>Returns</span><strong>${rows.filter(x=>x.type==='return').length}</strong></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Type</th><th>Notification</th><th>Order / Return</th><th>Status</th><th>Date</th></tr></thead><tbody>
  ${rows.map(n=>`<tr><td><b>${esc(n.profiles?.full_name||n.profiles?.email||n.user_id)}</b><div class="muted">${esc(n.profiles?.email||'')}</div></td><td><span class="badge">${esc(n.type)}</span></td><td><b>${esc(n.title)}</b><div class="muted">${esc(n.body)}</div></td><td>${esc(n.orders?.order_number||'—')}<div class="muted">${esc(n.return_id||'')}</div></td><td>${n.read_at?'<span class="badge">Read</span>':'<span class="badge">Unread</span>'}</td><td>${new Date(n.created_at).toLocaleString()}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No notifications yet.</td></tr>'}</tbody></table></div>`;
  $("#refreshNotifications")?.addEventListener('click',()=>loadTab('notifications'));
}

async function returns(){
  const {data}=await api("returns?select=*,orders(order_number,shipping_name,shipping_phone,total_amount)&order=created_at.desc&limit=300");
  const rows=data||[];
  const statuses=['requested','approved','rejected','received','refunded','cancelled'];
  const money=n=>'Rs. '+Number(n||0).toLocaleString();
  $("#content").innerHTML=`<div class="page-head"><div><h2>Returns & Refunds</h2><p class="muted">Review customer return requests and record manual refunds.</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Return</th><th>Order</th><th>Customer</th><th>Reason</th><th>Status</th><th>Refund</th><th>Date</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td><b>${esc(r.return_number)}</b></td><td>${esc(r.orders?.order_number||'')}</td><td>${esc(r.orders?.shipping_name||'')}<div class="muted">${esc(r.orders?.shipping_phone||'')}</div></td><td>${esc(r.reason||'')}</td><td><select onchange="updateReturnStatus('${r.id}',this.value)">${statuses.map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td>${money(r.refund_amount)}${r.refund_reference?`<div class="muted">${esc(r.refund_reference)}</div>`:''}</td><td>${new Date(r.created_at).toLocaleString()}</td></tr>`).join('')||`<tr><td colspan="7" class="muted">No return requests yet.</td></tr>`}</tbody></table></div>`;
}
window.updateReturnStatus=async(id,status)=>{try{await api('returns?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{status,updated_at:new Date().toISOString()},headers:{Prefer:'return=minimal'}});loadTab('returns')}catch(e){alert('Return update failed: '+e.message)}};
async function loadTab(tab){currentTab=tab;document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));$("#title").textContent=tab==="content"?"Website CMS":tab[0].toUpperCase()+tab.slice(1);$("#newProduct").hidden=tab!=="products";$("#content").innerHTML=`<div class="box"><p>Loading ${esc(tab)}…</p></div>`;try{if(tab==="dashboard")return await dashboard();if(tab==="finance")return await finance();if(tab==="analytics")return await analytics();if(tab==="products")return await products();if(tab==="aliexpress")return await aliexpressImporter();if(tab==="affiliates")return await affiliates();if(tab==="inventory")return await inventory();if(tab==="categories")return await categories();if(tab==="orders")return await orders();if(tab==="customers")return await customers();if(tab==="coupons")return await simpleTable("coupons",["code","discount_type","discount_value","active"]);if(tab==="reviews")return await reviews();if(tab==="shipping")return await shipping();if(tab==="communications")return await communications();if(tab==="returns")return await returns();if(tab==="notifications")return await notifications();if(tab==="ai-agent")return await aiAgent();if(tab==="content")return await content();if(tab==="seo")return await seoMarketing();if(tab==="settings")return await adminSettings()}catch(e){$("#content").innerHTML=`<div class="box"><h2>Could not load this section</h2><p>${esc(e.message||"Unknown error")}</p></div>`}}
async function count(path){try{const r=await api(path+"?select=id",{headers:{Prefer:"count=exact",Range:"0-0"}});const cr=r.headers.get("content-range");return cr?Number(cr.split("/")[1]||0):Array.isArray(r.data)?r.data.length:0}catch{return "—"}}

async function analytics(){
  const [{data:ordersData},{data:itemsData},{data:productsData}]=await Promise.all([
    api("orders?select=id,order_number,status,payment_status,payment_method,total_amount,subtotal,shipping_cost,discount,created_at&order=created_at.desc&limit=1000"),
    api("order_items?select=order_id,product_id,product_name,quantity,line_total,unit_price&limit=3000"),
    api("products?select=id,name,stock,status&limit=1000")
  ]);
  const orders=ordersData||[], items=itemsData||[], products=productsData||[];
  const money=n=>'Rs. '+Number(n||0).toLocaleString();
  const validStatuses=['pending','confirmed','processing','packed','shipped','delivered','cancelled','returned','refunded'];
  const range=(document.querySelector('#analyticsRange')?.value||'30');
  const cutoff=range==='all'?0:Date.now()-Number(range)*86400000;
  const scoped=orders.filter(o=>new Date(o.created_at).getTime()>=cutoff);
  const revenueOrders=scoped.filter(o=>!['cancelled','refunded'].includes(o.status));
  const revenue=revenueOrders.reduce((n,o)=>n+Number(o.total_amount||0),0);
  const avg=revenueOrders.length?revenue/revenueOrders.length:0;
  const delivered=scoped.filter(o=>o.status==='delivered').length;
  const paid=scoped.filter(o=>o.payment_status==='paid').length;
  const paymentCounts={}; scoped.forEach(o=>{const k=o.payment_method||'Unknown';paymentCounts[k]=(paymentCounts[k]||0)+1});
  const statusCounts={}; validStatuses.forEach(s=>statusCounts[s]=0); scoped.forEach(o=>{if(statusCounts[o.status]!==undefined)statusCounts[o.status]++});
  const itemMap={}; items.forEach(i=>{const oid=i.order_id; if(!scoped.some(o=>o.id===oid))return; const key=i.product_id||i.product_name||'unknown'; if(!itemMap[key])itemMap[key]={name:i.product_name||'Product',qty:0,revenue:0}; itemMap[key].qty+=Number(i.quantity||0); itemMap[key].revenue+=Number(i.line_total||0)});
  const top=Object.values(itemMap).sort((a,b)=>b.revenue-a.revenue).slice(0,8);
  const low=products.filter(p=>p.status==='active'&&Number(p.stock||0)<=5).sort((a,b)=>Number(a.stock)-Number(b.stock)).slice(0,8);
  const days=Math.min(range==='all'?30:Number(range)||30,30); const daily=[];
  for(let i=days-1;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const next=new Date(d);next.setDate(d.getDate()+1);const list=revenueOrders.filter(o=>{const t=new Date(o.created_at);return t>=d&&t<next});daily.push({label:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}),value:list.reduce((n,o)=>n+Number(o.total_amount||0),0),count:list.length})}
  const max=Math.max(1,...daily.map(x=>x.value));
  const bar=(label,value,maxv=1)=>`<div class="analytics-bar-row"><span title="${esc(label)}">${esc(label)}</span><div class="analytics-bar"><i style="width:${Math.max(2,Math.round(value/maxv*100))}%"></i></div><b>${money(value)}</b></div>`;
  const topRows=top.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.name)}</b></td><td>${x.qty}</td><td>${money(x.revenue)}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">No product sales in this period.</td></tr>';
  const statusRows=Object.entries(statusCounts).filter(([,n])=>n).map(([k,n])=>`<div class="analytics-status"><span>${esc(k)}</span><strong>${n}</strong></div>`).join('')||'<div class="muted">No orders in this period.</div>';
  const paymentRows=Object.entries(paymentCounts).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div class="analytics-status"><span>${esc(k)}</span><strong>${n}</strong></div>`).join('')||'<div class="muted">No payment data.</div>';
  const lowRows=low.map(p=>`<tr><td>${esc(p.name)}</td><td><span class="stock-pill ${Number(p.stock)<=2?'low':''}">${Number(p.stock||0)}</span></td><td>${esc(p.status)}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">No low-stock products.</td></tr>';
  const dayBars=daily.map(x=>bar(x.label,x.value,max)).join('');
  const existing=document.querySelector('#analyticsRange');
  const selected=range;
  $('#content').innerHTML=`<div class="analytics-head"><div><p class="muted" style="margin:0">Business performance</p><h2 style="margin:3px 0 0">Analytics & Reports</h2></div><div class="row-actions"><select id="analyticsRange"><option value="7" ${selected==='7'?'selected':''}>Last 7 days</option><option value="30" ${selected==='30'?'selected':''}>Last 30 days</option><option value="90" ${selected==='90'?'selected':''}>Last 90 days</option><option value="all" ${selected==='all'?'selected':''}>All time</option></select><button onclick="exportAnalyticsCSV()">Export CSV</button></div></div>
  <div class="grid analytics-stats"><div class="stat"><span>Revenue</span><strong>${money(revenue)}</strong><small class="muted">Cancelled/refunded excluded</small></div><div class="stat"><span>Orders</span><strong>${scoped.length}</strong><small class="muted">${delivered} delivered</small></div><div class="stat"><span>Average Order</span><strong>${money(avg)}</strong><small class="muted">Per valid order</small></div><div class="stat"><span>Paid Orders</span><strong>${paid}</strong><small class="muted">${scoped.length?Math.round(paid/scoped.length*100):0}% of orders</small></div></div>
  <div class="analytics-grid"><div class="box"><div class="section-title-row"><h3>Revenue by day</h3><span class="muted small">Last ${days} days</span></div><div class="analytics-bars">${dayBars}</div></div><div class="box"><h3>Order status</h3><div class="analytics-status-list">${statusRows}</div><h3 style="margin-top:22px">Payment methods</h3><div class="analytics-status-list">${paymentRows}</div></div></div>
  <div class="analytics-grid"><div class="box"><h3>Top products</h3><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>${topRows}</tbody></table></div></div><div class="box"><h3>Low stock alerts</h3><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Product</th><th>Stock</th><th>Status</th></tr></thead><tbody>${lowRows}</tbody></table></div></div></div>`;
  $('#analyticsRange').onchange=()=>analytics();
}
window.exportAnalyticsCSV=async()=>{try{const [{data:o},{data:i}]=await Promise.all([api("orders?select=order_number,status,payment_status,payment_method,total_amount,created_at&order=created_at.desc&limit=5000"),api("order_items?select=order_id,product_name,quantity,line_total&limit=10000")]);const rows=[['Order','Status','Payment Status','Payment Method','Total','Created At']];(o||[]).forEach(x=>rows.push([x.order_number||'',x.status||'',x.payment_status||'',x.payment_method||'',x.total_amount||0,x.created_at||'']));const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zm-hybrid-orders-report.csv';a.click();URL.revokeObjectURL(url)}catch(e){alert(e.message)}};

async function dashboard(){const [{data:od},{data:pd},cc]=await Promise.all([api("orders?select=id,order_number,status,total_amount,created_at,shipping_name&order=created_at.desc&limit=200"),api("products?select=id,name,stock,status&order=stock.asc&limit=200"),count("profiles?role=eq.customer")]);const ol=od||[],pl=pd||[],active=ol.filter(o=>!['cancelled','refunded'].includes(o.status)),revenue=active.reduce((n,o)=>n+Number(o.total_amount||0),0),pending=ol.filter(o=>o.status==='pending').length,low=pl.filter(p=>p.status==='active'&&Number(p.stock||0)<=5),money=n=>'Rs. '+Number(n||0).toLocaleString();$("#content").innerHTML=`<div class="grid"><div class="stat"><span>Total Revenue</span><strong>${money(revenue)}</strong><small class="muted">Excluding cancelled/refunded</small></div><div class="stat"><span>Orders</span><strong>${ol.length}</strong><small class="muted">${pending} pending</small></div><div class="stat"><span>Customers</span><strong>${cc}</strong><small class="muted">Registered customers</small></div><div class="stat"><span>Low Stock</span><strong>${low.length}</strong><small class="muted">Active products ≤ 5 units</small></div></div><div class="box" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h3 style="margin:0">Recent Orders</h3><button onclick="loadTab('orders')">View all orders</button></div><div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr></thead><tbody>${ol.slice(0,8).map(o=>`<tr><td><b>${esc(o.order_number||o.id.slice(0,8))}</b></td><td>${esc(o.shipping_name||'Guest')}</td><td><span class="badge">${esc(o.status)}</span></td><td>${money(o.total_amount)}</td><td>${new Date(o.created_at).toLocaleString()}</td></tr>`).join('')||`<tr><td colspan="5" class="muted">No orders yet.</td></tr>`}</tbody></table></div></div><div class="box" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h3 style="margin:0">Low Stock</h3><button onclick="loadTab('products')">Manage products</button></div><div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Product</th><th>Stock</th><th>Status</th></tr></thead><tbody>${low.slice(0,10).map(p=>`<tr><td>${esc(p.name)}</td><td><b>${Number(p.stock||0)}</b></td><td><span class="badge">${esc(p.status)}</span></td></tr>`).join('')||`<tr><td colspan="3" class="muted">No low-stock products.</td></tr>`}</tbody></table></div></div>`}
function productRow(p){return `<tr><td><b>${esc(p.name)}</b><div class="muted">${esc(p.sku||"")}</div></td><td>${esc(p.category?.name||"—")}</td><td>${adminMoney(p.sale_price??p.regular_price??0)}</td><td>${p.stock??0}</td><td><span class="badge">${esc(p.status)}</span></td><td>${p.featured?"Yes":"No"}</td><td class="actions"><button onclick="editProduct('${p.id}')">Edit</button><button class="danger" onclick="deleteProduct('${p.id}')">Delete</button></td></tr>`}
async function products(){
  const {data}=await api("products?select=id,name,sku,regular_price,sale_price,compare_at_price,cost_price,stock,low_stock_threshold,status,featured,created_at,updated_at,supplier_name,supplier_url,supplier_sku,supplier_cost,supplier_shipping_cost,target_market,fulfillment_method,estimated_delivery,product_source,product_status,estimated_ad_cost,affiliate_commission_rate,category:categories(name),brand:brands(name),product_images(image_url,sort_order)&order=created_at.desc&limit=500");
  const rows=data||[];
  const active=rows.filter(p=>p.status==="active").length;
  const drafts=rows.filter(p=>p.status==="draft").length;
  const featured=rows.filter(p=>p.featured).length;
  const low=rows.filter(p=>p.status==="active" && Number(p.stock||0)<=Number(p.low_stock_threshold??5)).length;
  $("#content").innerHTML=`
    <div class="grid product-stats">
      <div class="stat"><span>Total</span><strong>${rows.length}</strong><small class="muted">All products</small></div>
      <div class="stat"><span>Active</span><strong>${active}</strong><small class="muted">Visible in store</small></div>
      <div class="stat"><span>Drafts</span><strong>${drafts}</strong><small class="muted">Not published</small></div>
      <div class="stat"><span>Featured</span><strong>${featured}</strong><small class="muted">Homepage/catalog</small></div>
      <div class="stat"><span>Low stock</span><strong>${low}</strong><small class="muted">At threshold or below</small></div>
    </div>
    <div class="toolbar product-toolbar">
      <input id="productSearch" placeholder="Search product, SKU or brand…">
      <select id="productStatus"><option value="">All status</option><option value="active">Active</option><option value="draft">Draft</option></select>
      <select id="productCategory"><option value="">All categories</option></select>
      <select id="productBrand"><option value="">All brands</option></select>
      <label class="toolbar-check"><input id="productFeatured" type="checkbox"> Featured only</label>
      <label class="toolbar-check"><input id="productLow" type="checkbox"> Low stock</label>
      <span id="productCount" class="muted"></span>
    </div>
    <div class="table-wrap">
      <table class="table product-table">
        <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th>Actions</th></tr></thead>
        <tbody id="productRows"></tbody>
      </table>
    </div>
    <div id="productPager" class="pager"></div>`;

  const catSet=new Map(),brandSet=new Map();
  rows.forEach(p=>{if(p.category?.name)catSet.set(p.category.name,p.category.name);if(p.brand?.name)brandSet.set(p.brand.name,p.brand.name)});
  $("#productCategory").insertAdjacentHTML("beforeend",[...catSet.keys()].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(""));
  $("#productBrand").insertAdjacentHTML("beforeend",[...brandSet.keys()].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(""));

  let page=1; const perPage=12;
  const apply=()=>{
    const q=$("#productSearch").value.trim().toLowerCase(), st=$("#productStatus").value, cat=$("#productCategory").value, brand=$("#productBrand").value;
    const featuredOnly=$("#productFeatured").checked, lowOnly=$("#productLow").checked;
    const filtered=rows.filter(p=>{
      const hay=[p.name,p.sku,p.brand?.name,p.category?.name].filter(Boolean).join(" ").toLowerCase();
      return (!q||hay.includes(q)) && (!st||p.status===st) && (!cat||p.category?.name===cat) && (!brand||p.brand?.name===brand)
        && (!featuredOnly||!!p.featured) && (!lowOnly||(p.status==="active"&&Number(p.stock||0)<=Number(p.low_stock_threshold??5)));
    });
    const totalPages=Math.max(1,Math.ceil(filtered.length/perPage)); if(page>totalPages)page=totalPages;
    const start=(page-1)*perPage;
    $("#productRows").innerHTML=filtered.slice(start,start+perPage).map(productRow).join("")||`<tr><td colspan="8" class="empty">No products match these filters.</td></tr>`;
    $("#productCount").textContent=`${filtered.length} product${filtered.length===1?"":"s"}`;
    $("#productPager").innerHTML=totalPages>1?`<button ${page===1?"disabled":""} onclick="productPage(-1)">Previous</button><span>Page ${page} of ${totalPages}</span><button ${page===totalPages?"disabled":""} onclick="productPage(1)">Next</button>`:"";
    window.__productPage=()=>apply();
  };
  window.productPage=(delta)=>{page+=delta;apply();window.scrollTo({top:0,behavior:"smooth"})};
  ["productSearch","productStatus","productCategory","productBrand","productFeatured","productLow"].forEach(id=>$("#"+id).addEventListener(id==="productSearch"?"input":"change",()=>{page=1;apply()}));
  apply();
}
function productRow(p){
  const img=(p.product_images||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0]?.image_url;
  const price=Number(p.sale_price??p.regular_price??0);
  const old=p.sale_price!=null && Number(p.regular_price||0)>price ? `<del class="muted">Rs. ${Number(p.regular_price||0).toLocaleString()}</del>` : "";
  const isLow=p.status==="active" && Number(p.stock||0)<=Number(p.low_stock_threshold??5);
  return `<tr>
    <td><div class="product-cell">${img?`<img src="${esc(img)}" alt="">`:`<span class="product-thumb">ZM</span>`}<div><b>${esc(p.name)}</b><div class="muted">${esc(p.sku||"No SKU")}</div></div></div></td>
    <td>${esc(p.category?.name||"—")}</td><td>${esc(p.brand?.name||"—")}</td>
    <td><b>Rs. ${price.toLocaleString()}</b><div>${old}</div></td>
    <td><span class="stock-pill ${isLow?"low":""}">${Number(p.stock||0)}</span><div class="muted">threshold ${Number(p.low_stock_threshold??5)}</div></td>
    <td><span class="badge">${esc(p.status)}</span></td>
    <td>${p.featured?'<span class="featured-mark">★ Featured</span>':"—"}</td>
    <td class="actions"><button onclick="editProduct('${p.id}')">Edit</button><button class="danger" onclick="deleteProduct('${p.id}')">Delete</button></td>
  </tr>`;
}
async function categories(){const {data}=await api("categories?select=*&order=name.asc");$("#content").innerHTML=`<div class="toolbar"><button onclick="categoryForm()">+ Add Category</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Slug</th><th>Created</th><th></th></tr></thead><tbody>${(data||[]).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.slug)}</td><td>${new Date(c.created_at).toLocaleDateString()}</td><td class="actions"><button onclick='categoryForm(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Edit</button><button class="danger" onclick="deleteCategory('${c.id}')">Delete</button></td></tr>`).join("")}</tbody></table></div>`}
window.categoryForm=async c=>{$("#content").insertAdjacentHTML("beforeend",`<div class="modal"><form id="categoryForm"><h2>${c?"Edit":"Add"} Category</h2><input name="name" value="${esc(c?.name)}" placeholder="Category name" required><input name="slug" value="${esc(c?.slug)}" placeholder="Slug"><div class="row-actions"><button>Save</button><button type="button" onclick="this.closest('.modal').remove()">Cancel</button></div></form></div>`);$("#categoryForm").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.slug=(d.slug||d.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");try{if(c?.id)await api("categories?id=eq."+encodeURIComponent(c.id),{method:"PATCH",body:d,headers:{Prefer:"return=minimal"}});else await api("categories",{method:"POST",body:d,headers:{Prefer:"return=minimal"}});e.target.closest('.modal').remove();categories()}catch(x){alert(x.message)}}}
window.deleteCategory=async id=>{if(!confirm("Delete this category? Products will keep their records but category may become empty."))return;try{await api("categories?id=eq."+encodeURIComponent(id),{method:"DELETE"});categories()}catch(e){alert(e.message)}};
async function productForm(p={}){
  const [{data:cats},{data:brands},{data:imgs},{data:vars}]=await Promise.all([
    api("categories?select=*&order=name.asc"),
    api("brands?select=*&order=name.asc"),
    p.id?api("product_images?select=*&product_id=eq."+encodeURIComponent(p.id)+"&order=sort_order.asc"):Promise.resolve({data:[]}),
    p.id?api("product_variants?select=*&product_id=eq."+encodeURIComponent(p.id)+"&order=created_at.asc"):Promise.resolve({data:[]})
  ]);
  const currentImages=imgs||[], currentVars=vars||[];
  $("#content").insertAdjacentHTML("beforeend",`<div class="modal"><form id="productForm" novalidate>
    <div class="modal-head"><div><p class="eyebrow">${p.id?"PRODUCT EDITOR":"NEW PRODUCT"}</p><h2>${p.id?"Edit Product":"Add Product"}</h2></div><button type="button" class="icon-close" onclick="this.closest('.modal').remove()">×</button></div>
    <div class="form-section"><h3>Basic information</h3><div class="form-grid">
      <label>Product name<input name="name" value="${esc(p.name)}" placeholder="e.g. Ultra Vital Glutathione Capsules 30s" required></label>
      <label>SKU<input name="sku" value="${esc(p.sku)}" placeholder="ZM-HB-001"></label>
      <label>Category<select name="category_id"><option value="">Select category</option>${(cats||[]).map(x=>`<option value="${x.id}" ${p.category_id===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label>Brand<select name="brand_id"><option value="">Select brand</option>${(brands||[]).map(x=>`<option value="${x.id}" ${p.brand_id===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label>Slug<input name="slug" value="${esc(p.slug)}" placeholder="auto-generated-from-name"></label>
      <label>Status<select name="status"><option value="active" ${p.status!=="draft"?"selected":""}>Active — visible in store</option><option value="draft" ${p.status==="draft"?"selected":""}>Draft — hidden</option></select></label>
      <label class="check-box"><input name="featured" type="checkbox" ${p.featured?"checked":""}><span><b>Featured product</b><small>Highlight in storefront</small></span></label>
    </div></div>
    <div class="form-section"><h3>Pricing & inventory</h3><div class="form-grid">
      <label>Regular price (PKR)<input name="regular_price" type="number" min="0" step="0.01" value="${p.regular_price??""}" required></label>
      <label>Sale price (PKR)<input name="sale_price" type="number" min="0" step="0.01" value="${p.sale_price??""}" placeholder="Optional"></label>
      <label>Compare-at price (PKR)<input name="compare_at_price" type="number" min="0" step="0.01" value="${p.compare_at_price??""}" placeholder="Optional"></label>
      <label>Cost price — admin only<input name="cost_price" type="number" min="0" step="0.01" value="${p.cost_price??""}" placeholder="Optional"></label>
      <label>Stock quantity<input name="stock" type="number" min="0" step="1" value="${p.stock??0}" required></label>
      <label>Low-stock threshold<input name="low_stock_threshold" type="number" min="0" step="1" value="${p.low_stock_threshold??5}" required></label>
      <label>Weight (grams)<input name="weight_grams" type="number" min="0" step="1" value="${p.weight_grams??""}" placeholder="Optional"></label>
    </div><div id="productValidation" class="form-error" hidden></div></div>
    <div class="form-section"><h3>Dropshipping &amp; Product Sourcing</h3><div class="form-grid">
      <label>Supplier<input name="supplier_name" value="${esc(p.supplier_name)}" placeholder="e.g. CJdropshipping / AliExpress supplier"></label>
      <label>Supplier URL<input name="supplier_url" type="url" value="${esc(p.supplier_url)}" placeholder="https://..."></label>
      <label>Supplier SKU<input name="supplier_sku" value="${esc(p.supplier_sku)}" placeholder="Supplier SKU"></label>
      <label>Supplier Cost (PKR)<input name="supplier_cost" type="number" min="0" step="0.01" value="${p.supplier_cost??""}" placeholder="Optional"></label>
      <label>Shipping Cost (PKR)<input name="supplier_shipping_cost" type="number" min="0" step="0.01" value="${p.supplier_shipping_cost??""}" placeholder="Optional"></label>
      <label>Target Country<select name="target_market">
        <option value="Pakistan" ${p.target_market==="Pakistan"?"selected":""}>Pakistan — PKR</option>
        <option value="United Arab Emirates" ${p.target_market==="United Arab Emirates"?"selected":""}>United Arab Emirates — AED</option>
        <option value="Saudi Arabia" ${p.target_market==="Saudi Arabia"?"selected":""}>Saudi Arabia — SAR</option>
        <option value="United Kingdom" ${p.target_market==="United Kingdom"?"selected":""}>United Kingdom — GBP</option>
        <option value="United States" ${p.target_market==="United States"?"selected":""}>United States — USD</option>
        <option value="European Union" ${p.target_market==="European Union"?"selected":""}>European Union — EUR</option>
        <option value="Qatar" ${p.target_market==="Qatar"?"selected":""}>Qatar — QAR</option>
        <option value="Kuwait" ${p.target_market==="Kuwait"?"selected":""}>Kuwait — KWD</option>
      </select></label>
      <label>Fulfillment Method<select name="fulfillment_method">
        <option value="" ${!p.fulfillment_method?"selected":""}>Select method</option>
        <option value="DSers / AliExpress" ${p.fulfillment_method==="DSers / AliExpress"?"selected":""}>DSers / AliExpress</option>
        <option value="CJdropshipping" ${p.fulfillment_method==="CJdropshipping"?"selected":""}>CJdropshipping</option>
        <option value="Manual Supplier" ${p.fulfillment_method==="Manual Supplier"?"selected":""}>Manual Supplier</option>
        <option value="Own Inventory" ${p.fulfillment_method==="Own Inventory"?"selected":""}>Own Inventory</option>
      </select></label>
      <label>Estimated Delivery<input name="estimated_delivery" value="${esc(p.estimated_delivery)}" placeholder="e.g. 7–12 business days"></label>
      <label>Product Source<input name="product_source" value="${esc(p.product_source)}" placeholder="AliExpress, CJdropshipping, local supplier..."></label>
      <label>Product Status<select name="product_status">
        <option value="research" ${(!p.product_status||p.product_status==="research")?"selected":""}>Research</option>
        <option value="testing" ${p.product_status==="testing"?"selected":""}>Testing</option>
        <option value="winning" ${p.product_status==="winning"?"selected":""}>Winning</option>
        <option value="paused" ${p.product_status==="paused"?"selected":""}>Paused</option>
      </select></label>
      <label>Estimated Ad Cost / Sale (PKR)<input name="estimated_ad_cost" type="number" min="0" step="0.01" value="${p.estimated_ad_cost??""}" placeholder="Optional"></label>
      <label>Affiliate Commission (%)<input name="affiliate_commission_rate" type="number" min="0" max="100" step="0.01" value="${p.affiliate_commission_rate??""}" placeholder="Required — set commission for this product" required></label>
      <div class="notice" style="grid-column:1/-1"><strong>Estimated profit (PKR):</strong> <span id="productProfitPreview">—</span><small class="muted" style="display:block;margin-top:4px">Sale price − supplier cost − supplier shipping − estimated ad cost</small></div>
    </div></div>
    <div class="form-section"><h3>Description</h3><div class="form-grid">
      <label class="wide">Short description<textarea name="short_description" rows="3" maxlength="500" placeholder="Short product summary">${esc(p.short_description)}</textarea></label>
      <label class="wide">Full description<textarea name="description" rows="6" placeholder="Detailed product description">${esc(p.description)}</textarea></label>
      <label class="wide">Tags<textarea name="tags" rows="2" placeholder="skincare, glutathione, capsules">${esc((p.tags||[]).join(", "))}</textarea><small class="muted">Separate tags with commas.</small></label>
    </div></div>
    <div class="form-section"><h3>SEO</h3><div class="form-grid">
      <label>SEO title<input name="seo_title" value="${esc(p.seo_title)}" maxlength="70" placeholder="Search result title"></label>
      <label>SEO description<input name="seo_description" value="${esc(p.seo_description)}" maxlength="160" placeholder="Search result description"></label>
    </div></div>
    <div class="form-section"><div class="section-title-row"><h3>Product variants</h3><button type="button" onclick="addVariantRow()">+ Add variant</button></div>
      <p class="muted small">Use variants when a product has different sizes, colors, packs or prices.</p><div id="variantRows">${currentVars.map(variantRow).join("")}</div>
    </div>
    <div class="form-section"><div class="section-title-row"><h3>Product images</h3>${p.id?`<label class="upload-btn">+ Upload images<input id="productImages" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label>`:""}</div>
      ${p.id?`<p class="muted small">JPG, PNG or WebP · maximum 3MB each. First image is the storefront main image.</p><div id="imageList" class="image-list">${currentImages.map(imageRow).join("")||`<div class="empty">No product images yet.</div>`}</div>`:`<div class="notice">Save the product first. Then upload images and add variants.</div>`}
    </div>
    <div class="row-actions modal-actions"><button id="saveProduct" class="primary">${p.id?"Save changes":"Create product"}</button><button type="button" onclick="this.closest('.modal').remove()">Cancel</button></div>
  </form></div>`);
  const form=$("#productForm");
  form.querySelector('[name="name"]').addEventListener("blur",()=>{const slug=form.querySelector('[name="slug"]');if(!p.id&&!slug.value.trim())slug.value=slugify(form.querySelector('[name="name"]').value)});
  const updateProfitPreview=()=>{const sale=Number(form.querySelector('[name="sale_price"]')?.value||form.querySelector('[name="regular_price"]')?.value||0),cost=Number(form.querySelector('[name="supplier_cost"]')?.value||0),ship=Number(form.querySelector('[name="supplier_shipping_cost"]')?.value||0),ad=Number(form.querySelector('[name="estimated_ad_cost"]')?.value||0);const el=form.querySelector('#productProfitPreview');if(el)el.textContent=(sale-cost-ship-ad).toLocaleString('en-PK',{maximumFractionDigits:2})+' PKR';};
  ['regular_price','sale_price','supplier_cost','supplier_shipping_cost','estimated_ad_cost'].forEach(n=>form.querySelector(`[name="${n}"]`)?.addEventListener('input',updateProfitPreview)); updateProfitPreview();
  form.onsubmit=async e=>{e.preventDefault();await saveProduct(e,p)};
  if(p.id)$("#productImages").onchange=e=>uploadImages(p.id,e.target.files);
}
function slugify(v){return String(v||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
async function uniqueProductSlug(baseSlug,productId=null){
  const base=slugify(baseSlug);
  if(!base)return "";
  let candidate=base;
  for(let n=1;n<=100;n++){
    const {data}=await api("products?select=id,slug&slug=eq."+encodeURIComponent(candidate)+"&limit=1");
    const conflict=(data||[]).find(x=>String(x.id)!==String(productId||""));
    if(!conflict)return candidate;
    candidate=base+"-"+(n+1);
  }
  throw new Error("Could not generate a unique product slug. Please enter a different slug.");
}
function isDuplicateSlugError(err){
  const m=String(err?.message||err||"").toLowerCase();
  return m.includes("products_slug_key") || (m.includes("duplicate key") && m.includes("slug"));
}
function variantRow(v={}){
  return `<div class="variant-row" data-id="${v.id||""}">
    <input data-v="name" placeholder="Variant name" value="${esc(v.name)}">
    <input data-v="sku" placeholder="SKU" value="${esc(v.sku)}">
    <input data-v="price" type="number" min="0" step="0.01" placeholder="Price" value="${v.price??""}">
    <input data-v="compare_at_price" type="number" min="0" step="0.01" placeholder="Compare price" value="${v.compare_at_price??""}">
    <input data-v="stock" type="number" min="0" step="1" placeholder="Stock" value="${v.stock??0}">
    <input data-v="low_stock_threshold" type="number" min="0" step="1" placeholder="Low threshold" value="${v.low_stock_threshold??5}">
    <label class="variant-active"><input data-v="active" type="checkbox" ${v.active!==false?"checked":""}> Active</label>
    <button type="button" class="danger" onclick="this.parentElement.remove()">Remove</button>
  </div>`;
}
window.addVariantRow=()=>$("#variantRows").insertAdjacentHTML("beforeend",variantRow());
async function saveProduct(e,p){
  const f=e.target,d=Object.fromEntries(new FormData(f)),err=$("#productValidation");
  d.name=(d.name||"").trim(); d.sku=(d.sku||"").trim()||null; d.slug=slugify(d.slug||d.name);
  d.regular_price=Number(d.regular_price); d.sale_price=d.sale_price!==""&&d.sale_price!=null?Number(d.sale_price):null;
  d.compare_at_price=d.compare_at_price!==""&&d.compare_at_price!=null?Number(d.compare_at_price):null;
  d.cost_price=d.cost_price!==""&&d.cost_price!=null?Number(d.cost_price):null;
  d.stock=Number(d.stock||0); d.low_stock_threshold=Number(d.low_stock_threshold??5); d.weight_grams=d.weight_grams?Number(d.weight_grams):null;
  d.supplier_name=(d.supplier_name||"").trim()||null; d.supplier_url=(d.supplier_url||"").trim()||null; d.supplier_sku=(d.supplier_sku||"").trim()||null;
  d.supplier_cost=d.supplier_cost!==""&&d.supplier_cost!=null?Number(d.supplier_cost):null; d.supplier_shipping_cost=d.supplier_shipping_cost!==""&&d.supplier_shipping_cost!=null?Number(d.supplier_shipping_cost):null;
  d.target_market=(d.target_market||"").trim()||null; d.fulfillment_method=(d.fulfillment_method||"").trim()||null; d.estimated_delivery=(d.estimated_delivery||"").trim()||null; d.product_source=(d.product_source||"").trim()||null;
  d.product_status=(d.product_status||"research").trim(); d.estimated_ad_cost=d.estimated_ad_cost!==""&&d.estimated_ad_cost!=null?Number(d.estimated_ad_cost):null; d.affiliate_commission_rate=d.affiliate_commission_rate!==""&&d.affiliate_commission_rate!=null?Number(d.affiliate_commission_rate):null;
  d.featured=f.querySelector('[name="featured"]').checked;
  d.tags=(d.tags||"").split(",").map(x=>x.trim()).filter(Boolean);
  err.hidden=true;
  const errors=[];
  if(!d.name)errors.push("Product name is required.");
  if(!d.slug)errors.push("A valid slug is required.");
  if(!Number.isFinite(d.regular_price)||d.regular_price<0)errors.push("Regular price must be 0 or more.");
  if(d.sale_price!==null&&(!Number.isFinite(d.sale_price)||d.sale_price<0||d.sale_price>d.regular_price))errors.push("Sale price must be between 0 and the regular price.");
  if(d.compare_at_price!==null&&(!Number.isFinite(d.compare_at_price)||d.compare_at_price<0))errors.push("Compare-at price must be 0 or more.");
  if(d.affiliate_commission_rate===null||!Number.isFinite(d.affiliate_commission_rate)||d.affiliate_commission_rate<0||d.affiliate_commission_rate>100)errors.push("Affiliate commission must be set between 0% and 100% for this product.");
  if(!Number.isInteger(d.stock)||d.stock<0)errors.push("Stock must be a whole number.");
  if(!Number.isInteger(d.low_stock_threshold)||d.low_stock_threshold<0)errors.push("Low-stock threshold must be a whole number.");
  if(errors.length){err.innerHTML=errors.map(esc).join("<br>");err.hidden=false;return}
  try{
    f.querySelector("#saveProduct").disabled=true;
    let productId=p.id;
    // Product slugs are UNIQUE in Postgres. Resolve collisions automatically
    // instead of allowing products_slug_key to block product creation.
    d.slug=await uniqueProductSlug(d.slug,d.id||null);
    if(productId)await api("products?id=eq."+encodeURIComponent(productId),{method:"PATCH",body:d,headers:{Prefer:"return=minimal"}});
    else{
      let inserted=null,lastError=null;
      for(let attempt=0;attempt<5&&!inserted;attempt++){
        try{
          const r=await api("products",{method:"POST",body:d,headers:{Prefer:"return=representation"}});
          inserted=r.data?.[0]||null;
          if(!inserted)throw new Error("Product was saved but its ID was not returned.");
        }catch(x){
          lastError=x;
          if(!isDuplicateSlugError(x))throw x;
          d.slug=await uniqueProductSlug(d.slug,null);
        }
      }
      if(!inserted)throw lastError||new Error("Could not create the product.");
      productId=inserted.id;
    }
    await saveVariants(productId);
    if(p.id&&Number(p.stock??0)!==d.stock){
      await api("inventory_transactions",{method:"POST",body:{product_id:productId,quantity_change:d.stock-Number(p.stock||0),reason:"admin_stock_adjustment",note:"Adjusted from Admin Products",created_by:currentSession.user_id},headers:{Prefer:"return=minimal"}});
    }
    const wasNewProduct=!p.id;
    f.closest(".modal").remove();
    await products();
    if(wasNewProduct){
      // Re-open the newly created product in edit mode so image upload and variants
      // are immediately available without requiring a manual edit click.
      await editProduct(productId);
    }
  }catch(x){
    f.querySelector("#saveProduct").disabled=false;
    const msg=x.message||"Could not save product.";
    err.textContent=isDuplicateSlugError(x)?"That product slug is already in use. A unique slug is generated automatically; please try Save again.":msg.toLowerCase().includes("duplicate")&&msg.toLowerCase().includes("sku")?"That SKU is already in use.":msg;
    err.hidden=false;
  }
}
async function saveVariants(productId){
  const rows=[...document.querySelectorAll("#variantRows .variant-row")];
  const {data:existing}=await api("product_variants?select=id,name,sku,price,compare_at_price,stock,low_stock_threshold,active&product_id=eq."+encodeURIComponent(productId));
  const keep=[];
  for(const row of rows){
    const name=row.querySelector('[data-v="name"]').value.trim(); if(!name)continue;
    const d={product_id:productId,name,sku:row.querySelector('[data-v="sku"]').value.trim()||null,
      price:row.querySelector('[data-v="price"]').value?Number(row.querySelector('[data-v="price"]').value):null,
      compare_at_price:row.querySelector('[data-v="compare_at_price"]').value?Number(row.querySelector('[data-v="compare_at_price"]').value):null,
      stock:Number(row.querySelector('[data-v="stock"]').value||0),
      low_stock_threshold:Number(row.querySelector('[data-v="low_stock_threshold"]').value||5),
      active:row.querySelector('[data-v="active"]').checked,attributes:{}};
    if(!Number.isInteger(d.stock)||d.stock<0)throw new Error("Variant stock must be a whole number.");
    if(d.price!==null&&d.price<0)throw new Error("Variant price cannot be negative.");
    const id=row.dataset.id;
    if(id){
      const old=(existing||[]).find(v=>v.id===id); keep.push(id);
      await api("product_variants?id=eq."+encodeURIComponent(id),{method:"PATCH",body:d,headers:{Prefer:"return=minimal"}});
      if(old&&Number(old.stock)!==d.stock)await api("inventory_transactions",{method:"POST",body:{product_id:productId,variant_id:id,quantity_change:d.stock-Number(old.stock||0),reason:"admin_variant_stock_adjustment",note:"Adjusted variant stock from Admin Products",created_by:currentSession.user_id},headers:{Prefer:"return=minimal"}});
    }else{
      const r=await api("product_variants",{method:"POST",body:d,headers:{Prefer:"return=representation"}});
      if(r.data?.[0]?.id){keep.push(r.data[0].id);if(d.stock>0)await api("inventory_transactions",{method:"POST",body:{product_id:productId,variant_id:r.data[0].id,quantity_change:d.stock,reason:"admin_variant_stock_adjustment",note:"Initial variant stock",created_by:currentSession.user_id},headers:{Prefer:"return=minimal"}})}
    }
  }
  for(const v of existing||[])if(!keep.includes(v.id))await api("product_variants?id=eq."+encodeURIComponent(v.id),{method:"DELETE"});
}
function imageRow(i,idx=0,total=0){
  const main=Number(i.sort_order||0)===0;
  return `<div class="image-item ${main?"is-main":""}" data-image-id="${i.id}">
    <div class="image-preview-wrap"><img src="${esc(i.image_url)}" alt="Product image ${idx+1}">${main?'<span class="main-image-badge">MAIN</span>':""}</div>
    <div class="image-actions"><button type="button" onclick="setMainImage('${i.id}')">Set main</button><button type="button" ${idx===0?"disabled":""} onclick="moveImage('${i.id}',-1)">←</button><button type="button" ${idx===total-1?"disabled":""} onclick="moveImage('${i.id}',1)">→</button><button type="button" class="danger" onclick="deleteImage('${i.id}','${esc(i.storage_path||"")}')">Delete</button></div>
  </div>`;
}
function renderImageList(images){const list=images.slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));$("#imageList").innerHTML=list.length?list.map((i,n)=>imageRow(i,n,list.length)).join(""):`<div class="empty">No product images yet.</div>`}
async function getProductImages(productId){const r=await api("product_images?select=*&product_id=eq."+encodeURIComponent(productId)+"&order=sort_order.asc");return r.data||[]}
window.setMainImage=async id=>{try{const image=await api("product_images?select=*&id=eq."+encodeURIComponent(id)+"&limit=1");const row=image.data?.[0];if(!row)return;const imgs=await getProductImages(row.product_id);for(let i=0;i<imgs.length;i++)await api("product_images?id=eq."+encodeURIComponent(imgs[i].id),{method:"PATCH",body:{sort_order:imgs[i].id===id?0:i+1},headers:{Prefer:"return=minimal"}});renderImageList(await getProductImages(row.product_id))}catch(e){alert(e.message)}};
window.moveImage=async(id,delta)=>{try{const image=await api("product_images?select=*&id=eq."+encodeURIComponent(id)+"&limit=1");const row=image.data?.[0];if(!row)return;const imgs=await getProductImages(row.product_id);const ordered=imgs.slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));const idx=ordered.findIndex(x=>x.id===id),to=idx+delta;if(to<0||to>=ordered.length)return;[ordered[idx],ordered[to]]=[ordered[to],ordered[idx]];for(let i=0;i<ordered.length;i++)await api("product_images?id=eq."+encodeURIComponent(ordered[i].id),{method:"PATCH",body:{sort_order:i},headers:{Prefer:"return=minimal"}});renderImageList(await getProductImages(row.product_id))}catch(e){alert(e.message)}};
async function uploadImages(productId,files){
  for(const file of [...files]){
    if(file.size>3*1024*1024){alert(file.name+" is larger than 3MB.");continue}
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){alert(file.name+" is not a supported image.");continue}
    try{
      const safe=file.name.toLowerCase().replace(/[^a-z0-9.]+/g,"-"),path=`${productId}/${crypto.randomUUID()}-${safe}`;
      const r=await timeoutFetch(SUPABASE_URL+"/storage/v1/object/"+PRODUCT_BUCKET+"/"+path,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+currentSession.token,"Content-Type":file.type,"x-upsert":"false"},body:file},30000);
      const j=await readJson(r);
      if(!r.ok){
        const detail=j.message||j.error||j.error_description||j.statusCode||`Storage request failed (${r.status})`;
        throw new Error(detail);
      }
      const existing=await getProductImages(productId);
      const nextOrder=existing.length?Math.max(...existing.map(x=>Number(x.sort_order||0)))+1:0;
      const image_url=SUPABASE_URL+"/storage/v1/object/public/"+PRODUCT_BUCKET+"/"+path;
      await api("product_images",{method:"POST",body:{product_id:productId,image_url,storage_path:path,sort_order:nextOrder},headers:{Prefer:"return=minimal"}});
    }catch(e){alert("Upload failed for "+file.name+": "+e.message)}
  }
  const input=$("#productImages");
  if(input)input.value="";
  await editProduct(productId);
}
window.deleteImage=async(id,path)=>{
  if(!confirm("Delete this image?"))return;
  try{
    const r=await api("product_images?select=product_id&id=eq."+encodeURIComponent(id)+"&limit=1");
    const productId=r.data?.[0]?.product_id;
    await api("product_images?id=eq."+encodeURIComponent(id),{method:"DELETE"});
    if(path)await timeoutFetch(SUPABASE_URL+"/storage/v1/object/"+PRODUCT_BUCKET,{method:"DELETE",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+currentSession.token,"Content-Type":"application/json"},body:JSON.stringify({prefixes:[path]})},15000);
    if(productId)renderImageList(await getProductImages(productId));
  }catch(e){alert(e.message)}
};
window.editProduct=async id=>{try{const {data}=await api("products?select=*&id=eq."+encodeURIComponent(id)+"&limit=1");if(data?.[0])productForm(data[0])}catch(e){alert(e.message)}};
window.deleteProduct=async id=>{if(!confirm("Delete this product and its variants/images? This cannot be undone."))return;try{await api("products?id=eq."+encodeURIComponent(id),{method:"DELETE"});products()}catch(e){alert(e.message)}};
async function orders(){const {data}=await api("orders?select=*&order=created_at.desc&limit=200");const rows=data||[];$("#content").innerHTML=`<div class="toolbar"><input id="orderSearch" placeholder="Search order, customer or phone…"><select id="orderFilter"><option value="">All statuses</option>${['pending','confirmed','processing','packed','shipped','delivered','cancelled','returned','refunded'].map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div><div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Status</th><th>Payment</th><th>Total</th><th>Date</th><th></th></tr></thead><tbody id="orderRows">${rows.map(o=>`<tr data-search="${esc([o.order_number,o.shipping_name,o.shipping_phone,o.payment_method].filter(Boolean).join(' '))}" data-status="${esc(o.status)}"><td><b>${esc(o.order_number||o.id.slice(0,8))}</b></td><td><select onchange="updateOrderStatus('${o.id}',this.value)">${['pending','confirmed','processing','packed','shipped','delivered','cancelled','returned','refunded'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td><select onchange="updatePaymentStatus('${o.id}',this.value)">${['pending','paid','failed','refunded'].map(s=>`<option value="${s}" ${o.payment_status===s?'selected':''}>${s}</option>`).join('')}</select><div class="muted">${esc(o.payment_method||'')}</div></td><td>Rs. ${Number(o.total_amount||0).toLocaleString()}</td><td>${new Date(o.created_at).toLocaleString()}</td><td><button onclick="viewOrder('${o.id}')">View</button></td></tr>`).join('')}</tbody></table></div>`;const apply=()=>{const q=$("#orderSearch").value.toLowerCase(),f=$("#orderFilter").value;document.querySelectorAll('#orderRows tr').forEach(r=>r.hidden=!!((q&&!r.dataset.search.toLowerCase().includes(q))||(f&&r.dataset.status!==f)))};$("#orderSearch").oninput=apply;$("#orderFilter").onchange=apply}
window.updateOrderStatus=async(id,status)=>{
  try{
    const result=await api("rpc/admin_update_order_status",{
      method:"POST",
      body:{p_order_id:id,p_status:status,p_note:null}
    });
    if(!result.data) throw new Error("Status update failed.");
    alert("Order status updated to: "+status);
    await orders();
  }catch(e){
    alert("Status update failed: "+(e.message||e));
    await orders();
  }
}
window.updatePaymentStatus=async(id,payment_status)=>{try{await api("orders?id=eq."+encodeURIComponent(id),{method:"PATCH",body:{payment_status},headers:{Prefer:"return=minimal"}});const paymentPatch=payment_status==='paid'?{status:"paid",paid_at:new Date().toISOString()}:{status:payment_status,paid_at:null};await api("payments?order_id=eq."+encodeURIComponent(id),{method:"PATCH",body:paymentPatch,headers:{Prefer:"return=minimal"}});await orders()}catch(e){alert("Payment status update failed: "+(e.message||e));await orders()}}
window.savePaymentReference=async id=>{try{const ref=$("#paymentRef_"+id)?.value.trim()||"";await api("payments?order_id=eq."+encodeURIComponent(id),{method:"PATCH",body:{provider_reference:ref},headers:{Prefer:"return=minimal"}});alert("Payment reference saved.");}catch(e){alert("Could not save payment reference: "+e.message)}};
window.viewOrder=async id=>{try{const [{data:o},{data:items},{data:h},{data:payments}]=await Promise.all([api("orders?select=*&id=eq."+encodeURIComponent(id)+"&limit=1"),api("order_items?select=*&order_id=eq."+encodeURIComponent(id)),api("order_status_history?select=*&order_id=eq."+encodeURIComponent(id)+"&order=created_at.desc"),api("payments?select=*&order_id=eq."+encodeURIComponent(id)+"&order=created_at.desc")]);const x=o?.[0];if(!x)throw new Error('Order not found');const pay=(payments||[])[0];$("#content").insertAdjacentHTML("beforeend",`<div class="modal"><div class="card" style="width:min(900px,100%);max-height:90vh;overflow:auto"><h2>Order ${esc(x.order_number||id)}</h2><p><strong>${esc(x.shipping_name||'Guest')}</strong> · ${esc(x.shipping_phone||'')}<br>${esc(x.shipping_address||'')}</p><div class="grid" style="margin:15px 0"><div class="stat"><span>Total</span><strong>Rs. ${Number(x.total_amount||0).toLocaleString()}</strong></div><div class="stat"><span>Payment</span><strong>${esc(x.payment_method||'—')}</strong><small>${esc(x.payment_status||'pending')}</small></div><div class="stat"><span>Courier</span><strong>${esc(x.courier_name||'—')}</strong><small>${esc(x.tracking_number||'')}</small></div></div><h3>Order status</h3><div class="form-row"><select id="orderStatusModal_${id}">${['pending','confirmed','processing','packed','shipped','delivered','cancelled','returned','refunded'].map(st=>`<option value="${st}" ${x.status===st?'selected':''}>${st}</option>`).join('')}</select><button onclick="updateOrderStatus('${id}',document.getElementById('orderStatusModal_${id}').value)">Save status</button></div><h3>Items</h3>${(items||[]).map(i=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee"><span>${esc(i.product_name)} × ${i.quantity}${i.sku?` · ${esc(i.sku)}`:''}</span><b>Rs. ${Number(i.line_total||0).toLocaleString()}</b></div>`).join('')}<h3 style="margin-top:18px">Payment record</h3>${pay?`<div class="box"><p><strong>${esc(pay.provider)}</strong> · ${esc(pay.status)} · Rs. ${Number(pay.amount||0).toLocaleString()}</p><div class="form-row"><input id="paymentRef_${id}" value="${esc(pay.provider_reference||'')}" placeholder="Transaction/reference ID"><button onclick="savePaymentReference('${id}')">Save reference</button></div><p class="muted" style="margin-top:6px">Reference is for manual verification until a live gateway is connected.</p></div>`:'<p class="muted">No payment record.</p>'}<h3>Delivery tracking</h3><div class="form-row"><input id="courier_${id}" value="${esc(x.courier_name||'')}" placeholder="Courier name"><input id="tracking_${id}" value="${esc(x.tracking_number||'')}" placeholder="Tracking number"></div><button onclick="saveTracking('${id}')" style="margin-top:8px">Save tracking</button><h3 style="margin-top:18px">History</h3>${(h||[]).map(v=>`<div class="muted" style="padding:5px 0">${new Date(v.created_at).toLocaleString()} — <strong>${esc(v.status)}</strong> ${esc(v.note||'')}</div>`).join('')}<button style="margin-top:15px" onclick="this.closest('.modal').remove()">Close</button></div></div>`)}catch(e){alert(e.message)}};
window.saveTracking=async id=>{try{await api("orders?id=eq."+encodeURIComponent(id),{method:"PATCH",body:{courier_name:$("#courier_"+id).value.trim()||null,tracking_number:$("#tracking_"+id).value.trim()||null},headers:{Prefer:"return=minimal"}});alert('Tracking details saved.');orders()}catch(e){alert(e.message)}};

async function reviews(){const {data,error}=await api("reviews?select=*,products(name)&order=created_at.desc&limit=500");if(error)throw error;const rows=data||[];const pending=rows.filter(r=>r.status==='pending').length;const approved=rows.filter(r=>r.status==='approved').length;const rejected=rows.filter(r=>r.status==='rejected').length;$("#content").innerHTML=`<div class="grid"><div class="stat"><span>Total reviews</span><strong>${rows.length}</strong></div><div class="stat"><span>Pending</span><strong>${pending}</strong></div><div class="stat"><span>Approved</span><strong>${approved}</strong></div><div class="stat"><span>Rejected</span><strong>${rejected}</strong></div></div><div class="toolbar" style="margin-top:16px"><select id="reviewFilter"><option value="">All reviews</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><input id="reviewSearch" placeholder="Search product or review…"></div><div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th>Rating</th><th>Review</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody id="reviewRows">${rows.map(r=>`<tr data-status="${esc(r.status)}" data-search="${esc([r.products?.name,r.title,r.body].filter(Boolean).join(' '))}"><td><b>${esc(r.products?.name||'—')}</b></td><td>${'★'.repeat(Number(r.rating||0))}${'☆'.repeat(5-Number(r.rating||0))}</td><td><strong>${esc(r.title||'')}</strong><div class="muted">${esc(r.body||'')}</div></td><td><span class="badge">${esc(r.status)}</span></td><td>${new Date(r.created_at).toLocaleDateString()}</td><td class="actions">${r.status!=='approved'?`<button onclick="moderateReview('${r.id}','approved')">Approve</button>`:''}${r.status!=='rejected'?`<button onclick="moderateReview('${r.id}','rejected')">Reject</button>`:''}<button class="danger" onclick="deleteReview('${r.id}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No reviews yet.</td></tr>'}</tbody></table></div>`;const apply=()=>{const f=$("#reviewFilter").value,q=$("#reviewSearch").value.toLowerCase();document.querySelectorAll('#reviewRows tr').forEach(r=>r.hidden=!!((f&&r.dataset.status!==f)||(q&&!r.dataset.search.toLowerCase().includes(q))))};$("#reviewFilter").onchange=apply;$("#reviewSearch").oninput=apply}
window.moderateReview=async(id,status)=>{try{await api('reviews?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{status},headers:{Prefer:'return=minimal'}});await reviews();}catch(e){alert('Review update failed: '+e.message)}};window.deleteReview=async id=>{if(!confirm('Delete this review?'))return;try{await api('reviews?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await reviews();}catch(e){alert('Delete failed: '+e.message)}};
async function customers(){const {data}=await api("profiles?select=*&role=eq.customer&order=created_at.desc");$("#content").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.full_name||"—")}</td><td>${esc(x.email||"")}</td><td>${esc(x.phone||"—")}</td><td>${new Date(x.created_at).toLocaleDateString()}</td></tr>`).join("")}</tbody></table></div>`}
async function simpleTable(table,cols){const {data}=await api(table+"?select=*&order=created_at.desc");$("#content").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${(data||[]).map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
async function shipping(){
  const [{data:methods,error:mErr},{data:rules,error:rErr}]=await Promise.all([
    api("shipping_methods?select=*&order=sort_order.asc,id.asc"),
    api("shipping_rules?select=*,shipping_methods(name,code)&order=city.asc,id.asc")
  ]);
  if(mErr) throw new Error(mErr.message||"Could not load shipping methods");
  if(rErr) throw new Error(rErr.message||"Could not load shipping rules");
  const ms=methods||[], rs=rules||[];
  const methodRows=ms.map(m=>`<tr><td><strong>${esc(m.name)}</strong><div class="muted">${esc(m.code)}</div></td><td>Rs. ${Number(m.base_cost||0).toLocaleString()}</td><td>${m.free_threshold!=null?`Rs. ${Number(m.free_threshold).toLocaleString()}`:"—"}</td><td>${m.active?'Active':'Hidden'}</td><td>${Number(m.sort_order||0)}</td><td><button class="small" onclick='editShippingMethod(${JSON.stringify(m)})'>Edit</button> <button class="small danger" onclick='deleteShippingMethod("${m.id}")'>Delete</button></td></tr>`).join("");
  const ruleRows=rs.map(r=>`<tr><td><strong>${esc(r.city)}</strong></td><td>${esc(r.shipping_methods?.name||'—')}</td><td>Rs. ${Number(r.cost||0).toLocaleString()}</td><td>${r.free_threshold!=null?`Rs. ${Number(r.free_threshold).toLocaleString()}`:"—"}</td><td>${r.active?'Active':'Hidden'}</td><td><button class="small" onclick='editShippingRule(${JSON.stringify(r)})'>Edit</button> <button class="small danger" onclick='deleteShippingRule("${r.id}")'>Delete</button></td></tr>`).join("");
  const opts=ms.filter(m=>m.active).map(m=>`<option value="${m.id}">${esc(m.name)} — Rs. ${Number(m.base_cost||0).toLocaleString()}</option>`).join("");
  $('#content').innerHTML=`
  <div class="grid"><div class="stat"><span>Shipping methods</span><strong>${ms.length}</strong><small class="muted">${ms.filter(x=>x.active).length} active</small></div><div class="stat"><span>City rules</span><strong>${rs.length}</strong><small class="muted">Location-specific pricing</small></div><div class="stat"><span>Free shipping</span><strong>${ms.filter(x=>x.active&&x.free_threshold!=null).length}</strong><small class="muted">Methods with thresholds</small></div></div>
  <div class="box" style="margin-top:18px"><div class="section-head"><div><h2>Shipping methods</h2><p class="muted">Control delivery price and free-shipping thresholds.</p></div><button class="primary" onclick="shippingMethodForm()">+ Add method</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Method</th><th>Base cost</th><th>Free over</th><th>Status</th><th>Order</th><th></th></tr></thead><tbody>${methodRows||'<tr><td colspan="6">No shipping methods yet.</td></tr>'}</tbody></table></div></div>
  <div class="box" style="margin-top:18px"><div class="section-head"><div><h2>City delivery rules</h2><p class="muted">Override delivery cost for specific cities.</p></div><button class="primary" onclick="shippingRuleForm()">+ Add city rule</button></div><div class="table-wrap"><table class="table"><thead><tr><th>City</th><th>Method</th><th>Cost</th><th>Free over</th><th>Status</th><th></th></tr></thead><tbody>${ruleRows||'<tr><td colspan="6">No city rules yet.</td></tr>'}</tbody></table></div></div>`;
}
function shippingMethodForm(item=null){
 const x=item||{}; $('#content').innerHTML=`<div class="box"><div class="section-head"><div><h2>${item?'Edit':'Add'} shipping method</h2><p class="muted">Example: Standard Delivery with a free-shipping threshold.</p></div></div><form id="shippingMethodForm" class="form-grid"><input type="hidden" id="smId" value="${esc(x.id||'')}"><label>Name<input id="smName" required value="${esc(x.name||'')}" placeholder="Standard Delivery"></label><label>Code<input id="smCode" required value="${esc(x.code||'')}" placeholder="standard"></label><label>Base cost (PKR)<input id="smCost" type="number" min="0" step="0.01" required value="${Number(x.base_cost||0)}"></label><label>Free shipping above (PKR)<input id="smFree" type="number" min="0" step="0.01" value="${x.free_threshold??''}" placeholder="5000"></label><label>Sort order<input id="smSort" type="number" min="0" step="1" value="${Number(x.sort_order||0)}"></label><label class="check"><input id="smActive" type="checkbox" ${x.active!==false?'checked':''}> Active</label><label>Description<textarea id="smDesc" rows="3" placeholder="Delivered in 2–5 business days">${esc(x.description||'')}</textarea></label><div><button class="primary" type="submit">Save method</button> <button type="button" onclick="shipping()">Cancel</button></div></form></div>`;
 $('#shippingMethodForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#smId').value;const body={name:$('#smName').value.trim(),code:$('#smCode').value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-'),base_cost:Number($('#smCost').value||0),free_threshold:$('#smFree').value===''?null:Number($('#smFree').value),sort_order:Number($('#smSort').value||0),active:$('#smActive').checked,description:$('#smDesc').value.trim()};if(!body.name||!body.code)throw new Error('Name and code are required');if(id)await api('shipping_methods?id=eq.'+encodeURIComponent(id),{method:'PATCH',body});else await api('shipping_methods',{method:'POST',body});await shipping();}catch(err){alert(err.message)}};
}
window.shippingMethodForm=shippingMethodForm;window.editShippingMethod=shippingMethodForm;
async function deleteShippingMethod(id){if(!confirm('Delete this shipping method?'))return;try{await api('shipping_methods?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await shipping();}catch(e){alert(e.message)}} window.deleteShippingMethod=deleteShippingMethod;
function shippingRuleForm(item=null){
 const x=item||{}; api('shipping_methods?select=id,name,code&active=eq.true&order=sort_order.asc,id.asc').then(({data:ms})=>{const opts=(ms||[]).map(m=>`<option value="${m.id}" ${m.id===x.shipping_method_id?'selected':''}>${esc(m.name)}</option>`).join('');$('#content').innerHTML=`<div class="box"><div class="section-head"><div><h2>${item?'Edit':'Add'} city delivery rule</h2><p class="muted">Use an exact city name, e.g. Faisalabad.</p></div></div><form id="shippingRuleForm" class="form-grid"><input type="hidden" id="srId" value="${esc(x.id||'')}"><label>City<input id="srCity" required value="${esc(x.city||'')}" placeholder="Faisalabad"></label><label>Shipping method<select id="srMethod" required>${opts}</select></label><label>City cost (PKR)<input id="srCost" type="number" min="0" step="0.01" required value="${Number(x.cost||0)}"></label><label>Free shipping above (PKR)<input id="srFree" type="number" min="0" step="0.01" value="${x.free_threshold??''}" placeholder="5000"></label><label class="check"><input id="srActive" type="checkbox" ${x.active!==false?'checked':''}> Active</label><div><button class="primary" type="submit">Save rule</button> <button type="button" onclick="shipping()">Cancel</button></div></form></div>`;$('#shippingRuleForm').onsubmit=async e=>{e.preventDefault();try{const id=$('#srId').value;const body={city:$('#srCity').value.trim(),shipping_method_id:$('#srMethod').value,cost:Number($('#srCost').value||0),free_threshold:$('#srFree').value===''?null:Number($('#srFree').value),active:$('#srActive').checked};if(id)await api('shipping_rules?id=eq.'+encodeURIComponent(id),{method:'PATCH',body});else await api('shipping_rules',{method:'POST',body});await shipping()}catch(err){alert(err.message)}}}).catch(e=>alert(e.message));
} window.shippingRuleForm=shippingRuleForm;window.editShippingRule=shippingRuleForm;
async function deleteShippingRule(id){if(!confirm('Delete this city rule?'))return;try{await api('shipping_rules?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await shipping()}catch(e){alert(e.message)}} window.deleteShippingRule=deleteShippingRule;

async function inventory(){
  const [{data:products},{data:variants},{data:tx}]=await Promise.all([
    api("products?select=id,name,sku,stock,low_stock_threshold,status,updated_at&order=updated_at.desc&limit=1000"),
    api("product_variants?select=id,product_id,name,sku,stock,low_stock_threshold,active&order=product_id.asc,name.asc&limit=2000"),
    api("inventory_transactions?select=id,product_id,variant_id,quantity_change,reason,note,created_at,created_by&order=created_at.desc&limit=100")
  ]);
  const ps=products||[], vs=variants||[], ts=tx||[];
  const byProduct={}; vs.forEach(v=>(byProduct[v.product_id]??=[]).push(v));
  const active=ps.filter(p=>p.status==='active');
  let low=0, out=0, total=0;
  active.forEach(p=>{const pv=(byProduct[p.id]||[]).filter(v=>v.active); const stock=pv.length?pv.reduce((n,v)=>n+Number(v.stock||0),0):Number(p.stock||0); const threshold=pv.length?Math.max(...pv.map(v=>Number(v.low_stock_threshold??5))):Number(p.low_stock_threshold??5); total+=stock; if(stock<=0)out++; else if(stock<=threshold)low++;});
  const money=n=>Number(n||0).toLocaleString();
  const rows=active.map(p=>{const pv=(byProduct[p.id]||[]).filter(v=>v.active);const stock=pv.length?pv.reduce((n,v)=>n+Number(v.stock||0),0):Number(p.stock||0);const threshold=pv.length?Math.max(...pv.map(v=>Number(v.low_stock_threshold??5))):Number(p.low_stock_threshold??5);const state=stock<=0?'Out of stock':stock<=threshold?'Low stock':'In stock';return `<tr><td><b>${esc(p.name)}</b><div class="muted">${esc(p.sku||'')}${pv.length?` · ${pv.length} variants`:''}</div></td><td><b>${money(stock)}</b></td><td>${money(threshold)}</td><td><span class="badge ${stock<=threshold?'danger':''}">${state}</span></td><td><button onclick="inventoryAdjust('${p.id}','',${Number(p.stock||0)},${Number(p.low_stock_threshold??5)})">Adjust</button></td></tr>`}).join('')||'<tr><td colspan="5" class="muted">No active products.</td></tr>';
  const txRows=ts.map(t=>`<tr><td>${new Date(t.created_at).toLocaleString()}</td><td>${esc(t.reason||'adjustment')}</td><td><b>${Number(t.quantity_change)>0?'+':''}${Number(t.quantity_change||0)}</b></td><td>${esc(t.note||'')}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">No inventory transactions yet.</td></tr>';
  const variantRows=vs.filter(v=>v.active).map(v=>{const p=ps.find(x=>x.id===v.product_id);const st=Number(v.stock||0),th=Number(v.low_stock_threshold??5);return `<tr><td>${esc(p?.name||'Unknown')}<div class="muted">${esc(v.name||'Variant')} · ${esc(v.sku||'')}</div></td><td>${st}</td><td>${th}</td><td><span class="badge ${st<=th?'danger':''}">${st<=0?'Out of stock':st<=th?'Low stock':'In stock'}</span></td><td><button onclick="inventoryAdjust('${v.product_id}','${v.id}',${st},${th})">Adjust</button></td></tr>`}).join('')||'<tr><td colspan="5" class="muted">No active variants.</td></tr>';
  $("#content").innerHTML=`<div class="page-head"><div><h2>Inventory Control</h2><p class="muted">Live stock overview, variant inventory, low-stock alerts and an auditable inventory ledger.</p></div><button class="primary" onclick="loadTab('products')">Manage Products</button></div>
  <div class="grid"><div class="stat"><span>Units in stock</span><strong>${money(total)}</strong><small class="muted">Active catalog</small></div><div class="stat"><span>Low stock</span><strong>${low}</strong><small class="muted">At threshold or below</small></div><div class="stat"><span>Out of stock</span><strong>${out}</strong><small class="muted">No available units</small></div><div class="stat"><span>Transactions</span><strong>${ts.length}</strong><small class="muted">Latest 100 shown</small></div></div>
  <div class="box" style="margin-top:16px"><div class="section-head"><div><h3>Product inventory</h3><p class="muted">Parent stock is shown for products without variants; variant stock is aggregated when variants exist.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th>Available</th><th>Threshold</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="box" style="margin-top:16px"><div class="section-head"><div><h3>Variant inventory</h3><p class="muted">Adjust a specific size, color or other variant without touching sibling variants.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Product / Variant</th><th>Stock</th><th>Threshold</th><th>Status</th><th></th></tr></thead><tbody>${variantRows}</tbody></table></div></div>
  <div class="box" style="margin-top:16px"><div class="section-head"><div><h3>Inventory ledger</h3><p class="muted">Recent stock movements recorded by the admin system.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Reason</th><th>Change</th><th>Note</th></tr></thead><tbody>${txRows}</tbody></table></div></div>`;
}
window.inventoryAdjust=async function(productId,variantId,current,threshold){
  const mode=prompt('Enter stock change. Use +10 to add 10 units, -3 to remove 3 units, or enter the final stock number prefixed with = (example: =25).', '+0');
  if(mode===null)return;
  const value=mode.trim(); let change;
  if(value.startsWith('=')){const finalStock=Number(value.slice(1));if(!Number.isInteger(finalStock)||finalStock<0){alert('Final stock must be a whole number >= 0.');return;}change=finalStock-Number(current||0);}else{change=Number(value);if(!Number.isInteger(change)){alert('Stock change must be a whole number.');return;}if(Number(current||0)+change<0){alert('Stock cannot go below zero.');return;}}
  const note=prompt('Optional note:', 'Manual inventory adjustment')??'Manual inventory adjustment';
  try{const r=await api('rpc/adjust_inventory_secure',{method:'POST',body:{p_product_id:productId,p_variant_id:variantId||null,p_quantity_change:change,p_reason:'admin_manual_adjustment',p_note:note},headers:{Prefer:'return=representation'}});alert(`Inventory updated. New stock: ${Number(r.data?.stock??0)}`);await inventory();}catch(e){alert('Inventory update failed: '+e.message)}
};

async function payments(){const {data}=await api("site_settings?select=*&order=key.asc");const m=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));const keys=["payment.bank_instructions","payment.jazzcash_instructions","payment.easypaisa_instructions"];$("#content").innerHTML=`<div class="page-head"><div><h2>Payment Settings</h2><p>Configure customer-facing manual payment instructions. Gateway API credentials are never stored in the browser.</p></div></div><div class="card" style="margin-bottom:16px"><h3>Online Gateway Status</h3><p class="muted">JazzCash live integration is server-side and requires merchant secrets in Supabase Edge Function Secrets. Easypaisa requires the exact merchant integration guide before live fields are enabled.</p><div class="grid"><div class="box"><strong>JazzCash</strong><p class="muted">Gateway adapter prepared · manual mode remains active until secrets are configured.</p></div><div class="box"><strong>Easypaisa</strong><p class="muted">Merchant adapter reserved · exact provider fields required before activation.</p></div></div></div><div class="card"><div class="form-group"><label>Bank transfer instructions</label><textarea id="pay_bank" rows="4" placeholder="Account title, bank, IBAN/account number, and payment instructions">${esc(m[keys[0]]||"")}</textarea></div><div class="form-group"><label>JazzCash instructions</label><textarea id="pay_jazz" rows="4">${esc(m[keys[1]]||"")}</textarea></div><div class="form-group"><label>Easypaisa instructions</label><textarea id="pay_easy" rows="4">${esc(m[keys[2]]||"")}</textarea></div><button class="btn btn--primary" id="savePaymentSettings">Save payment settings</button><p id="paySaveMsg" class="muted"></p></div>`;$("#savePaymentSettings").onclick=async()=>{try{await Promise.all([["payment.bank_instructions",$("#pay_bank").value],["payment.jazzcash_instructions",$("#pay_jazz").value],["payment.easypaisa_instructions",$("#pay_easy").value]].map(([key,value])=>api("site_settings",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:{key,value}})));$("#paySaveMsg").textContent="Payment settings saved."; }catch(e){$("#paySaveMsg").textContent="Save failed: "+e.message;}}}


async function aiAgent(){
  $("#content").innerHTML=`
    <div class="box">
      <div class="page-head"><div><h2>AI Store Agent</h2><p class="muted">AI assistant for store questions, products, orders and customer support.</p></div></div>
      <div id="aiLog" style="display:flex;flex-direction:column;gap:10px;max-height:460px;overflow:auto;margin:12px 0;padding:8px;background:#fafafa;border-radius:12px">
        <div class="box" style="margin:0"><strong>Agent</strong><p class="muted">Ask me about products, delivery, payments, orders, coupons or store policies.</p></div>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <textarea id="aiInput" rows="2" style="flex:1" placeholder="e.g. Which products are on sale?"></textarea>
        <button class="primary" id="aiSend" type="button">Send</button>
      </div>
      <p id="aiStatus" class="muted"></p>
    </div>
    <div class="box" style="margin-top:16px">
      <h3>WhatsApp</h3>
      <p class="muted">The same agent can power WhatsApp replies once the WhatsApp Cloud API credentials and webhook are connected. No WhatsApp token is stored in this browser.</p>
    </div>`;
  const log=$("#aiLog"), input=$("#aiInput"), btn=$("#aiSend"), stat=$("#aiStatus");
  const add=(who,text)=>{const d=document.createElement("div");d.className="box";d.style.margin="0";d.innerHTML=`<strong>${esc(who)}</strong><p style="white-space:pre-wrap">${esc(text)}</p>`;log.appendChild(d);log.scrollTop=log.scrollHeight;};
  async function send(){
    const text=input.value.trim(); if(!text)return;
    add("You",text); input.value=""; btn.disabled=true; stat.textContent="Thinking…";
    try{
      const r=await timeoutFetch(SUPABASE_URL+"/functions/v1/ai-store-agent",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY,...(currentSession?.access_token?{"Authorization":"Bearer "+currentSession.access_token}:{})},body:JSON.stringify({message:text,channel:"admin"})},30000);
      const j=await readJson(r); if(!r.ok)throw new Error(j.error||j.message||"Agent request failed");
      add("Agent",j.reply||"I couldn't generate a reply.");
    }catch(e){add("Agent","Agent is not connected yet. Please deploy the Supabase AI Edge Function and configure its AI secret.");stat.textContent=e.message||"Request failed";return;}
    finally{btn.disabled=false;stat.textContent="";}
  }
  btn.onclick=send; input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});
}

async function content(){
  let [{data:settings},{data:banners},{data:products}]=await Promise.all([api("site_settings?select=*&order=key.asc"),api("banners?select=*&order=sort_order.asc,id.asc"),api("products?select=id,name,sku,stock,featured,status&order=name.asc")]);
  const map={};(settings||[]).forEach(x=>map[x.key]=x.value);
  if(!(banners||[]).length && map.demo_banner_seeded!=='true'){
    try{
      await api('banners',{method:'POST',body:{title:'Mega Beauty Sale — Up to 30% OFF',subtitle:'Fresh beauty, home and lifestyle essentials with limited-time savings.',image_url:location.origin+'/demo-banner.svg',button_text:'Shop the sale',button_url:'/catalog/',sort_order:0,active:true},headers:{Prefer:'return=minimal'}});
      await api('site_settings',{method:'POST',body:{key:'demo_banner_seeded',value:'true'},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});
      const refreshed=await api("banners?select=*&order=sort_order.asc,id.asc"); banners=refreshed.data||[];
    }catch(e){console.warn('Demo banner seed skipped:',e.message)}
  }
  const val=(k,f)=>esc(map[k]??f);
  let sliderCfg={enabled:false,title:'Featured products',description:'Shop our handpicked favorites.',product_ids:[],autoplay:true,speed:4000};
  try{const v=map.product_slider; const parsed=typeof v==='string'?JSON.parse(v):v; if(parsed&&typeof parsed==='object') sliderCfg={...sliderCfg,...parsed};}catch(_){}
  let heroSlides=[];
  try{const v=map.hero_slides; const parsed=typeof v==='string'?JSON.parse(v):v; if(Array.isArray(parsed)) heroSlides=parsed;}catch(_){}
  const heroRows=heroSlides.map((h,i)=>{const p=(products||[]).find(pr=>String(pr.id)===String(h.product_id));return `<div class="hero-cms-row" data-index="${i}"><div class="hero-cms-num">${i+1}</div><div class="hero-cms-fields"><select class="hero-product" data-field="product_id"><option value="">Select product</option>${(products||[]).map(pr=>`<option value="${esc(pr.id)}" ${String(pr.id)===String(h.product_id)?'selected':''}>${esc(pr.name)}${pr.sku?' · '+esc(pr.sku):''}</option>`).join('')}</select><input class="hero-eyebrow" data-field="eyebrow" value="${esc(h.eyebrow||'FEATURED PRODUCT')}" placeholder="Eyebrow"><input class="hero-image" data-field="image_url" value="${esc(h.image_url||'')}" placeholder="Optional image URL override"><input class="hero-title" data-field="title" value="${esc(h.title||p?.name||'')}" placeholder="Slide title"><textarea class="hero-desc" data-field="description" rows="2" placeholder="Slide description">${esc(h.description||'')}</textarea><div class="hero-cms-inline"><input data-field="button_text" value="${esc(h.button_text||'View product')}" placeholder="Button text"><input type="number" min="2600" max="15000" step="100" data-field="speed" value="${Number(h.speed)||4800}" placeholder="Speed ms"><label><input type="checkbox" data-field="remove_background" ${h.remove_background!==false?'checked':''}> Auto cutout</label><label><input type="checkbox" data-field="active" ${h.active!==false?'checked':''}> Active</label></div></div><button type="button" class="danger hero-remove">Remove</button></div>`}).join('');
  const selectedIds=new Set((sliderCfg.product_ids||[]).map(String));
  const productOptions=(products||[]).map(pr=>`<label class="cms-product-option"><input type="checkbox" name="slider_product" value="${esc(pr.id)}" ${selectedIds.has(String(pr.id))?'checked':''}><span><b>${esc(pr.name)}</b><small>${esc(pr.sku||'')} · Stock ${Number(pr.stock||0)}</small></span></label>`).join('');
  const bannerRows=(banners||[]).map(b=>`<tr><td><b>${esc(b.title||'Untitled')}</b><div class="muted">${esc(b.subtitle||'')}</div></td><td>${b.active?'Active':'Hidden'}</td><td>${Number(b.sort_order||0)}</td><td class="actions"><button onclick="editBanner('${b.id}')">Edit</button><button class="danger" onclick="deleteBanner('${b.id}')">Delete</button></td></tr>`).join('');
  $("#content").innerHTML=`
  <div class="box"><h3>Storefront CMS</h3><p class="muted">Edit production storefront messaging without changing code. Values are stored in Supabase.</p>
    <form id="cmsSettingsForm">
      <div class="form-row"><div><label>Announcement bar</label><input id="cms_announcement" value="${val('announcement_bar','Free shipping on every order — ہر آرڈر پر مفت ترسیل')}" maxlength="180"></div><div><label>WhatsApp number</label><input id="cms_whatsapp" value="${val('whatsapp_number','923000000000')}" maxlength="20" placeholder="923XXXXXXXXX"></div></div>
      <div class="form-row"><div><label>Hero eyebrow</label><input id="cms_hero_eyebrow" value="${val('hero_eyebrow','SALE IS LIVE — UP TO 50% OFF')}" maxlength="90"></div><div><label>Hero button text</label><input id="cms_hero_button" value="${val('hero_button_text','Shop the sale')}" maxlength="40"></div></div>
      <label>Hero headline</label><input id="cms_hero_title" value="${val('hero_title','Beauty and home essentials, done right.')}" maxlength="140">
      <label>Hero description</label><textarea id="cms_hero_desc" rows="3" maxlength="320">${val('hero_description','Curated skincare, kitchen upgrades, watches and fragrance — vetted for quality, priced fairly, delivered fast across the country.')}</textarea>
      <label>Footer description</label><textarea id="cms_footer_desc" rows="2" maxlength="240">${val('footer_description','A hybrid storefront for beauty, home and lifestyle essentials — curated drops, honest prices, fast delivery.')}</textarea>
      <button class="primary" type="submit">Save storefront settings</button><span id="cmsSettingsMsg" class="muted" style="margin-left:10px"></span>
    </form>
  </div>
  <div class="box" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3 style="margin:0">Hero Product Carousel</h3><p class="muted">Unlimited hero slides. Select products, change text/image, remove slides and control speed. Products appear in a round stage.</p></div><button type="button" id="addHeroSlide" class="primary">+ Add slide</button></div><div id="heroSlidesEditor" style="margin-top:14px">${heroRows||'<div class="muted" id="heroEmpty">No custom hero slides yet. Add your first slide.</div>'}</div><div style="display:flex;gap:10px;align-items:center;margin-top:12px"><button type="button" id="saveHeroSlides" class="primary">Save hero slides</button><span id="heroMsg" class="muted"></span></div></div>
  <div class="box" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3 style="margin:0">Homepage Product Slider</h3><p class="muted">Control a left/right product carousel directly from CMS. No code changes needed.</p></div></div>
    <form id="productSliderForm" style="margin-top:14px">
      <div class="form-row"><div><label>Slider status</label><select id="ps_enabled"><option value="false" ${!sliderCfg.enabled?'selected':''}>Off</option><option value="true" ${sliderCfg.enabled?'selected':''}>On</option></select></div><div><label>Auto-slide</label><select id="ps_autoplay"><option value="true" ${sliderCfg.autoplay!==false?'selected':''}>On</option><option value="false" ${sliderCfg.autoplay===false?'selected':''}>Off</option></select></div></div>
      <div class="form-row"><div><label>Section title</label><input id="ps_title" maxlength="80" value="${esc(sliderCfg.title)}"></div><div><label>Slide speed (ms)</label><input id="ps_speed" type="number" min="1800" max="15000" step="500" value="${Number(sliderCfg.speed)||4000}"></div></div>
      <label>Section description</label><input id="ps_desc" maxlength="160" value="${esc(sliderCfg.description)}">
      <label>Select products</label><div class="cms-product-picker">${productOptions||'<span class="muted">No products found.</span>'}</div>
      <button class="primary" type="submit">Save product slider</button><span id="psMsg" class="muted" style="margin-left:10px"></span>
    </form>
  </div>
  <div class="box" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3 style="margin:0">Homepage Banners</h3><p class="muted">Create promotional cards with an image, CTA and ordering.</p></div><button onclick="newBanner()" class="primary">+ Add banner</button></div>
    <div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Banner</th><th>Status</th><th>Order</th><th></th></tr></thead><tbody>${bannerRows||'<tr><td colspan="4" class="muted">No banners yet.</td></tr>'}</tbody></table></div>
  </div>`;
  function heroOptions(){return `<option value="">Select product</option>${(products||[]).map(pr=>`<option value="${esc(pr.id)}">${esc(pr.name)}${pr.sku?' · '+esc(pr.sku):''}</option>`).join('')}`;}
  function addHeroRow(data={}){const wrap=document.getElementById('heroSlidesEditor');const empty=document.getElementById('heroEmpty');if(empty)empty.remove();const i=wrap.querySelectorAll('.hero-cms-row').length;const div=document.createElement('div');div.className='hero-cms-row';div.innerHTML=`<div class="hero-cms-num">${i+1}</div><div class="hero-cms-fields"><select class="hero-product" data-field="product_id">${heroOptions()}</select><input data-field="eyebrow" value="${esc(data.eyebrow||'FEATURED PRODUCT')}" placeholder="Eyebrow"><input data-field="image_url" value="${esc(data.image_url||'')}" placeholder="Optional image URL override"><input data-field="title" value="${esc(data.title||'')}" placeholder="Slide title"><textarea data-field="description" rows="2" placeholder="Slide description">${esc(data.description||'')}</textarea><div class="hero-cms-inline"><input data-field="button_text" value="${esc(data.button_text||'View product')}" placeholder="Button text"><input type="number" min="2600" max="15000" step="100" data-field="speed" value="${Number(data.speed)||4800}" placeholder="Speed ms"><label><input type="checkbox" data-field="active" ${data.active!==false?'checked':''}> Active</label></div></div><button type="button" class="danger hero-remove">Remove</button>`;wrap.appendChild(div);if(data.product_id)div.querySelector('[data-field="product_id"]').value=data.product_id;wireHeroEditor();renumberHero();}
  function renumberHero(){document.querySelectorAll('.hero-cms-row').forEach((r,i)=>r.querySelector('.hero-cms-num').textContent=i+1);}
  function wireHeroEditor(){document.querySelectorAll('.hero-remove').forEach(btn=>{if(btn.dataset.wired)return;btn.dataset.wired='1';btn.onclick=()=>{btn.closest('.hero-cms-row').remove();renumberHero();}});}
  wireHeroEditor();document.getElementById('addHeroSlide')?.addEventListener('click',()=>addHeroRow());
  document.getElementById('saveHeroSlides')?.addEventListener('click',async()=>{const msg=document.getElementById('heroMsg');msg.textContent='Saving…';try{const rows=Array.from(document.querySelectorAll('.hero-cms-row'));const data=rows.map(r=>{const get=f=>r.querySelector(`[data-field="${f}"]`);return {product_id:get('product_id').value||null,eyebrow:get('eyebrow').value.trim(),image_url:get('image_url').value.trim(),title:get('title').value.trim(),description:get('description').value.trim(),button_text:get('button_text').value.trim()||'View product',speed:Math.min(15000,Math.max(2600,Number(get('speed').value)||4800)),remove_background:get('remove_background').checked,active:get('active').checked};}).filter(x=>x.product_id);await api('site_settings',{method:'POST',body:{key:'hero_slides',value:JSON.stringify(data)},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});msg.textContent=`Saved ${data.length} hero slide${data.length===1?'':'s'}.`;setTimeout(()=>msg.textContent='',2500);}catch(e){msg.textContent='Save failed: '+e.message;}});

  $("#productSliderForm").onsubmit=async e=>{e.preventDefault();const msg=$("#psMsg");msg.textContent='Saving…';try{const cfg={enabled:$("#ps_enabled").value==='true',autoplay:$("#ps_autoplay").value==='true',title:$("#ps_title").value.trim()||'Featured products',description:$("#ps_desc").value.trim()||'Shop our handpicked favorites.',speed:Math.min(15000,Math.max(1800,Number($("#ps_speed").value)||4000)),product_ids:Array.from(document.querySelectorAll('input[name="slider_product"]:checked')).map(x=>x.value)};await api("site_settings",{method:"POST",body:{key:"product_slider",value:JSON.stringify(cfg)},headers:{Prefer:"resolution=merge-duplicates,return=minimal"}});msg.textContent='Product slider saved.';}catch(e){msg.textContent='Save failed: '+e.message;}};
  $("#cmsSettingsForm").onsubmit=async e=>{e.preventDefault();const msg=$("#cmsSettingsMsg");msg.textContent='Saving…';try{const items={announcement_bar:$("#cms_announcement").value.trim(),whatsapp_number:$("#cms_whatsapp").value.trim(),hero_eyebrow:$("#cms_hero_eyebrow").value.trim(),hero_button_text:$("#cms_hero_button").value.trim(),hero_title:$("#cms_hero_title").value.trim(),hero_description:$("#cms_hero_desc").value.trim(),footer_description:$("#cms_footer_desc").value.trim()};for(const [key,value] of Object.entries(items)){await api("site_settings",{method:"POST",body:{key,value},headers:{Prefer:"resolution=merge-duplicates,return=minimal"}})}msg.textContent='Saved successfully.';setTimeout(()=>msg.textContent='',2500);}catch(e){msg.textContent='Save failed: '+e.message;}};
}

async function seoMarketing(){
  const [{data:settings},{data:campaigns}]=await Promise.all([
    api("site_settings?select=key,value&order=key.asc"),
    api("marketing_campaigns?select=*&order=created_at.desc")
  ]);
  const map={};(settings||[]).forEach(x=>map[x.key]=x.value);
  const val=(k,d)=>esc(map[k]??d);
  const rows=(campaigns||[]).map(c=>`<tr>
    <td><b>${esc(c.name)}</b><div class="muted small">${esc(c.slug||'')}</div></td>
    <td>${esc(c.source||'')} / ${esc(c.medium||'')}</td>
    <td>${esc(c.campaign||'')}</td>
    <td>${c.active?'Active':'Off'}</td>
    <td class="actions"><button onclick="editCampaign('${c.id}')">Edit</button><button onclick="copyCampaign('${c.id}')">Copy URL</button><button class="danger" onclick="deleteCampaign('${c.id}')">Delete</button></td>
  </tr>`).join('');
  $("#content").innerHTML=`
  <div class="page-head"><div><h2>SEO & Marketing Pro</h2><p class="muted">Control search metadata, social sharing and campaign tracking from one place.</p></div></div>
  <div class="box">
    <h3>Search & Social SEO</h3>
    <p class="muted">These defaults are applied to the storefront. Product pages use each product's SEO title/description when available.</p>
    <form id="seoSettingsForm">
      <label>Site title</label><input id="seo_title" maxlength="120" value="${val('seo.title','ZM Hybrid Store — Beauty, Home & Lifestyle Essentials')}">
      <label>Meta description</label><textarea id="seo_desc" rows="3" maxlength="320">${val('seo.description','Shop quality beauty, home & kitchen, watches, fragrance and electronics at ZM Hybrid Store. Cash on delivery available across Pakistan.')}</textarea>
      <div class="form-row"><div><label>Keywords</label><input id="seo_keywords" maxlength="300" value="${val('seo.keywords','ZM Hybrid Store, online shopping Pakistan, beauty, home kitchen, watches, fragrance, electronics')}"></div><div><label>Canonical site URL</label><input id="seo_canonical" type="url" maxlength="300" value="${val('seo.canonical','https://zm-hybrid-store.pages.dev/')}"></div></div>
      <div class="form-row"><div><label>Social share image URL</label><input id="seo_og" type="url" maxlength="500" value="${val('seo.og_image','https://zm-hybrid-store.pages.dev/og-image.svg')}"></div><div><label>Twitter/X card</label><select id="seo_twitter"><option value="summary_large_image" ${String(map['seo.twitter_card']||'summary_large_image')==='summary_large_image'?'selected':''}>Large image</option><option value="summary" ${String(map['seo.twitter_card']||'')==='summary'?'selected':''}>Summary</option></select></div></div>
      <div class="form-row"><div><label>Google verification code</label><input id="seo_google" maxlength="300" value="${val('seo.google_verification','')}"></div><div><label>Bing verification code</label><input id="seo_bing" maxlength="300" value="${val('seo.bing_verification','')}"></div></div>
      <label>Organization / brand description</label><textarea id="seo_orgdesc" rows="2" maxlength="300">${val('seo.org_description','ZM Hybrid Store is a Pakistan-wide online store for curated beauty, home, lifestyle and everyday essentials.')}</textarea>
      <button class="primary" type="submit">Save SEO settings</button><span id="seoMsg" class="muted" style="margin-left:10px"></span>
    </form>
  </div>
  <div class="box" style="margin-top:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3>Marketing Campaigns</h3><p class="muted">Build trackable UTM links for ads, social posts and WhatsApp campaigns.</p></div><button class="primary" type="button" id="newCampaign">+ New campaign</button></div>
    <div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Campaign</th><th>Source / Medium</th><th>Campaign key</th><th>Status</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="muted">No campaigns yet.</td></tr>'}</tbody></table></div>
    <div id="campaignFormWrap" style="margin-top:16px"></div>
  </div>`;
  $("#seoSettingsForm").onsubmit=async e=>{e.preventDefault();const msg=$("#seoMsg");msg.textContent='Saving…';try{
    const items={
      'seo.title':$("#seo_title").value.trim(),'seo.description':$("#seo_desc").value.trim(),
      'seo.keywords':$("#seo_keywords").value.trim(),'seo.canonical':$("#seo_canonical").value.trim()||location.origin+'/',
      'seo.og_image':$("#seo_og").value.trim(),'seo.twitter_card':$("#seo_twitter").value,
      'seo.google_verification':$("#seo_google").value.trim(),'seo.bing_verification':$("#seo_bing").value.trim(),
      'seo.org_description':$("#seo_orgdesc").value.trim()
    };
    for(const [key,value] of Object.entries(items)) await api("site_settings",{method:"POST",body:{key,value},headers:{Prefer:"resolution=merge-duplicates,return=minimal"}});
    msg.textContent='SEO settings saved.';setTimeout(()=>msg.textContent='',2500);
  }catch(e){msg.textContent='Save failed: '+e.message;}};
  $("#newCampaign").onclick=()=>campaignForm();
}
function campaignForm(c={}){
  const wrap=$("#campaignFormWrap"); if(!wrap)return;
  const id=c.id||'';
  wrap.innerHTML=`<div class="box" style="background:#faf7f4"><h3>${id?'Edit':'New'} campaign</h3>
  <form id="campaignForm">
    <div class="form-row"><div><label>Name</label><input id="cf_name" required maxlength="100" value="${esc(c.name||'')}"></div><div><label>Slug</label><input id="cf_slug" maxlength="100" value="${esc(c.slug||'')}" placeholder="summer-sale"></div></div>
    <div class="form-row"><div><label>Source</label><input id="cf_source" maxlength="60" value="${esc(c.source||'facebook')}"></div><div><label>Medium</label><input id="cf_medium" maxlength="60" value="${esc(c.medium||'social')}"></div></div>
    <div class="form-row"><div><label>Campaign</label><input id="cf_campaign" maxlength="100" value="${esc(c.campaign||'')}"></div><div><label>Landing path</label><input id="cf_path" maxlength="300" value="${esc(c.landing_path||'/catalog/')}"></div></div>
    <div class="form-row"><div><label>Status</label><select id="cf_active"><option value="true" ${c.active!==false?'selected':''}>Active</option><option value="false" ${c.active===false?'selected':''}>Off</option></select></div><div><label>Content (optional)</label><input id="cf_content" maxlength="100" value="${esc(c.content||'')}"></div></div>
    <button class="primary">Save campaign</button> <button type="button" id="cf_cancel">Cancel</button><span id="cf_msg" class="muted" style="margin-left:10px"></span>
  </form></div>`;
  $("#cf_cancel").onclick=()=>wrap.innerHTML='';
  $("#campaignForm").onsubmit=async e=>{e.preventDefault();const msg=$("#cf_msg");msg.textContent='Saving…';try{
    const payload={name:$("#cf_name").value.trim(),slug:($("#cf_slug").value.trim()||slugify($("#cf_name").value.trim())),source:$("#cf_source").value.trim(),medium:$("#cf_medium").value.trim(),campaign:$("#cf_campaign").value.trim()||null,landing_path:$("#cf_path").value.trim()||'/catalog/',content:$("#cf_content").value.trim()||null,active:$("#cf_active").value==='true'};
    if(id) await api("marketing_campaigns?id=eq."+encodeURIComponent(id),{method:'PATCH',body:payload,headers:{Prefer:'return=minimal'}});
    else await api("marketing_campaigns",{method:'POST',body:payload,headers:{Prefer:'return=minimal'}});
    await seoMarketing();
  }catch(e){msg.textContent='Save failed: '+e.message;}};
}
function slugify(text){return String(text||'').toLowerCase().trim().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
window.editCampaign=async id=>{try{const {data}=await api('marketing_campaigns?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1');if(data?.[0])campaignForm(data[0]);}catch(e){alert(e.message)}};
window.deleteCampaign=async id=>{if(!confirm('Delete this campaign?'))return;try{await api('marketing_campaigns?id=eq.'+encodeURIComponent(id),{method:'DELETE'});seoMarketing();}catch(e){alert(e.message)}};
window.copyCampaign=async id=>{try{const {data}=await api('marketing_campaigns?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1');const c=data?.[0];if(!c)return;const u=new URL(c.landing_path||'/catalog/',location.origin);u.searchParams.set('utm_source',c.source||'');u.searchParams.set('utm_medium',c.medium||'');if(c.campaign)u.searchParams.set('utm_campaign',c.campaign);if(c.content)u.searchParams.set('utm_content',c.content);await navigator.clipboard.writeText(u.href);alert('Campaign URL copied.');}catch(e){alert('Could not copy URL: '+e.message)}};
async function uploadBannerImage(file){
  if(!file)return null;
  if(file.size>5*1024*1024)throw new Error('Banner image must be 5MB or smaller.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use JPG, PNG or WebP for banner images.');
  const safe=file.name.toLowerCase().replace(/[^a-z0-9.]+/g,'-'),path=`banners/${crypto.randomUUID()}-${safe}`;
  const r=await timeoutFetch(SUPABASE_URL+'/storage/v1/object/'+PRODUCT_BUCKET+'/'+path,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+currentSession.token,'Content-Type':file.type,'x-upsert':'false'},body:file},30000);
  const j=await readJson(r); if(!r.ok)throw new Error(j.message||j.error||j.error_description||j.statusCode||`Storage request failed (${r.status})`);
  return SUPABASE_URL+'/storage/v1/object/public/'+PRODUCT_BUCKET+'/'+path;
}
function bannerForm(b={}){
  const id=b.id||'',image=esc(b.image_url||'');
  $("#content").innerHTML=`<div class="box"><h3>${id?'Edit':'Add'} homepage banner</h3><p class="muted">Create your own promotional banner. Upload an image or paste an image URL. Recommended: wide landscape image around 1600×700.</p><form id="bannerForm">
  <label>Title</label><input id="bf_title" required maxlength="100" value="${esc(b.title||'')}">
  <label>Subtitle</label><textarea id="bf_subtitle" rows="3" maxlength="220">${esc(b.subtitle||'')}</textarea>
  <div class="form-row"><div><label>Upload banner image</label><input id="bf_file" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted">JPG, PNG or WebP · max 5MB</small></div><div><label>Or image URL</label><input id="bf_image" type="url" maxlength="500" placeholder="https://..." value="${image}"></div></div>
  <div id="bf_preview" class="banner-admin-preview" ${image?'':'hidden'}>${image?`<img src="${image}" alt="Banner preview">`:''}</div>
  <label>Button text</label><input id="bf_button" maxlength="40" value="${esc(b.button_text||'Shop now')}">
  <label>Button URL</label><input id="bf_url" maxlength="300" value="${esc(b.button_url||'/catalog/')}">
  <div class="form-row"><div><label>Sort order</label><input id="bf_order" type="number" value="${Number(b.sort_order||0)}"></div><div><label>Status</label><select id="bf_active"><option value="true" ${b.active!==false?'selected':''}>Active</option><option value="false" ${b.active===false?'selected':''}>Hidden</option></select></div></div>
  <button class="primary" type="submit">Save banner</button> <button type="button" onclick="loadTab('content')">Cancel</button><span id="bf_msg" class="muted" style="margin-left:10px"></span>
  </form></div>`;
  const fileInput=$("#bf_file"),urlInput=$("#bf_image"),preview=$("#bf_preview");
  const showPreview=url=>{if(!url){preview.hidden=true;preview.innerHTML='';return;}preview.hidden=false;preview.innerHTML=`<img src="${esc(url)}" alt="Banner preview">`;};
  fileInput.onchange=()=>{const f=fileInput.files?.[0];if(f){if(f.size>5*1024*1024){alert('Banner image must be 5MB or smaller.');fileInput.value='';return;}showPreview(URL.createObjectURL(f));}};
  urlInput.oninput=()=>showPreview(urlInput.value.trim());
  $("#bannerForm").onsubmit=async e=>{e.preventDefault();const msg=$("#bf_msg");msg.textContent='Saving…';try{
    let imageUrl=urlInput.value.trim()||null; if(fileInput.files?.[0])imageUrl=await uploadBannerImage(fileInput.files[0]);
    const payload={title:$("#bf_title").value.trim(),subtitle:$("#bf_subtitle").value.trim()||null,image_url:imageUrl,button_text:$("#bf_button").value.trim()||null,button_url:$("#bf_url").value.trim()||'/catalog/',sort_order:Number($("#bf_order").value||0),active:$("#bf_active").value==='true'};
    if(id)await api('banners?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:payload,headers:{Prefer:'return=minimal'}});else await api('banners',{method:'POST',body:payload,headers:{Prefer:'return=minimal'}});
    alert('Banner saved successfully.');loadTab('content');
  }catch(e){msg.textContent='Save failed: '+e.message;}};
}
window.newBanner=()=>bannerForm();window.editBanner=async id=>{try{const {data}=await api('banners?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1');if(data?.[0])bannerForm(data[0]);}catch(e){alert(e.message)}};window.deleteBanner=async id=>{if(!confirm('Delete this banner?'))return;try{await api('banners?id=eq.'+encodeURIComponent(id),{method:'DELETE'});loadTab('content')}catch(e){alert(e.message)}};
restore();

async function adminSettings(){
  const [{data:profileData},{data:settingsData},{data:auditData}]=await Promise.all([
    api("profiles?select=id,email,full_name,phone,role&id=eq."+encodeURIComponent(currentSession.user_id)+"&limit=1"),
    api("site_settings?select=key,value&order=key.asc"),
    api("admin_audit_logs?select=id,action,entity_type,entity_id,note,created_at&order=created_at.desc&limit=50")
  ]);
  const p=profileData?.[0]||{};
  const map={};(settingsData||[]).forEach(x=>map[x.key]=x.value);
  const v=(k,d='')=>esc(map[k]??d);
  const audit=(auditData||[]).map(x=>`<tr><td>${esc(new Date(x.created_at).toLocaleString())}</td><td>${esc(x.action)}</td><td>${esc(x.entity_type||'')}</td><td>${esc(x.note||'')}</td></tr>`).join('');
  const expires=currentSession?.expires_at?new Date(currentSession.expires_at).toLocaleString():'—';
  $("#content").innerHTML=`
  <div class="page-head"><div><h2>Admin Settings & Security</h2><p class="muted">Manage store defaults, your admin profile and session security.</p></div></div>
  <div class="box">
    <h3>Admin Profile</h3>
    <form id="adminProfileForm">
      <div class="form-row"><div><label>Email</label><input value="${esc(p.email||currentSession.email||'')}" disabled></div><div><label>Role</label><input value="${esc(p.role||currentRole?.role||'')}" disabled></div></div>
      <div class="form-row"><div><label>Full name</label><input id="as_name" maxlength="120" value="${esc(p.full_name||'')}"></div><div><label>Phone</label><input id="as_phone" maxlength="40" value="${esc(p.phone||'')}"></div></div>
      <button class="primary">Save profile</button><span id="as_profile_msg" class="muted" style="margin-left:10px"></span>
    </form>
  </div>
  <div class="box" style="margin-top:16px">
    <h3>Store Defaults</h3>
    <form id="adminStoreForm">
      <div class="form-row"><div><label>Store name</label><input id="as_store_name" maxlength="120" value="${v('store.name','ZM Hybrid Store')}"></div><div><label>Support WhatsApp</label><input id="as_whatsapp" maxlength="40" value="${v('whatsapp_number','')}"></div></div>
      <div class="form-row"><div><label>Support email</label><input id="as_email" type="email" maxlength="160" value="${v('support.email','')}"></div><div><label>Support phone</label><input id="as_support_phone" maxlength="40" value="${v('support.phone','')}"></div></div>
      <div class="form-row"><div><label>Default currency</label><select id="as_currency"><option value="PKR" ${v('store.currency','PKR')==='PKR'?'selected':''}>PKR (Rs.)</option><option value="USD" ${v('store.currency','')==='USD'?'selected':''}>USD ($)</option></select></div><div><label>Default country</label><input id="as_country" maxlength="80" value="${v('store.country','Pakistan')}"></div></div>
      <label>Return policy summary</label><textarea id="as_return" rows="3" maxlength="1000">${v('policy.returns','Returns are accepted according to the store return policy. Contact support with your order number for assistance.')}</textarea>
      <label>Privacy policy summary</label><textarea id="as_privacy" rows="3" maxlength="1000">${v('policy.privacy','We use customer information only to process orders, provide support and improve the store experience.')}</textarea>
      <label>Terms summary</label><textarea id="as_terms" rows="3" maxlength="1000">${v('policy.terms','Orders are subject to product availability, pricing, delivery and payment verification.')}</textarea>
      <button class="primary">Save store defaults</button><span id="as_store_msg" class="muted" style="margin-left:10px"></span>
    </form>
  </div>
  <div class="box" style="margin-top:16px">
    <h3>Session Security</h3>
    <div class="form-row"><div><label>Current role</label><input value="${esc(currentRole?.role||'')}" disabled></div><div><label>Session expires</label><input value="${esc(expires)}" disabled></div></div>
    <button type="button" id="as_refresh">Refresh session</button>
    <button type="button" id="as_logout_other" class="danger">Sign out this browser</button>
    <p class="muted small">No service-role key or private API secret is stored in this browser. Keep all gateway and AI secrets in Supabase Edge Function secrets.</p>
    <span id="as_sec_msg" class="muted" style="margin-left:10px"></span>
  </div>
  <div class="box" style="margin-top:16px">
    <h3>Recent Admin Audit Log</h3>
    <div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Note</th></tr></thead><tbody>${audit||'<tr><td colspan="4" class="muted">No audit entries yet.</td></tr>'}</tbody></table></div>
  </div>`;
  $("#adminProfileForm").onsubmit=async e=>{e.preventDefault();const m=$("#as_profile_msg");m.textContent='Saving…';try{await api("profiles?id=eq."+encodeURIComponent(currentSession.user_id),{method:"PATCH",body:{full_name:$("#as_name").value.trim()||null,phone:$("#as_phone").value.trim()||null},headers:{Prefer:"return=minimal"}});await writeAudit('profile.update','profile',currentSession.user_id,'Admin profile updated');m.textContent='Profile saved.';}catch(e){m.textContent='Save failed: '+e.message;}};
  $("#adminStoreForm").onsubmit=async e=>{e.preventDefault();const m=$("#as_store_msg");m.textContent='Saving…';try{
    const items={'store.name':$("#as_store_name").value.trim(),'whatsapp_number':$("#as_whatsapp").value.trim(),'support.email':$("#as_email").value.trim(),'support.phone':$("#as_support_phone").value.trim(),'store.currency':$("#as_currency").value,'store.country':$("#as_country").value.trim(),'policy.returns':$("#as_return").value.trim(),'policy.privacy':$("#as_privacy").value.trim(),'policy.terms':$("#as_terms").value.trim()};
    for(const [key,value] of Object.entries(items)) await api("site_settings",{method:"POST",body:{key,value},headers:{Prefer:"resolution=merge-duplicates,return=minimal"}});
    await writeAudit('settings.update','site_settings',null,'Store defaults updated');m.textContent='Store defaults saved.';
  }catch(e){m.textContent='Save failed: '+e.message;}};
  $("#as_refresh").onclick=async()=>{const m=$("#as_sec_msg");m.textContent='Refreshing…';try{await refreshAdminSession();m.textContent='Session refreshed successfully.';setTimeout(()=>adminSettings(),600);}catch(e){m.textContent='Refresh failed: '+e.message;}};
  $("#as_logout_other").onclick=()=>{clearSession();location.href='/admin/'};
}
async function writeAudit(action,entity_type,entity_id,note){
  try{await api("admin_audit_logs",{method:"POST",body:{action,entity_type:entity_type||null,entity_id:entity_id||null,note:note||null},headers:{Prefer:"return=minimal"}});}catch(e){console.warn('Audit log failed',e);}
}
