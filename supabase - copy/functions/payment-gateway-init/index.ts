import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,"Content-Type":"application/json"}});
const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(supabaseUrl,serviceKey);

function envBool(name:string){return ['1','true','yes','on'].includes((Deno.env.get(name)||'').toLowerCase());}
function sha256Hex(input:string){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)).then(b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''));}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const body=await req.json();
    const orderId=String(body.order_id||'');
    const provider=String(body.provider||'').toLowerCase();
    if(!orderId || !['jazzcash','easypaisa'].includes(provider)) return json({ok:false,error:'Invalid order or payment provider.'},400);

    const {data:order,error:oerr}=await db.from('orders').select('id,order_number,total_amount,currency,payment_status').eq('id',orderId).single();
    if(oerr||!order) return json({ok:false,error:'Order not found.'},404);
    if(['paid','refunded'].includes(order.payment_status)) return json({ok:false,error:'This order is already paid or refunded.'},409);

    if(provider==='jazzcash'){
      if(!envBool('JAZZCASH_ENABLED')) return json({ok:false,error:'JazzCash gateway is not enabled yet. Add merchant secrets and enable the gateway in Supabase Edge Function Secrets.'},503);
      const merchantId=Deno.env.get('JAZZCASH_MERCHANT_ID')||'';
      const password=Deno.env.get('JAZZCASH_PASSWORD')||'';
      const integritySalt=Deno.env.get('JAZZCASH_INTEGRITY_SALT')||'';
      const endpoint=Deno.env.get('JAZZCASH_ENDPOINT')||'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';
      const returnUrl=Deno.env.get('JAZZCASH_RETURN_URL')||'';
      if(!merchantId||!password||!integritySalt||!returnUrl) return json({ok:false,error:'JazzCash configuration is incomplete.'},503);
      const now=new Date(); const stamp=(n:number)=>String(n).padStart(2,'0');
      const txnDateTime=`${now.getUTCFullYear()}${stamp(now.getUTCMonth()+1)}${stamp(now.getUTCDate())}${stamp(now.getUTCHours())}${stamp(now.getUTCMinutes())}${stamp(now.getUTCSeconds())}`;
      const expiry=new Date(now.getTime()+30*60*1000); const txnExpiryDateTime=`${expiry.getUTCFullYear()}${stamp(expiry.getUTCMonth()+1)}${stamp(expiry.getUTCDate())}${stamp(expiry.getUTCHours())}${stamp(expiry.getUTCMinutes())}${stamp(expiry.getUTCSeconds())}`;
      const txnRef=`ZM${Date.now().toString(36).toUpperCase()}`.slice(0,20);
      const amount=(Math.round(Number(order.total_amount)*100)).toString();
      const fields:any={pp_Version:'1.1',pp_TxnType:'MWALLET',pp_Language:'EN',pp_MerchantID:merchantId,pp_SubMerchantID:'',pp_Password:password,pp_TxnRefNo:txnRef,pp_Amount:amount,pp_TxnCurrency:'PKR',pp_TxnDateTime:txnDateTime,pp_TxnExpiryDateTime:txnExpiryDateTime,pp_BillReference:order.order_number,pp_Description:`ZM Hybrid Store order ${order.order_number}`,pp_ReturnURL:returnUrl};
      const sorted=Object.keys(fields).filter(k=>k!=='pp_SecureHash').sort();
      const hashString=integritySalt+'&'+sorted.map(k=>String(fields[k]??'')).join('&');
      fields.pp_SecureHash=(await sha256Hex(hashString)).toUpperCase();
      await db.from('payment_gateway_attempts').insert({order_id:order.id,provider:'jazzcash',transaction_id:txnRef,status:'initiated',amount:order.total_amount,currency:order.currency||'PKR',metadata:{endpoint,mode:Deno.env.get('JAZZCASH_MODE')||'sandbox'}});
      return json({ok:true,provider:'jazzcash',mode:Deno.env.get('JAZZCASH_MODE')||'sandbox',method:'POST',endpoint,fields});
    }

    if(!envBool('EASYPAISA_ENABLED')) return json({ok:false,error:'Easypaisa gateway is not enabled yet. Add merchant configuration and enable the gateway in Supabase Edge Function Secrets.'},503);
    const endpoint=Deno.env.get('EASYPAISA_ENDPOINT')||'';
    const merchantId=Deno.env.get('EASYPAISA_MERCHANT_ID')||'';
    const storeId=Deno.env.get('EASYPAISA_STORE_ID')||'';
    if(!endpoint||!merchantId) return json({ok:false,error:'Easypaisa configuration is incomplete. Use the exact endpoint/fields supplied in your merchant integration guide.'},503);
    const txnRef=`ZM${Date.now().toString(36).toUpperCase()}`.slice(0,20);
    await db.from('payment_gateway_attempts').insert({order_id:order.id,provider:'easypaisa',transaction_id:txnRef,status:'initiated',amount:order.total_amount,currency:order.currency||'PKR',metadata:{mode:Deno.env.get('EASYPAISA_MODE')||'sandbox',store_id:storeId}});
    return json({ok:false,provider:'easypaisa',transaction_id:txnRef,needs_provider_mapping:true,error:'Easypaisa merchant guide must be mapped to its exact hosted-payment request before enabling live checkout. No guessed API fields are used.'},501);
  }catch(e){console.error(e);return json({ok:false,error:e instanceof Error?e.message:'Gateway initialization failed.'},500)}
});
