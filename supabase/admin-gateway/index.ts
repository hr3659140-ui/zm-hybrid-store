import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLISHABLE_KEY="sb_publishable_pmKqaLISXQHNJD7GidkErw_etZeZ1KU";
const ADMIN_EMAIL="hr3659140@gmail.com";
const TOKEN_TTL_MS=12*60*60*1000;
const TABLES=new Set(["products","categories","brands","product_images","orders","order_items","coupons","banners","site_settings","profiles"]);
const enc=new TextEncoder(),dec=new TextDecoder();
function cors(){return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(),"Content-Type":"application/json","Cache-Control":"no-store"}});}
function b64u(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function unb64u(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function key(){return crypto.subtle.importKey("raw",enc.encode(SERVICE_ROLE_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);}
async function sign(v:string){return b64u(new Uint8Array(await crypto.subtle.sign("HMAC",await key(),enc.encode(v))));}
async function makeToken(){const p=b64u(enc.encode(JSON.stringify({sub:"admin",email:ADMIN_EMAIL,exp:Date.now()+TOKEN_TTL_MS})));return p+"."+await sign(p);}
async function verifyToken(t:string){try{const [p,s]=t.split(".");if(!p||!s)return false;const ok=await crypto.subtle.verify("HMAC",await key(),unb64u(s),enc.encode(p));if(!ok)return false;const x=JSON.parse(dec.decode(unb64u(p)));return x.sub==="admin"&&x.email===ADMIN_EMAIL&&Number(x.exp)>Date.now();}catch{return false;}}
async function db(path:string,opts:RequestInit={}){return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...opts,headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,Accept:"application/json",...(opts.headers||{})}});}
async function verifyAdminCredentials(email:string,password:string){
 const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 if(!r.ok)return {ok:false,reason:"Supabase Auth rejected the email or password."};
 const session=await r.json(); const uid=session?.user?.id; if(!uid)return {ok:false,reason:"Supabase Auth returned no user."};
 const p=await db(`profiles?id=eq.${encodeURIComponent(uid)}&select=role,email&limit=1`); if(!p.ok)return {ok:false,reason:"Could not verify admin profile."};
 const rows=await p.json(); if(!Array.isArray(rows)||rows[0]?.role!=="admin")return {ok:false,reason:"This authenticated user is not an admin."};
 return {ok:true};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors()});
 try{const body=await req.json();
  if(body.action==="login"){
   const email=String(body.email||"").trim().toLowerCase(); const password=String(body.password||"");
   if(email!==ADMIN_EMAIL)return json({error:"Use the configured admin email."},401);
   if(!password)return json({error:"Password is required."},400);
   const check=await verifyAdminCredentials(email,password); if(!check.ok)return json({error:check.reason},401);
   return json({ok:true,token:await makeToken(),email:ADMIN_EMAIL,expires_at:new Date(Date.now()+TOKEN_TTL_MS).toISOString()});
  }
  const raw=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim(); if(!(await verifyToken(raw)))return json({error:"Admin session expired. Please login again."},401);
  const path=String(body.path||"").replace(/^\/+/,""); const table=path.split("?")[0].split("/")[0]; if(!TABLES.has(table))return json({error:"Admin gateway blocked this resource."},403);
  const method=String(body.method||"GET").toUpperCase(); if(!["GET","POST","PATCH","DELETE"].includes(method))return json({error:"Method not allowed."},405);
  const headers:Record<string,string>={}; if(body.headers&&typeof body.headers==="object")for(const [k,v] of Object.entries(body.headers))if(["prefer","range","content-type","accept"].includes(k.toLowerCase()))headers[k]=String(v); if(body.body!==undefined&&body.body!==null)headers["Content-Type"]="application/json";
  const r=await db(path,{method,headers,body:body.body!==undefined&&body.body!==null?JSON.stringify(body.body):undefined}); const text=await r.text(); const hs:Record<string,string>={...cors(),"Content-Type":r.headers.get("content-type")||"application/json"}; const cr=r.headers.get("content-range");if(cr)hs["Content-Range"]=cr; return new Response(text,{status:r.status,headers:hs});
 }catch(e){return json({error:e instanceof Error?e.message:"Gateway error"},500);}
});
