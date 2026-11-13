const $=s=>document.querySelector(s),safe=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),db=DeLuneStore.client;let user=null,allOrders=[],allAudit=[],activeFilter="all",expandedMessage="",selectedMessageType="",isLoading=false,refreshTimer=null;
const esc=safe,money=n=>"BDT "+Number(n||0).toLocaleString("en-BD");
async function api(operation,body){const {data,error}=await db.functions.invoke("delune-api",{body:{action:"merchant-action",operation,...body}});if(error)throw error;if(!data?.success)throw Error(data?.message||"Action failed");return data}
function orderMessage(o,type){const items=o.order_items||[],lines=items.map((i,n)=>{const image=i.products?.image_urls?.[0]||"";return (n+1)+". "+i.product_name+" · "+(i.size||"One size")+" · Qty "+i.quantity+" · "+money(Number(i.unit_price)*Number(i.quantity))+(image?"\nImage: "+image:"")}).join("\n");const quantity=items.reduce((n,i)=>n+Number(i.quantity||0),0),subtotal=items.reduce((n,i)=>n+Number(i.unit_price||0)*Number(i.quantity||0),0),delivery=Number(o.delivery_charge??o.payments?.[0]?.amount??0),hi="Dear "+o.customer_name+",\n\n",details="Order: "+o.order_code+"\n\nOrder items:\n"+lines+"\n\nTotal quantity: "+quantity+"\nProduct subtotal: "+money(subtotal)+"\nDelivery charge: "+money(delivery)+"\nGrand total: "+money(subtotal+delivery)+"\n\n";if(type==="shipped")return hi+details+"Your products have been dispatched through our courier service. You will receive them soon.\n\nThank you for choosing DeLune.";return type==="confirmed"?hi+details+"Your DeLune order has been confirmed. We will contact you with the next delivery updates.\n\nThank you for choosing DeLune.":hi+details+"Your DeLune order is not confirmed because the payment could not be verified. Please place a new order and submit a valid, unused transaction ID.\n\nThank you for choosing DeLune."}function whatsappUrl(phone,message){let n=String(phone||"").replace(/\D/g,"");if(n.startsWith("00"))n=n.slice(2);if(n.startsWith("0"))n="88"+n;return "https://wa.me/"+n+"?text="+encodeURIComponent(message)}
function orderGroup(o){if(o.order_status==="payment_pending")return "pending";if(o.order_status==="payment_not_confirmed")return "not_confirmed";if(o.order_status==="shipped")return "shipped";if(["processing","confirmed","delivered","completed"].includes(o.order_status))return "confirmed";return "all"}
function renderOrders(){const list=allOrders.filter(o=>!o.merchant_hidden_from_all_at&&(activeFilter!=="shipped"||!o.merchant_hidden_from_shipped_at)&&(activeFilter==="all"||orderGroup(o)===activeFilter));$("#orders").innerHTML=list.length?list.map(o=>{const items=o.order_items||[],p=(Array.isArray(o.payments)?o.payments[0]:o.payments)||{},t=(Array.isArray(o.transactions)?o.transactions[0]:o.transactions)||{},history=allAudit.filter(a=>a.entity_id===o.id),historyHtml=history.length?`<details><summary>Activity history · ${history.length}</summary>${history.map(a=>`<p class="muted">${esc(a.action.replaceAll("_"," "))} · ${new Date(a.created_at).toLocaleString()}<br>Actor: ${esc(a.actor_id||"Customer")} · Source: ${esc(a.details?.source||"System / panel")}</p>`).join("")}</details>`:"",shipped=o.order_status==="shipped",confirmed=["processing","confirmed","delivered","completed"].includes(o.order_status),notConfirmed=o.order_status==="payment_not_confirmed",canMessage=confirmed||notConfirmed||shipped,messageType=shipped?"shipped":confirmed?"confirmed":"not_confirmed",totalQty=items.reduce((n,i)=>n+Number(i.quantity||0),0),subtotal=items.reduce((n,i)=>n+Number(i.unit_price||0)*Number(i.quantity||0),0),delivery=Number(o.delivery_charge??p.amount??0),itemMarkup=items.map(i=>{const image=i.products?.image_urls?.[0]||"";const name=i.product_name||i.products?.name||"Product";return '<div class="order-item">'+(image?'<img class="order-product-image" src="'+esc(image)+'" alt="'+esc(name)+'" loading="lazy">':'<p class="muted">Product image unavailable</p>')+'<p><strong>'+esc(name)+'</strong> · '+esc(i.size||"")+' · Qty '+Number(i.quantity||0)+' · '+money(Number(i.unit_price)*Number(i.quantity))+'</p></div>'}).join("");return '<article class="order"><div class="orderhead"><strong>'+esc(o.order_code)+'</strong><span class="tag">'+esc(o.order_status.replaceAll("_"," "))+'</span></div><p class="order-date">Created: '+new Date(o.created_at).toLocaleString()+'</p>'+itemMarkup+'<p class="muted">Customer: '+esc(o.customer_name)+'<br>WhatsApp number: <strong>'+esc(o.customer_phone)+'</strong><br>Address: '+esc(o.delivery_address)+'<br>District: '+esc(o.district||"Not recorded")+'<br>Total quantity: '+totalQty+'<br>Product subtotal: '+money(subtotal)+' · Delivery charge: '+money(delivery)+'<br>Grand total: '+money(subtotal+delivery)+'<br>Payment method: '+esc(p.provider||"")+'<br>Consumer Pay on Bkash: <strong>'+esc(p.recipient_number||"Not recorded")+'</strong><br>Transaction ID: <strong>'+esc(t.transaction_id||"")+'</strong><br>Payment status: '+esc(p.status||"")+'</p>'+(o.order_status==="payment_pending"?'<div class="actions"><button type="button" class="btn" data-confirm="'+o.id+'">Confirm payment</button><button type="button" class="btn alt" data-reject="'+o.id+'">Not confirmed</button></div>':"")+(notConfirmed?'<div class="actions"><button type="button" class="btn" data-reconfirm="'+o.id+'">Confirm</button></div>':"")+(confirmed?'<div class="actions"><button type="button" class="btn" data-shipped="'+o.id+'">Mark as Shipped</button></div>':"")+(canMessage?'<div class="actions"><button type="button" class="btn alt" data-message="'+o.id+'" data-type="'+messageType+'">'+(shipped?"Shipment Confirmation":"Message")+"</button></div>":"")+'<div class="actions history-actions"><button type="button" class="btn alt" data-delete-history="'+o.id+'" style="color:#ffb4b4;border-color:#b65b70">🗑 Remove from this history</button></div>'+historyHtml+'</article>'}).join(""):"No orders in this category."}async function loadBkashNumbers(){const {data,error}=await db.functions.invoke("delune-api",{body:{action:"merchant-action",operation:"list-bkash-numbers"}});if(error)throw error;if(!data?.success)throw Error(data?.message||"Could not load bKash numbers");const nums=data.numbers||[];$("#bkashNumberList").innerHTML=nums.length?nums.map(n=>'<div class="orderhead" style="padding:8px 0"><strong>'+esc(n)+'</strong><button class="btn alt" type="button" data-remove-bkash="'+esc(n)+'">Remove</button></div>').join(""):'<p class="muted">No active bKash numbers.</p>'}
async function load(){if(isLoading||!user)return;isLoading=true;$("#orders").textContent="Loading orders…";try{let ordersQuery=db.from("orders").select("*,order_items(*,products(name,image_urls)),payments(*),transactions(*)").is("merchant_hidden_from_all_at",null);if(activeFilter==="shipped")ordersQuery=ordersQuery.is("merchant_hidden_from_shipped_at",null);const {data:orders,error}=await ordersQuery.order("created_at",{ascending:false});if(error)throw error;allOrders=orders||[];const ids=allOrders.map(o=>o.id);if(ids.length){const [{data:logs,error:le},{data:paymentRows,error:pe}]=await Promise.all([db.from("audit_logs").select("entity_id,action,actor_id,created_at,details").in("entity_id",ids).order("created_at",{ascending:true}),db.from("payments").select("order_id,provider,recipient_number,status,amount").in("order_id",ids)]);allAudit=le?[]:(logs||[]);if(pe)throw pe;const paymentMap=new Map((paymentRows||[]).map(x=>[x.order_id,x]));allOrders=allOrders.map(o=>({...o,payments:paymentMap.get(o.id)||o.payments||null}));}else allAudit=[];renderOrders();$("#dashStatus").textContent="Orders refreshed.";}catch(err){$("#orders").textContent="Could not load orders: "+(err?.message||"Unknown error");$("#dashStatus").textContent="Merchant dashboard data error. Check access and refresh.";throw err;}finally{isLoading=false}}
function startSharedHistoryRefresh(){if(refreshTimer)clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(user&&document.visibilityState==="visible")load().catch(e=>$("#dashStatus").textContent=e.message)},15000)}
document.addEventListener("visibilitychange",()=>{if(user&&document.visibilityState==="visible")load().catch(e=>$("#dashStatus").textContent=e.message)});
window.addEventListener("focus",()=>{if(user)load().catch(e=>$("#dashStatus").textContent=e.message)});
$("#loginForm").onsubmit=async e=>{e.preventDefault();const msg=$("#loginStatus");msg.textContent="Signing in…";if(!db){msg.textContent="Supabase is not configured.";return}try{const email=$("#email").value.trim();if(!email.includes("@"))throw Error("Enter the Merchant account email address, not the display name or user ID.");const {data,error}=await db.auth.signInWithPassword({email,password:$("#password").value});if(error)throw error;user=data.user;const [{data:r,error:re},{data:m,error:me}]=await Promise.all([db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle(),db.from("merchants").select("display_name,is_active").eq("user_id",user.id).maybeSingle()]);if(re)throw Error("Could not verify Merchant role: "+re.message);if(me)throw Error("Could not load Merchant profile: "+me.message);if(r?.role!=="merchant"||!m?.is_active){await db.auth.signOut();throw Error("Login succeeded, but this account has no active Merchant permission. Check user_roles and merchants for this account UUID.");}$("#merchantName").textContent=m.display_name;$("#login").classList.add("hidden");$("#dashboard").classList.remove("hidden");msg.textContent="";await Promise.all([load(),loadBkashNumbers()]);startSharedHistoryRefresh()}catch(err){msg.textContent=err.message||"Merchant sign-in failed.";}};
$("#logout").onclick=async()=>{await db.auth.signOut();location.reload()};$("#refresh").onclick=()=>load().catch(e=>$("#dashStatus").textContent=e.message);
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{activeFilter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));renderOrders()}));


