import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,"Content-Type":"application/json"}});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams.entries()):await req.json();
  const provider=String(input.provider||input.gateway||'').toLowerCase();
  const tx=String(input.transaction_id||input.pp_TxnRefNo||input.order_number||'');
  const status=String(input.status||input.pp_ResponseCode||'').toLowerCase();
  if(!provider||!tx) return json({ok:false,error:'Missing gateway return parameters.'},400);
  const paid=provider==='jazzcash' ? ['000','00','success','successful'].includes(status) : ['paid','success','successful','000'].includes(status);
  const failed=['failed','cancelled','cancel','declined','1','2','3','4','5','6','7','8','9','10'].includes(status);
  const {data:attempt}=await db.from('payment_gateway_attempts').select('order_id,provider,transaction_id').eq('provider',provider).eq('transaction_id',tx).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!attempt) return json({ok:false,error:'Payment attempt not found.'},404);
  const finalStatus=paid?'paid':failed?'failed':'pending';
  if(finalStatus!=='pending') await db.rpc('payment_gateway_update',{p_order_id:attempt.order_id,p_provider:provider,p_status:finalStatus,p_transaction_id:tx,p_gateway_status:status,p_response_code:String(input.pp_ResponseCode||input.response_code||''),p_response_message:String(input.pp_ResponseMessage||input.response_message||''),p_metadata:input});
  await db.from('payment_gateway_attempts').update({status:finalStatus==='paid'?'paid':finalStatus==='failed'?'failed':'redirected',updated_at:new Date().toISOString(),metadata:input}).eq('provider',provider).eq('transaction_id',tx);
  const {data:order}=await db.from('orders').select('order_number').eq('id',attempt.order_id).single();
  return json({ok:true,provider,status:finalStatus,order_number:order?.order_number||null});
 }catch(e){console.error(e);return json({ok:false,error:e instanceof Error?e.message:'Payment return handling failed.'},500)}
});
