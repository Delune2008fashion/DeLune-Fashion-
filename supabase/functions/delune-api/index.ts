import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{...cors,"Content-Type":"application/json"}});
const hash=async(s:string)=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return out({success:false,message:"POST required"});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const body=await req.json().catch(()=>({})),action=String(body.action||"");
 const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 const getActor=async()=>{const {data:{user}}=await db.auth.getUser(bearer);if(!user)throw new Error("Authentication required");const {data:r}=await db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();return {user,role:r?.role||""}};
 const requireCreator=async()=>{const a=await getActor();if(a.role!=="site_creator")throw new Error("Site Creator permission required");return a};
 try{
  if(action==="create-order"){
   const name=String(body.customer_name||"").trim(),phone=String(body.customer_phone||"").trim(),address=String(body.delivery_address||"").trim(),txn=String(body.transaction_id||"").trim(),provider=String(body.provider||"");
   if(!name||!phone||!address||!body.product_id||!txn)throw new Error("Complete all required fields.");
   if(name.length>100||phone.length>25||address.length>500||txn.length>100)throw new Error("One or more fields are too long.");
   if(!["bkash","nagad"].includes(provider))throw new Error("Select a valid payment method.");
   const {data:product,error:pe}=await db.from("products").select("id,delivery_charge,is_published,is_available").eq("id",String(body.product_id)).maybeSingle();if(pe)throw pe;if(!product||!product.is_published||!product.is_available)throw new Error("Product is unavailable.");
   const charge=Number(product.delivery_charge);if(!Number.isFinite(charge)||charge<=0)throw new Error("This product does not have a delivery charge yet. Please contact DeLune.");
   const {data:settings,error:se}=await db.from("site_settings").select("key,value").in("key",["bkash_number","nagad_number"]);if(se)throw se;
   const vals=Object.fromEntries((settings||[]).map(x=>[x.key,x.value]));
   if(!String(vals[provider+"_number"]||"").trim())throw new Error("This payment method is not configured yet.");
   const {data,error}=await db.rpc("create_delune_order",{p_customer_name:name,p_customer_phone:phone,p_delivery_address:address,p_product_id:body.product_id,p_quantity:Number(body.quantity),p_size:String(body.size||"One size"),p_provider:provider,p_transaction_id:txn,p_delivery_charge:charge});
   if(error){if((error.message||"").includes("DUPLICATE_TRANSACTION_ID")||(error.message||"").toLowerCase().includes("unique"))throw new Error("DUPLICATE_TRANSACTION_ID");throw error}
   const row=Array.isArray(data)?data[0]:data;return out({success:true,order_id:row.order_id,order_code:row.order_code});
  }
  if(action==="create-merchant"){
   const {user}=await requireCreator();const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),name=String(body.display_name||"").trim();
   if(!email||password.length<8||!name)throw new Error("Provide a name, email and password of at least 8 characters.");
   const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});if(error)throw error;
   const uid=data.user.id;const r=await db.from("user_roles").insert({user_id:uid,role:"merchant"});if(r.error){await db.auth.admin.deleteUser(uid);throw r.error}
   const m=await db.from("merchants").insert({user_id:uid,display_name:name,created_by:user.id});if(m.error){await db.from("user_roles").delete().eq("user_id",uid);await db.auth.admin.deleteUser(uid);throw m.error}
   await db.from("audit_logs").insert({actor_id:user.id,action:"merchant_created",entity_type:"merchant",entity_id:uid,details:{email}});
   return out({success:true,merchant:{id:uid,email,display_name:name}});
  }
  if(action==="create-invitation"){
   const {user}=await requireCreator();const email=String(body.email||"").trim().toLowerCase(),base=String(body.site_url||"").replace(/\/$/,"");
   if(!email||!/^https:\/\//i.test(base))throw new Error("Enter a valid email and HTTPS website URL.");
   const raw=crypto.randomUUID()+"-"+crypto.randomUUID(),expires=new Date(Date.now()+72*3600000).toISOString();
   const {error}=await db.from("merchant_invitations").insert({email,token_hash:await hash(raw),expires_at:expires,created_by:user.id});if(error)throw error;
   return out({success:true,invite_url:base+"/accept-invitation.html?token="+encodeURIComponent(raw),expires_at:expires});
  }
  if(action==="accept-invitation"){
   const raw=String(body.token||""),email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),name=String(body.display_name||"").trim();
   if(!raw||!email||password.length<8||!name)throw new Error("Complete all fields. Password must be at least 8 characters.");
   const {data:invite}=await db.from("merchant_invitations").select("*").eq("token_hash",await hash(raw)).eq("email",email).is("used_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
   if(!invite)throw new Error("Invitation is invalid, expired, already used, or does not match this email.");
   const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});if(error)throw error;
   const uid=data.user.id;const r=await db.from("user_roles").insert({user_id:uid,role:"merchant"});if(r.error){await db.auth.admin.deleteUser(uid);throw r.error}
   const m=await db.from("merchants").insert({user_id:uid,display_name:name,created_by:invite.created_by});if(m.error){await db.from("user_roles").delete().eq("user_id",uid);await db.auth.admin.deleteUser(uid);throw m.error}
   await db.from("merchant_invitations").update({used_at:new Date().toISOString()}).eq("id",invite.id);
   return out({success:true,message:"Merchant account created. Sign in at merchant.html."});
  }
  if(action==="assign-order"){
   const {user}=await requireCreator();const orderId=String(body.order_id||""),merchantId=String(body.merchant_id||"");
   const {data:m,error:me}=await db.from("merchants").select("user_id").eq("user_id",merchantId).eq("is_active",true).single();if(me||!m)throw new Error("Active merchant not found.");
   const {error}=await db.from("orders").update({merchant_id:merchantId,updated_at:new Date().toISOString()}).eq("id",orderId);if(error)throw error;
   await db.from("audit_logs").insert({actor_id:user.id,action:"order_assigned",entity_type:"order",entity_id:orderId,details:{merchant_id:merchantId}});
   return out({success:true});
  }
  if(action==="merchant-action"){
   const {user,role}=await getActor();if(!["merchant","site_creator"].includes(role))throw new Error("Merchant permission required.");
   const orderId=String(body.order_id||"");const {data:o,error:oe}=await db.from("orders").select("*").eq("id",orderId).single();if(oe||!o)throw new Error("Order not found.");
   if(role==="merchant"&&o.merchant_id!==user.id)throw new Error("This order is not assigned to your account.");
   const a=String(body.operation||"");
   if(a==="hide-order"){if(!o.merchant_id)throw new Error("Order is not assigned to a merchant.");const {error}=await db.from("orders").update({merchant_hidden_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",orderId).eq("merchant_id",user.id);if(error)throw error;await db.from("audit_logs").insert({actor_id:user.id,action:"merchant_order_history_hidden",entity_type:"order",entity_id:orderId,details:{order_code:o.order_code}});return out({success:true,message:"Order hidden from this merchant history. Payment and transaction records retained."});}
   if(a==="mark-shipped"){if(!["confirmed","processing"].includes(o.order_status))throw new Error("Only confirmed orders can be marked as shipped.");const u=await db.from("orders").update({order_status:"shipped",updated_at:new Date().toISOString()}).eq("id",orderId);if(u.error)throw u.error;await db.from("audit_logs").insert({actor_id:user.id,action:"order_marked_shipped",entity_type:"order",entity_id:orderId,details:{order_code:o.order_code}});return out({success:true});}
   if(a==="confirm"||a==="reject"){
    if(a==="confirm"&&o.order_status!=="payment_pending"&&o.order_status!=="payment_not_confirmed")throw new Error("This order cannot be confirmed from its current status.");if(a==="reject"&&o.order_status!=="payment_pending")throw new Error("This order is no longer awaiting payment verification.");
    const status=a==="confirm"?"confirmed":"not_confirmed",orderStatus=a==="confirm"?"confirmed":"payment_not_confirmed";
    const p=await db.from("payments").update({status,verified_by:user.id,verified_at:new Date().toISOString()}).eq("order_id",orderId);if(p.error)throw p.error;
    const t=await db.from("transactions").update({status}).eq("order_id",orderId);if(t.error)throw t.error;
    const u=await db.from("orders").update({order_status:orderStatus,updated_at:new Date().toISOString()}).eq("id",orderId);if(u.error)throw u.error;
    await db.from("audit_logs").insert({actor_id:user.id,action:"payment_"+a,entity_type:"order",entity_id:orderId,details:{order_code:o.order_code}});
    return out({success:true,phone:o.customer_phone,customer_name:o.customer_name,order_code:o.order_code});
   }
   if(a==="notify-now"||a==="queue"){
    const type=String(body.message_type||"not_confirmed");
    const confirmed=["processing","confirmed","shipped","delivered","completed"].includes(o.order_status);
    if(type==="confirmed"&&!confirmed)throw new Error("This order is not confirmed.");if(type==="shipped"&&o.order_status!=="shipped")throw new Error("This order is not marked as shipped.");
    if(type==="not_confirmed"&&o.order_status!=="payment_not_confirmed")throw new Error("This order is not marked as not confirmed.");
    const message=String(body.message||"").trim();if(!message)throw new Error("Message is empty.");
    const {data:n,error}=await db.from("notifications").insert({order_id:orderId,recipient_phone:o.customer_phone,message,created_by:user.id,status:a==="queue"?"queued":"opened"}).select("id").single();if(error)throw error;
    return out({success:true,notification_id:n.id,phone:o.customer_phone,message});
   }
   throw new Error("Unsupported merchant action.");
  }
  throw new Error("Unknown action.");
 }catch(e){return out({success:false,message:e.message||"Request failed."})}
});