
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

const json = (body:any, status=200) => new Response(JSON.stringify(body), {status, headers:cors});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  try {
    const {message, channel="storefront"} = await req.json();
    if (!message || String(message).length > 2000) return json({error:"Invalid message"},400);

    const url=Deno.env.get("SUPABASE_URL")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openai=Deno.env.get("OPENAI_API_KEY");
    if(!openai) return json({error:"AI agent is not configured. Add OPENAI_API_KEY to the Edge Function secrets."},503);

    const db=createClient(url,service);
    const [{data:products},{data:settings},{data:shipping}] = await Promise.all([
      db.from("products").select("name,slug,regular_price,sale_price,stock,sku,status,short_description,description,category:categories(name),brand:brands(name)").eq("status","active").limit(100),
      db.from("site_settings").select("key,value").in("key",["store.whatsapp","store.announcement","store.footer_description"]),
      db.from("shipping_methods").select("name,base_cost,free_shipping_threshold,active").eq("active",true).limit(20)
    ]);

    const context=JSON.stringify({products:products||[],settings:settings||[],shipping:shipping||[]});
    const system=`You are ZM Hybrid Store's customer-support AI agent. Answer in concise friendly English/Roman Urdu. Help with products, prices, stock, categories, shipping, COD, payments and general store policies. Never invent stock, price, delivery time, order status, payment confirmation, refund approval, or transaction details. Use the supplied catalog/settings context. If a customer asks about a specific order, ask for the order number and phone and tell them secure order lookup/support is required; never expose another customer's information. For payment, explain that JazzCash/Easypaisa are manual verification unless a live gateway is explicitly configured. If unsure, say so and direct the customer to WhatsApp support. Channel: ${channel}. Context: ${context}`;

    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${openai}`},
      body:JSON.stringify({model:Deno.env.get("OPENAI_MODEL")||"gpt-5-mini",input:[{role:"system",content:system},{role:"user",content:String(message)}],max_output_tokens:500})
    });
    const data=await r.json();
    if(!r.ok) return json({error:data?.error?.message||"AI provider error"},502);
    const reply=data.output_text || data.output?.flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||"").join("") || "I couldn't generate a reply.";
    return json({reply});
  } catch(e) { return json({error:e?.message||"Server error"},500); }
});
