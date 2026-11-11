
function openSubpanel(key){const pane=document.querySelector('[data-admin-pane="'+key.split("-")[0]+'"]');if(!pane)return;pane.querySelectorAll("[data-subpanel]").forEach(el=>el.classList.toggle("admin-subpanel-hidden",el.dataset.subpanel!==key));pane.querySelectorAll("[data-subaction]").forEach(btn=>{const active=btn.dataset.subaction===key;btn.classList.toggle("secondary",!active);});}
document.querySelectorAll("[data-admin-subnav] button").forEach(btn=>btn.addEventListener("click",()=>openSubpanel(btn.dataset.subaction)));
document.querySelectorAll("[data-subaction]").forEach(btn=>btn.addEventListener("click",()=>openSubpanel(btn.dataset.subaction)));
for(const key of ["products-add","categories-add","texts-manage","banner-manage"])openSubpanel(key);

function activateAdminTab(name){document.querySelectorAll("[data-admin-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.adminTab===name)));document.querySelectorAll("[data-admin-pane]").forEach(p=>p.classList.toggle("active",p.dataset.adminPane===name));}
document.querySelectorAll("[data-admin-tab]").forEach(b=>b.addEventListener("click",()=>activateAdminTab(b.dataset.adminTab)));
const $=s=>document.querySelector(s), money=n=>"৳"+Number(n||0).toLocaleString("en-BD");
const status=(id,msg)=>$(id).textContent=msg;
const cfg=window.DELUNE_CONFIG||{};
const configured=DeLuneStore.configured;
let db=DeLuneStore.client, currentUser=null, categories=[];
function slugify(s){return s.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100)}
const SEO_KEYWORD_STARTER=[
["Brand identity","Delune official"],["Brand identity","Delune fashion"],["Brand identity","Delune exclusive"],["Brand identity","Delune luxury"],["Brand identity","Delune fashion brand"],["Brand identity","Delune brand"],["Brand identity","The DeLune official"],
["General fashion","Delune apparel"],["General fashion","Delune lifestyle"],["General fashion","Delune clothing"],["General fashion","Delune look"],["General fashion","Delune merchandise"],["General fashion","Delune fashion items"],["General fashion","Delune shopping"],["General fashion","Delune products"],["General fashion","Delune outfit"],["General fashion","Delune departments"],
["Men's fashion","Delune men's clothing"],["Men's fashion","Delune pants"],["Men's fashion","Delune denim pants"],["Men's fashion","Delune hoodies"],["Men's fashion","Delune drop-shoulder tops"],["Men's fashion","Delune winter hoodies"],["Men's fashion","Delune F1 jackets"],["Men's fashion","Delune LV jackets"],["Men's fashion","Delune formal outfits"],
["Women's fashion","Delune women's clothing"],["Women's fashion","Delune women's fashion"],["Women's fashion","Delune women's hoodies"],["Women's fashion","Delune women's sneakers"],["Women's fashion","Delune women's footwear"],
["Sneakers & footwear","Delune sneakers"],["Sneakers & footwear","Delune Air Force 1"],["Sneakers & footwear","Delune Air Max"],["Sneakers & footwear","Delune Jordan 1"],["Sneakers & footwear","Delune Jordan 4"],["Sneakers & footwear","Delune Jordan low"],["Sneakers & footwear","Delune Jordan high"],["Sneakers & footwear","Delune luxury sneakers"],["Sneakers & footwear","Delune Adidas"],["Sneakers & footwear","Delune Adidas Campus"],["Sneakers & footwear","Delune Samba"],["Sneakers & footwear","Delune classic sneakers"],["Sneakers & footwear","Delune athletic sneakers"],["Sneakers & footwear","Delune kicks"],["Sneakers & footwear","Delune LV sneakers"],
["Accessories","Delune bags"],["Accessories","Delune watches"],["Accessories","Delune glasses"],["Accessories","Delune moneybag"],["Accessories","Delune hats"],["Accessories","Delune caps"],["Accessories","Delune fashion accessories"],
["Collections & promotions","Delune new drop"],["Collections & promotions","Delune clearance"],["Collections & promotions","Delune collaboration"],["Collections & promotions","Delune collaboration drop"],["Collections & promotions","Delune fragments"],["Collections & promotions","Delune events"],
["Lifestyle & other","Delune perfumes"],["Lifestyle & other","Delune luxury toys"],["Lifestyle & other","Delune demandings"],["Lifestyle & other","Delune hype of the day"],["Lifestyle & other","Delune fans"],["Lifestyle & other","Delune followers"]
];
function seoKeywordLines(items=SEO_KEYWORD_STARTER){return items.map(([group,phrase])=>group+" | "+phrase).join("\n")}
function parseSeoKeywordLines(raw){return raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const i=line.indexOf("|");return i<0?["General fashion",line.trim()]:[line.slice(0,i).trim()||"General fashion",line.slice(i+1).trim()]}).filter(x=>x[1]).map(([group,phrase])=>[group,phrase]).filter((x,i,a)=>a.findIndex(y=>y[1].toLowerCase()===x[1].toLowerCase())===i)}
let seoKeywordLibrary=SEO_KEYWORD_STARTER.map(x=>[...x]);
async function loadSeoKeywordLibrary(){const {data,error}=await db.from("site_settings").select("value").eq("key","seo_keyword_library").maybeSingle();if(error)throw error;if(data?.value){try{const parsed=JSON.parse(data.value);if(Array.isArray(parsed))seoKeywordLibrary=parsed.filter(x=>Array.isArray(x)&&x.length>=2&&x[1]).map(x=>[String(x[0]),String(x[1])])}catch{}}$("#seoKeywordLines").value=seoKeywordLines(seoKeywordLibrary)}
async function saveSeoKeywordLibrary(){const parsed=parseSeoKeywordLines($("#seoKeywordLines").value);if(!parsed.length)throw new Error("Add at least one keyword phrase.");const {error}=await db.from("site_settings").upsert({key:"seo_keyword_library",value:JSON.stringify(parsed),updated_at:new Date().toISOString(),updated_by:currentUser.id},{onConflict:"key"});if(error)throw error;seoKeywordLibrary=parsed;status("#seoKeywordStatus",parsed.length+" keyword phrases saved.");}
function suggestProductKeywords(){const category=$("#pCategory").value.toLowerCase(),text=($("#pName").value+" "+$("#pDescription").value+" "+category).toLowerCase();const words=new Set(text.split(/[^a-z0-9]+/).filter(x=>x.length>2));const scored=seoKeywordLibrary.map(([group,phrase])=>{const p=phrase.toLowerCase(),tokens=p.split(/[^a-z0-9]+/).filter(x=>x.length>2);let score=tokens.reduce((n,t)=>n+(words.has(t)?1:0),0);if(p.includes(category)||category.includes(p.replace(/^delune\s+/,"")))score+=3;if(group.toLowerCase().includes(category))score+=2;return {phrase,score,group}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);const chosen=scored.slice(0,6).map(x=>x.phrase);$("#pSeoKeywords").value=chosen.join(", ");if(!chosen.length)status("#productStatus","No matching phrases found. Add accurate keywords manually.");}
$("#saveSeoKeywordLibrary").addEventListener("click",async()=>{try{await saveSeoKeywordLibrary()}catch(e){status("#seoKeywordStatus",e.message||"Could not save keyword library.")}});
$("#resetSeoKeywordLibrary").addEventListener("click",()=>{$("#seoKeywordLines").value=seoKeywordLines();status("#seoKeywordStatus","Starter list loaded. Save to replace the current library.")});
$("#suggestSeoKeywords").addEventListener("click",suggestProductKeywords);

function seoDefaults(){const name=$("#pName").value.trim()||"Product";const desc=$("#pDescription").value.trim();const price=$("#pPrice").value? " Price: ৳"+Number($("#pPrice").value).toLocaleString("en-BD")+".":"";return {slug:slugify(name)||"product",title:name+" — DeLune",description:(desc||"Discover "+name+" at DeLune.")+price}}
function updateSEOPreview(){const d=seoDefaults(),id=$("#productId").value.trim(),slug=d.slug+(id?"-"+id.slice(0,8):"-auto"),title=$("#pSeoTitle").value.trim()||d.title,description=$("#pSeoDescription").value.trim()||d.description;$("#seoPreviewTitle").textContent=title;$("#seoPreviewUrl").textContent="https://delune.qd.je/products/"+slug+"/";$("#seoPreviewDescription").textContent=description;}
["#pName","#pDescription","#pPrice","#pSeoTitle","#pSeoDescription"].forEach(sel=>$(sel)?.addEventListener("input",updateSEOPreview));
async function loadCategories(){
  categories=await DeLuneStore.categories();
  $("#pCategory").innerHTML=`<option value="uncategorized">Uncategorized (moderator only)</option>`+categories.map(c=>`<option value="${c.slug}">${c.parent_id?"↳ ":""}${c.name}</option>`).join("");
  const parent=$("#cParent");if(parent)parent.innerHTML=`<option value="">Top-level category</option>`+categories.filter(c=>!c.parent_id).map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  $("#adminCategories").innerHTML=categories.map(c=>`<div class="admin-item"><div class="admin-item-main">${c.image_url?`<img class="admin-thumb" src="${c.image_url}" alt="${c.name.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">`:`<div class="admin-thumb" aria-label="No category photo"></div>`}<div class="admin-item-copy"><strong>${c.name}</strong><small>${c.parent_id?"Subcategory · ":"Category · "}${c.slug}</small></div></div><div class="admin-actions"><button class="admin-button secondary" data-edit-category="${c.id}">Edit</button><button class="admin-button secondary" data-delete-category="${c.id||c.slug}">Delete</button></div></div>`).join("");
}
async function loadProducts(){
  const ps=await DeLuneStore.products({availableOnly:false});
  $("#adminProducts").innerHTML=ps.map(p=>{const img=(p.image_urls||[])[0]||"";return `<div class="admin-item"><div class="admin-item-main">${img?`<img class="admin-thumb" src="${img}" alt="${p.name.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">`:`<div class="admin-thumb" aria-label="No product photo"></div>`}<div class="admin-item-copy"><strong>${p.name}</strong><small>${money(p.price)} · ${p.category==="uncategorized"?"Uncategorized (moderator only)":p.category} · ${p.available?"In stock":"Out of stock"} · ${p.is_published?"Published":"Draft"}</small></div></div><div class="admin-actions"><button class="admin-button secondary" data-edit="${p.id}">Edit</button><button class="admin-button secondary" data-delete="${p.id}">Delete</button></div></div>`}).join("")||"No products yet.";
}
async function refresh(){await Promise.all([loadCategories(),loadProducts(),loadSeoKeywordLibrary()]);await fetchPageTexts();await renderTextFields()}
const PAGE_TEXT_FIELDS={"index":[[".announcement","Announcement bar"],[".hero-copy .eyebrow","Hero eyebrow"],[".hero-copy h1","Hero heading"],[".hero-description","Hero description"],[".hero-copy .button-dark","Hero button"],[".intro-strip span:nth-child(1)","Intro line 1"],[".intro-strip span:nth-child(2)","Intro line 2"],[".intro-strip span:nth-child(3)","Intro line 3"],[".exclusive-section .section-heading .eyebrow","Exclusive eyebrow"],[".exclusive-section .section-heading h2","Exclusive heading"],[".exclusive-section .section-heading .underlined-link","View products label"],[".category-section .section-heading .eyebrow","Category eyebrow"],[".category-section .section-heading h2","Category heading"],[".category-section .section-note","Category description"],[".brand-note .eyebrow","Brand note eyebrow"],[".brand-note h2","Brand note heading"],[".brand-note .underlined-link","Brand note link"]],"categories":[[".announcement","Announcement bar"],[".page-heading .eyebrow","Page eyebrow"],[".page-heading h1","Page heading"],[".page-heading p","Page description"]],"about":[[".announcement","Announcement bar"],[".page-heading .eyebrow","Page eyebrow"],[".page-heading h1","Page heading"],[".about-content","About description"]],"contact":[[".announcement","Announcement bar"],[".page-heading .eyebrow","Page eyebrow"],[".page-heading h1","Page heading"],[".page-heading p","Page description"],[".contact-card h2","Contact heading"],[".contact-card p:nth-of-type(1)","Contact description"],[".contact-card a[href^='https://m.me']","Messenger button label"]]};
let savedPageTexts={};
async function fetchPageTexts(){const {data,error}=await db.from("site_settings").select("value").eq("key","content_texts").maybeSingle();if(error)throw error;try{savedPageTexts=data?.value?JSON.parse(data.value):{}}catch{savedPageTexts={}}}
async function renderTextFields(){const page=$("#textPage").value,host=$("#textFields");host.innerHTML='<p class="status">Loading page text…</p>';try{const response=await fetch(page+".html",{cache:"no-store"});if(!response.ok)throw new Error("Could not load page defaults.");const doc=new DOMParser().parseFromString(await response.text(),"text/html");host.innerHTML=PAGE_TEXT_FIELDS[page].map(([selector,label])=>{const el=doc.querySelector(selector);if(!el)return "";const key=page+"|"+selector;const value=Object.prototype.hasOwnProperty.call(savedPageTexts,key)?savedPageTexts[key]:el.textContent.trim();return '<div class="field"><label>'+label+'</label><textarea data-page-text-key="'+key.replace(/"/g,"&quot;")+'" rows="2">'+String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")+'</textarea></div>'}).join("")||'<p class="status">No editable text fields found.</p>'}catch(e){host.innerHTML='<p class="status">'+e.message+'</p>'}}
$("#textPage").addEventListener("change",renderTextFields);
$("#savePageTexts").addEventListener("click",async()=>{try{const next={...savedPageTexts};$("#textFields").querySelectorAll("[data-page-text-key]").forEach(el=>next[el.dataset.pageTextKey]=el.value);const {error}=await db.from("site_settings").upsert({key:"content_texts",value:JSON.stringify(next),updated_at:new Date().toISOString(),updated_by:currentUser.id},{onConflict:"key"});if(error)throw error;savedPageTexts=next;status("#pageTextStatus","Visible page texts saved successfully.");}catch(e){status("#pageTextStatus",e.message||"Could not save page texts.")}});
$("#resetPageTexts").addEventListener("click",async()=>{try{await fetchPageTexts();await renderTextFields();status("#pageTextStatus","Saved text values reloaded.")}catch(e){status("#pageTextStatus",e.message)}});

function reset(){ $("#productForm").reset();$("#productId").value="";$("#productFormTitle").textContent="Add a product";$("#pAvailable").checked=true;$("#pPublished").checked=true;$("#pSeoTitle").value="";$("#pSeoDescription").value="";$("#pSeoKeywords").value="";updateSEOPreview(); }
async function uploadImages(files){
  if(files.length>8)throw new Error("Choose no more than 8 images at once.");
  const urls=[];for(const file of files){
    if(!file.type.startsWith("image/"))throw new Error("Only image files can be uploaded.");
    if(file.size>5*1024*1024)throw new Error("Each image must be 5 MB or smaller.");
    const path=`${currentUser.id}/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const {error}=await db.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
    if(error)throw error;const {data}=db.storage.from("product-images").getPublicUrl(path);urls.push(data.publicUrl);
  }return urls;
}
async function uploadSingleImage(inputSelector){
 const file=$(inputSelector)?.files?.[0];if(!file)return "";
 const [url]=await uploadImages([file]);return url;
}
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!configured){status("#loginStatus","Supabase is not configured. Add the project URL and anon key in config.js.");return}
  const identity=$("#loginEmail").value.trim(),password=$("#loginPassword").value;
  let result;
  if(identity.includes("@")) result=await db.auth.signInWithPassword({email:identity,password});
  else {status("#loginStatus","Use the moderator email address for Supabase sign-in.");return}
  if(result.error){status("#loginStatus",result.error.message);return}
  currentUser=result.data.user;
  const {data:allowed,error:allowError}=await db.from("moderators").select("user_id").eq("user_id",currentUser.id).maybeSingle();
  if(allowError||!allowed){await db.auth.signOut();currentUser=null;status("#loginStatus","This account is not authorized for DeLune Moderator Studio.");return}
  $("#loginPanel").classList.add("hidden");$("#dashboard").classList.remove("hidden");try{await refresh()}catch(err){status("#productStatus","Dashboard data could not load: "+(err.message||"Please refresh."))}
});
$("#logoutBtn").onclick=async()=>{try{await db.auth.signOut()}finally{location.reload()}};
(async()=>{if(!configured)return;try{const {data}=await db.auth.getSession();if(!data.session)return;currentUser=data.session.user;const {data:allowed,error}=await db.from("moderators").select("user_id").eq("user_id",currentUser.id).maybeSingle();if(error||!allowed){await db.auth.signOut();currentUser=null;return}$("#loginPanel").classList.add("hidden");$("#dashboard").classList.remove("hidden");await refresh()}catch(err){status("#loginStatus","Could not restore moderator session. Please sign in again.")}})();
$("#productForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!db||!currentUser){status("#productStatus","Sign in first.");return}
  const id=$("#productId").value;
  try{
    let imageUrls=$("#pImageUrls").value.split("\n").map(x=>x.trim()).filter(Boolean);
    const chosen=[...$("#pPhotos").files];if(chosen.length)imageUrls=imageUrls.concat(await uploadImages(chosen));
    if(id&&!imageUrls.length){const old=await db.from("products").select("image_urls").eq("id",id).single();imageUrls=old.data?.image_urls||[]}
    if(!imageUrls.length)throw new Error("Add at least one product photo or image URL.");
    const defaults=seoDefaults();const payload={name:$("#pName").value.trim(),seo_title:$("#pSeoTitle").value.trim()||null,seo_description:$("#pSeoDescription").value.trim()||null,seo_keywords:$("#pSeoKeywords").value.trim(),price:Number($("#pPrice").value),category:$("#pCategory").value,sizes:$("#pSizes").value.split(",").map(x=>x.trim()).filter(Boolean),description:$("#pDescription").value.trim(),image_urls:imageUrls,is_available:$("#pAvailable").checked,is_published:$("#pPublished").checked,is_exclusive:$("#pExclusive").checked,updated_at:new Date().toISOString()};
    const res=id?await db.from("products").update(payload).eq("id",id):await db.from("products").insert({...payload,created_by:currentUser.id});
    if(res.error)throw res.error;status("#productStatus",payload.is_published?"Product published. Its SEO page and sitemap entry refresh on the next SEO deployment (about 10 minutes).":"Product saved as a draft. It will stay out of the storefront and sitemap until published.");reset();await loadProducts();
  }catch(err){status("#productStatus",err.message||"Could not save product.")}
});
$("#resetProduct").onclick=reset;
$("#adminProducts").addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");
  if(edit){const {data,error}=await db.from("products").select("*").eq("id",edit.dataset.edit).single();if(error){status("#productStatus",error.message);return}
    $("#productId").value=data.id;$("#pName").value=data.name;$("#pSeoTitle").value=data.seo_title||"";$("#pSeoDescription").value=data.seo_description||"";$("#pSeoKeywords").value=data.seo_keywords||"";$("#pPrice").value=data.price;$("#pCategory").value=data.category;$("#pSizes").value=(data.sizes||[]).join(", ");$("#pDescription").value=data.description;$("#pImageUrls").value=(data.image_urls||[]).join("\n");$("#pAvailable").checked=data.is_available;$("#pPublished").checked=data.is_published!==false;$("#pExclusive").checked=data.is_exclusive;$("#productFormTitle").textContent="Edit product";updateSEOPreview();window.scrollTo({top:0,behavior:"smooth"});
  }
  if(del&&confirm("Delete this product?")){const {error}=await db.from("products").delete().eq("id",del.dataset.delete);status("#productStatus",error?.message||"Product deleted.");await loadProducts()}
});
function resetCategoryForm(){ $("#categoryForm").reset();$("#cId").value="";$("#saveCategoryBtn").textContent="Add category"; }
$("#resetCategory").addEventListener("click",resetCategoryForm);
$("#cImageFile").addEventListener("change",e=>$("#cImageFileName").textContent=e.target.files[0]?.name||"No category photo selected.");
$("#bannerFile").addEventListener("change",e=>$("#bannerFileName").textContent=e.target.files[0]?.name||"No banner image selected.");
$("#categoryForm").addEventListener("submit",async e=>{
  e.preventDefault();const id=$("#cId").value,name=$("#cName").value.trim(),slug=$("#cSlug").value.trim()||slugify(name);
  try{
   const uploaded=await uploadSingleImage("#cImageFile");
   const payload={name,slug,parent_id:$("#cParent")?.value||null,sort_order:categories.find(c=>c.id===id)?.sort_order??categories.length,is_visible:true};
   const typedUrl=$("#cImage").value.trim();if(uploaded||typedUrl)payload.image_url=uploaded||typedUrl;
   const result=id?await db.from("categories").update(payload).eq("id",id):await db.from("categories").insert({...payload,image_url:payload.image_url||null});
   if(result.error)throw result.error;
   status("#categoryStatus",id?"Category updated.":"Category added.");resetCategoryForm();await loadCategories();
  }catch(err){status("#categoryStatus",err.message||"Could not save category or upload its image.")}
});
$("#adminCategories").addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit-category]"),del=e.target.closest("[data-delete-category]");
  if(edit){const c=categories.find(x=>String(x.id)===edit.dataset.editCategory);if(!c)return;
   $("#cId").value=c.id;$("#cName").value=c.name;$("#cSlug").value=c.slug;$("#cParent").value=c.parent_id||"";$("#cImage").value=c.image_url||"";$("#saveCategoryBtn").textContent="Update category";window.scrollTo({top:$("#categoryForm").getBoundingClientRect().top+window.scrollY-90,behavior:"smooth"});return;
  }
  if(!del||!confirm("Delete this category? Its products will be kept and moved to the moderator-only Uncategorized group."))return;
  const category=categories.find(c=>String(c.id)===del.dataset.deleteCategory||c.slug===del.dataset.deleteCategory);if(!category)return;
  const {error:moveError}=await db.from("products").update({category:"uncategorized",updated_at:new Date().toISOString()}).eq("category",category.slug);
  if(moveError){status("#categoryStatus","Could not move products out of this category: "+moveError.message);return;}
  const {error}=await db.from("categories").delete().eq("id",category.id);status("#categoryStatus",error?.message||"Category deleted. Products were preserved under Uncategorized.");await Promise.all([loadCategories(),loadProducts()]);
});
$("#bannerForm").addEventListener("submit",async e=>{
 e.preventDefault();try{
  const uploaded=await uploadSingleImage("#bannerFile");
  const imageUrl=uploaded||$("#bannerUrl").value.trim();
  if(!imageUrl)throw new Error("Choose a banner image or paste an image URL.");
  const {error}=await db.from("site_settings").upsert({key:"hero_image_url",value:imageUrl,updated_at:new Date().toISOString(),updated_by:currentUser.id},{onConflict:"key"});
  if(error)throw error;$("#bannerUrl").value=imageUrl;$("#bannerFile").value="";status("#bannerStatus","Homepage banner saved successfully.");
 }catch(err){status("#bannerStatus",err.message||"Could not save banner image.")}
});
if(!configured)status("#loginStatus","Supabase is not configured. Configure the project URL and publishable key to enable moderator access.");
