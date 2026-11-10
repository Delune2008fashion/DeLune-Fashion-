const $=s=>document.querySelector(s), money=n=>"৳"+Number(n||0).toLocaleString("en-BD");
const status=(id,msg)=>$(id).textContent=msg;
const cfg=window.DELUNE_CONFIG||{};
const configured=DeLuneStore.configured;
let db=DeLuneStore.client, currentUser=null, categories=[];
function slugify(s){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
async function loadCategories(){
  categories=await DeLuneStore.categories();
  $("#pCategory").innerHTML=categories.map(c=>`<option value="${c.slug}">${c.parent_id?"↳ ":""}${c.name}</option>`).join("");
  const parent=$("#cParent");if(parent)parent.innerHTML=`<option value="">Top-level category</option>`+categories.filter(c=>!c.parent_id).map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  $("#adminCategories").innerHTML=categories.map(c=>`<div class="admin-item"><div><strong>${c.name}</strong><small>${c.slug}</small></div><button class="admin-button secondary" data-delete-category="${c.id||c.slug}">Delete</button></div>`).join("");
}
async function loadProducts(){
  const ps=await DeLuneStore.products({availableOnly:false});
  $("#adminProducts").innerHTML=ps.map(p=>`<div class="admin-item"><div><strong>${p.name}</strong><small>${money(p.price)} · ${p.category} · ${p.available?"Available":"Unavailable"}</small></div><div class="admin-actions"><button class="admin-button secondary" data-edit="${p.id}">Edit</button><button class="admin-button secondary" data-delete="${p.id}">Delete</button></div></div>`).join("")||"No products yet.";
}
async function refresh(){await Promise.all([loadCategories(),loadProducts()])}
function reset(){ $("#productForm").reset();$("#productId").value="";$("#productFormTitle").textContent="Add a product";$("#pAvailable").checked=true; }
async function uploadImages(files){
  const urls=[];for(const file of files){
    const path=`${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const {error}=await db.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
    if(error)throw error;const {data}=db.storage.from("product-images").getPublicUrl(path);urls.push(data.publicUrl);
  }return urls;
}
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!configured){status("#loginStatus","Supabase is not configured. Add the project URL and anon key in config.js.");return}
  const identity=$("#loginEmail").value.trim(),password=$("#loginPassword").value;
  let result;
  if(identity.includes("@")) result=await db.auth.signInWithPassword({email:identity,password});
  else {status("#loginStatus","Use the moderator email address for Supabase sign-in.");return}
  if(result.error){status("#loginStatus",result.error.message);return}
  currentUser=result.data.user;$("#loginPanel").classList.add("hidden");$("#dashboard").classList.remove("hidden");await refresh();
});
$("#logoutBtn").onclick=async()=>{await db.auth.signOut();location.reload()};
$("#productForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!db||!currentUser){status("#productStatus","Sign in first.");return}
  const id=$("#productId").value;
  try{
    let imageUrls=$("#pImageUrls").value.split("\n").map(x=>x.trim()).filter(Boolean);
    const chosen=[...$("#pPhotos").files];if(chosen.length)imageUrls=imageUrls.concat(await uploadImages(chosen));
    if(id&&!imageUrls.length){const old=await db.from("products").select("image_urls").eq("id",id).single();imageUrls=old.data?.image_urls||[]}
    if(!imageUrls.length)throw new Error("Add at least one product photo or image URL.");
    const payload={name:$("#pName").value.trim(),price:Number($("#pPrice").value),category:$("#pCategory").value,sizes:$("#pSizes").value.split(",").map(x=>x.trim()).filter(Boolean),description:$("#pDescription").value.trim(),image_urls:imageUrls,is_available:$("#pAvailable").checked,is_exclusive:$("#pExclusive").checked,updated_at:new Date().toISOString()};
    const res=id?await db.from("products").update(payload).eq("id",id):await db.from("products").insert({...payload,created_by:currentUser.id});
    if(res.error)throw res.error;status("#productStatus","Product saved.");reset();await loadProducts();
  }catch(err){status("#productStatus",err.message||"Could not save product.")}
});
$("#resetProduct").onclick=reset;
$("#adminProducts").addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");
  if(edit){const {data,error}=await db.from("products").select("*").eq("id",edit.dataset.edit).single();if(error){status("#productStatus",error.message);return}
    $("#productId").value=data.id;$("#pName").value=data.name;$("#pPrice").value=data.price;$("#pCategory").value=data.category;$("#pSizes").value=(data.sizes||[]).join(", ");$("#pDescription").value=data.description;$("#pImageUrls").value=(data.image_urls||[]).join("\n");$("#pAvailable").checked=data.is_available;$("#pExclusive").checked=data.is_exclusive;$("#productFormTitle").textContent="Edit product";window.scrollTo({top:0,behavior:"smooth"});
  }
  if(del&&confirm("Delete this product?")){const {error}=await db.from("products").delete().eq("id",del.dataset.delete);status("#productStatus",error?.message||"Product deleted.");await loadProducts()}
});
$("#categoryForm").addEventListener("submit",async e=>{
  e.preventDefault();const name=$("#cName").value.trim(),slug=$("#cSlug").value.trim()||slugify(name);
  const {error}=await db.from("categories").insert({name,slug,parent_id:$("#cParent")?.value||null,image_url:$("#cImage").value.trim(),sort_order:categories.length,is_visible:true});
  status("#categoryStatus",error?.message||"Category added.");if(!error){e.target.reset();await loadCategories()}
});
$("#adminCategories").addEventListener("click",async e=>{
  const b=e.target.closest("[data-delete-category]");if(!b||!confirm("Delete this category? Products using it should be reassigned first."))return;
  const {error}=await db.from("categories").delete().eq("id",b.dataset.deleteCategory);status("#categoryStatus",error?.message||"Category deleted.");await loadCategories();
});
$("#bannerForm").addEventListener("submit",e=>{e.preventDefault();status("#bannerStatus","Banner URL received. Connect site_settings and apply it to the homepage hero in the next implementation step.")});
if(!configured)status("#loginStatus","Demo storefront is active. Configure Supabase in config.js to enable secure moderator login and publishing.");