document.getElementById("orders")?.addEventListener("click",async e=>{
 const target=e.target instanceof Element?e.target:e.target?.parentElement;
 const b=target?.closest("button[data-confirm],button[data-reject],button[data-reconfirm],button[data-shipped],button[data-message],button[data-delete-history]");
 if(!b||b.disabled)return;
 const id=b.dataset.confirm||b.dataset.reject||b.dataset.reconfirm||b.dataset.shipped||b.dataset.message||b.dataset.deleteHistory;
 if(!id)return;
 const o=allOrders.find(x=>x.id===id);
 if(!o){$("#dashStatus").textContent="Order is no longer in the current list. Refresh and try again.";return;}
 b.disabled=true;
 const oldLabel=b.textContent;
 b.textContent="Please wait…";
 let popup=null;
 try{
  if(b.dataset.deleteHistory){
   const scope=activeFilter==="shipped"?"shipped":"all";
   const question=scope==="shipped"?"Remove this order from every Merchant's Shipped history? It will remain in All history.":"Remove this order from every Merchant's All history? The order and payment records will be retained.";
   if(!confirm(question))return;
   await api("hide-order",{order_id:id,history_filter:scope});
   await load();
   $("#dashStatus").textContent=scope==="shipped"?"Removed from Shipped history for every Merchant.":"Removed from All Merchant histories. Order and payment records retained.";
   return;
  }
  if(b.dataset.message){
   const type=b.dataset.type;
   const allowed=type==="confirmed"?["processing","confirmed","delivered","completed"]:type==="not_confirmed"?["payment_not_confirmed"]:["shipped"];
   if(!allowed.includes(o.order_status))throw Error("The order status changed. Refresh the list and try again.");
   const msg=orderMessage(o,type);
   popup=window.open("about:blank","_blank");
   await api("notify-now",{order_id:id,message:msg,message_type:type});
   if(popup)popup.location.href=whatsappUrl(o.customer_phone,msg);
   $("#dashStatus").textContent=popup?"WhatsApp message prepared for "+o.customer_phone:"Message saved. Allow pop-ups to open WhatsApp.";
   return;
  }
  if(b.dataset.confirm||b.dataset.reconfirm){
   if(b.dataset.confirm&&!confirm("Confirm only after matching the received payment in your actual bKash/Nagad account history."))return;
   const msg=orderMessage(o,"confirmed");
   const sendNow=confirm("Open WhatsApp and prepare the confirmation message after updating the order?");
   if(sendNow)popup=window.open("about:blank","_blank");
   await api("confirm",{order_id:id});
   if(sendNow){
    await api("notify-now",{order_id:id,message:msg,message_type:"confirmed"});
    if(popup)popup.location.href=whatsappUrl(o.customer_phone,msg);
   }
  }else if(b.dataset.reject){
   if(!confirm("Mark this payment as Not Confirmed?"))return;
   const msg=orderMessage(o,"not_confirmed");
   const sendNow=confirm("Open WhatsApp and prepare the Not Confirmed message after updating the order?");
   if(sendNow)popup=window.open("about:blank","_blank");
   await api("reject",{order_id:id});
   if(sendNow){
    await api("notify-now",{order_id:id,message:msg,message_type:"not_confirmed"});
    if(popup)popup.location.href=whatsappUrl(o.customer_phone,msg);
   }
  }else if(b.dataset.shipped){
   if(!confirm("Mark this confirmed order as Shipped?"))return;
   const msg=orderMessage(o,"shipped");
   const sendNow=confirm("Open WhatsApp and prepare the shipment message after updating the order?");
   if(sendNow)popup=window.open("about:blank","_blank");
   await api("mark-shipped",{order_id:id});
   if(sendNow){
    await api("notify-now",{order_id:id,message:msg,message_type:"shipped"});
    if(popup)popup.location.href=whatsappUrl(o.customer_phone,msg);
   }
  }
  await load();
  $("#dashStatus").textContent="Order updated successfully.";
 }catch(err){
  if(popup&&!popup.closed)popup.close();
  $("#dashStatus").textContent=err?.message||"Order action failed. Please refresh and try again.";
 }finally{
  if(b.isConnected){b.disabled=false;b.textContent=oldLabel;}
 }
});

$("#bkashAddForm").addEventListener("submit",async e=>{e.preventDefault();const number=$("#newBkashNumber").value.trim();try{const {data,error}=await db.functions.invoke("delune-api",{body:{action:"merchant-action",operation:"add-bkash-number",number}});if(error)throw error;if(!data?.success)throw Error(data?.message||"Could not add number");$("#newBkashNumber").value="";await loadBkashNumbers();$("#dashStatus").textContent="bKash number added."}catch(err){$("#dashStatus").textContent=err.message}});
$("#bkashNumberList").addEventListener("click",async e=>{const b=e.target.closest("[data-remove-bkash]");if(!b)return;if(!confirm("Remove this number from future checkout options? Existing orders will keep their saved number."))return;try{const {data,error}=await db.functions.invoke("delune-api",{body:{action:"merchant-action",operation:"remove-bkash-number",number:b.dataset.removeBkash}});if(error)throw error;if(!data?.success)throw Error(data?.message||"Could not remove number");await loadBkashNumbers();$("#dashStatus").textContent="Number removed from new checkouts."}catch(err){$("#dashStatus").textContent=err.message}});
$("#bkashRefresh").addEventListener("click",()=>loadBkashNumbers().catch(e=>$("#dashStatus").textContent=e.message));
