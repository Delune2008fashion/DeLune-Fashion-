const $=(s,r=document)=>r.querySelector(s),money=n=>"৳"+Number(n||0).toLocaleString("en-BD"),safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const imageOf=p=>p.images?.[0]||"";
function errorPanel(message,action){return '<div class="error-state" role="alert">'+safe(message)+'<button type="button" data-retry="'+action+'">Try again</button></div>'}
function setMeta(key,value,property=false){let node=document.querySelector('meta['+(property?'property':'name')+'="'+key+'"]');if(!node){node=document.createElement('meta');node.setAttribute(property?'property':'name',key);document.head.appendChild(node)}node.content=value}
function updateSEO(title,description,url,image){if(title)document.title=title;if(description)setMeta('description',description);const canonicalUrl=new URL(url||location.href,location.origin);for(const key of [...canonicalUrl.searchParams.keys()])if(/^utm_/i.test(key)||["fbclid","gclid"].includes(key.toLowerCase()))canonicalUrl.searchParams.delete(key);canonicalUrl.hash="";const pageUrl=canonicalUrl.href;let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=pageUrl;setMeta('og:type','website',true);setMeta('og:site_name','DeLune',true);setMeta('og:title',title||document.title,true);setMeta('og:description',description||'Discover DeLune fashion.',true);setMeta('og:url',pageUrl,true);setMeta('og:image',image||new URL('logo.png',location.href).href,true);setMeta('twitter:card','summary_large_image');setMeta('twitter:title',title||document.title);setMeta('twitter:description',description||'Discover DeLune fashion.');setMeta('twitter:image',image||new URL('logo.png',location.href).href)}

const messenger=(p,variant)=>"Hello DeLune, I would like to order: "+p.name+" (৳"+Number(p.price||0)+"), size/quantity: "+variant+". Please confirm its availability and delivery details.";
function productSlug(p){return p.slug||(`${String(p.name||"product").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100)||"product"}-${String(p.id).slice(0,8)}`)}
function productCard(p){return `<a class="product-card" href="/products/${encodeURIComponent(productSlug(p))}/"><div class="product-photo">${imageOf(p)?`<img loading="lazy" src="${safe(imageOf(p))}" alt="${safe(p.name)}">`:'<div class="blank-image" aria-label="No product image"></div>'}${p.exclusive?'<span class="product-tag">Exclusive</span>':""}</div><div class="product-info"><h3>${safe(p.name)}</h3><div class="product-meta"><span>${safe(p.category==="uncategorized"?"Collection":(p.category||"Collection"))}</span><strong>${money(p.price)}</strong></div></div></a>`}
async function renderHome(){const grid=$("#exclusiveGrid"),cats=$("#categoryGrid");if(!grid||!cats)return;try{const [ps,cs,heroUrl]=await Promise.all([DeLuneStore.products({exclusive:true}),DeLuneStore.categories(),DeLuneStore.heroImage()]);const hero=$(".hero-image");if(hero){if(heroUrl){hero.style.backgroundImage=`url("${heroUrl.replace(/"/g,"%22")}")`;const note=$(".hero-image-note",hero);if(note)note.hidden=false}else{hero.style.backgroundImage="none";const note=$(".hero-image-note",hero);if(note)note.hidden=true}}grid.innerHTML=ps.length?ps.map(productCard).join(""):'<div class="empty-state">New exclusive pieces are coming soon.</div>';cats.innerHTML=cs.filter(c=>!c.parent_id).map(c=>{const children=cs.filter(x=>x.parent_id===c.id);return `<section class="category-card category-accordion">${c.image_url?`<img loading="lazy" src="${safe(c.image_url)}" alt="${safe(c.name)}">`:'<div class="blank-image category-blank" aria-label="No category image"></div>'}<div class="category-accordion-content"><button type="button" class="category-toggle" aria-expanded="false" aria-controls="subcats-${safe(c.id)}"><span>${safe(c.name)}</span><span class="category-chevron" aria-hidden="true">＋</span></button><div class="category-subcategories" id="subcats-${safe(c.id)}" hidden>${children.map(x=>`<a href="/categories.html?category=${encodeURIComponent(x.slug)}">${safe(x.name)}</a>`).join("")}<a class="category-all-link" href="/categories.html?category=${encodeURIComponent(c.slug)}">Explore all ${safe(c.name)} ↗</a></div></div></section>`}).join("");cats.querySelectorAll(".category-toggle").forEach(btn=>btn.addEventListener("click",()=>{const panel=document.getElementById(btn.getAttribute("aria-controls"));const opening=panel.hidden;panel.hidden=!opening;btn.setAttribute("aria-expanded",String(opening));btn.querySelector(".category-chevron").textContent=opening?"－":"＋"}))}catch(e){grid.innerHTML=errorPanel("The collection could not load. Check your connection and try again.","home");cats.innerHTML=""}}
async function renderCategories(){
 const grid=$("#allProducts"),filters=$("#filters");if(!grid||!filters)return;
 let category=new URLSearchParams(location.search).get("category")||"";
 try{
  const cs=await DeLuneStore.categories();
  const parents=cs.filter(c=>!c.parent_id);
  filters.innerHTML='<button class="filter-btn" data-category="">All products</button>'+parents.map(c=>{
   const children=cs.filter(x=>String(x.parent_id)===String(c.id));
   return `<section class="collection-accordion"><button type="button" class="collection-parent" data-parent="${safe(c.id)}" aria-expanded="false"><span>${safe(c.name)}</span><span class="category-chevron">＋</span></button><div class="collection-children" id="collection-${safe(c.id)}" hidden>${children.map(x=>`<button type="button" class="filter-btn collection-child" data-category="${safe(x.slug)}">${safe(x.name)}</button>`).join("")}<button type="button" class="filter-btn collection-child collection-all" data-category="${safe(c.slug)}">All ${safe(c.name)}</button></div></section>`;
  }).join("");
  async function load(cat){category=cat;filters.querySelectorAll("[data-category]").forEach(b=>b.classList.toggle("active",b.dataset.category===cat));const ps=await DeLuneStore.products({category:cat||undefined});grid.innerHTML=ps.length?ps.map(productCard).join(""):'<div class="empty-state">No products in this collection yet.</div>'}
  filters.addEventListener("click",e=>{
   const parent=e.target.closest("[data-parent]");
   if(parent){const panel=document.getElementById("collection-"+parent.dataset.parent);const opening=panel.hidden;panel.hidden=!opening;parent.setAttribute("aria-expanded",String(opening));parent.querySelector(".category-chevron").textContent=opening?"－":"＋";return}
   const child=e.target.closest("[data-category]");if(child)load(child.dataset.category);
  });
  if(category){const selected=cs.find(c=>c.slug===category);if(selected?.parent_id){const parent=filters.querySelector(`[data-parent="${CSS.escape(String(selected.parent_id))}"]`);if(parent){const panel=document.getElementById("collection-"+selected.parent_id);panel.hidden=false;parent.setAttribute("aria-expanded","true");parent.querySelector(".category-chevron").textContent="－"}}await load(category)}else await load("");
 }catch(e){grid.innerHTML=errorPanel("Could not load products. Please try again.","categories")}
}
async function renderProduct(){
 const root=$("#productDetail");if(!root)return;
 try{
  const params=new URLSearchParams(location.search);
  const p=await DeLuneStore.product(document.body.dataset.productId||params.get("id")||params.get("slug"));
  if(!p){root.innerHTML='<p class="empty-state">Product not found.</p>';return}
  const pics=p.images||[],sizes=p.sizes?.length?p.sizes:["One size"];
  updateSEO(p.seo_title||p.name+" — DeLune",p.seo_description||(p.description||"Shop "+p.name+" at DeLune.")+" Price: ৳"+Number(p.price||0).toLocaleString("en-BD")+".",location.href,pics[0]||undefined);
  root.innerHTML=`<div class="product-gallery"><div class="gallery-stage">${pics.length>1?'<button class="gallery-arrow prev" type="button" aria-label="Previous photo">‹</button>':""}${pics.length?`<img class="detail-image" id="galleryMain" src="${safe(pics[0])}" alt="${safe(p.name)}">`:'<div class="detail-image blank-image" aria-label="No product image"></div>'}${pics.length>1?'<button class="gallery-arrow next" type="button" aria-label="Next photo">›</button>':""}</div>${pics.length>1?`<div class="gallery-thumbs">${pics.map((u,i)=>`<button type="button" class="gallery-thumb ${i===0?"active":""}" data-i="${i}"><img src="${safe(u)}" alt="Photo ${i+1}"></button>`).join("")}</div>`:""}</div><div class="detail-copy"><p class="eyebrow">${p.exclusive?"EXCLUSIVE PIECE":safe(p.category==="uncategorized"?"COLLECTION":(p.category||"COLLECTION"))}</p><h1>${safe(p.name)}</h1><p class="detail-price">${money(p.price)}</p><p class="detail-description">${safe(p.description||"")}</p><p class="eyebrow">SELECT SIZE / VARIANT</p><div class="size-list">${sizes.map((s,i)=>`<button type="button" class="size-chip size-choice ${i===0?"selected":""}" data-size="${safe(s)}">${safe(s)}</button>`).join("")}</div><p class="detail-description">${p.available?"Available to order":"Currently unavailable"}</p>${p.available?'<button class="whatsapp-button order-start" type="button">Order it</button>':""}</div>`;
  let selected=sizes[0];
  root.querySelectorAll(".size-choice").forEach(b=>b.onclick=()=>{selected=b.dataset.size;root.querySelectorAll(".size-choice").forEach(x=>x.classList.toggle("selected",x===b))});
  if(p.available){
   const overlay=document.createElement("div");overlay.className="checkout-overlay";overlay.hidden=true;
   overlay.innerHTML=`<section class="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle"><button type="button" class="checkout-close" aria-label="Close">×</button><div class="checkout-progress" aria-label="Checkout steps"><span class="current">1 Quantity</span><span>2 Details</span><span>3 Review</span></div><div class="checkout-content"></div></section>`;
   document.body.appendChild(overlay);
   const content=$(".checkout-content",overlay),progress=$(".checkout-progress",overlay);
   let quantity=1,customer={name:"",phone:"",address:""},step=1;
   const total=()=>Number(p.price||0)*quantity;
   const paint=()=>{
    progress.querySelectorAll("span").forEach((el,i)=>el.classList.toggle("current",i===step-1));
    if(step===1)content.innerHTML=`<h2 id="checkoutTitle">Select quantity</h2><div class="checkout-product"><img src="${safe(pics[0]||"")}" alt=""><div><strong>${safe(p.name)}</strong><p>${safe(selected)}</p><b>${money(p.price)} each</b></div></div><div class="quantity-control"><button type="button" data-qty="-1" aria-label="Decrease quantity">−</button><output>${quantity}</output><button type="button" data-qty="1" aria-label="Increase quantity">＋</button></div><p class="checkout-total">Subtotal <strong>${money(total())}</strong></p><button type="button" class="whatsapp-button checkout-next">Continue</button>`;
    if(step===2)content.innerHTML=`<h2 id="checkoutTitle">Delivery information</h2><form class="checkout-form"><label>Your name<input name="name" autocomplete="name" required maxlength="100" value="${safe(customer.name)}"></label><label>Contact number<input name="phone" type="tel" autocomplete="tel" required maxlength="25" value="${safe(customer.phone)}" placeholder="+880..."></label><label>Delivery address<textarea name="address" autocomplete="street-address" required maxlength="500" rows="3">${safe(customer.address)}</textarea></label><div class="checkout-actions"><button type="button" class="checkout-back">Back</button><button type="submit" class="whatsapp-button">Review order</button></div></form>`;
    if(step===3)content.innerHTML=`<h2 id="checkoutTitle">Review your order</h2><div class="checkout-review"><p><span>Product</span><strong>${safe(p.name)}</strong></p><p><span>Size / variant</span><strong>${safe(selected)}</strong></p><p><span>Quantity</span><strong>${quantity}</strong></p><p><span>Unit price</span><strong>${money(p.price)}</strong></p><p><span>Name</span><strong>${safe(customer.name)}</strong></p><p><span>Contact</span><strong>${safe(customer.phone)}</strong></p><p><span>Address</span><strong>${safe(customer.address)}</strong></p><p class="checkout-total"><span>Total</span><strong>${money(total())}</strong></p></div><p class="checkout-hint">Your order details will open in WhatsApp. Send the message there to place your order.</p><div class="checkout-actions checkout-submit-options"><button type="button" class="checkout-back">Back</button><button type="button" class="whatsapp-button checkout-submit">Order via WhatsApp</button><button type="button" class="whatsapp-button messenger-button checkout-messenger">Order via Messenger</button></div>`;
   };
   const close=()=>{overlay.hidden=true;document.body.classList.remove("checkout-open")};
   const open=()=>{step=1;quantity=1;paint();overlay.hidden=false;document.body.classList.add("checkout-open");$(".checkout-close",overlay).focus()};
   $(".order-start",root).addEventListener("click",open);
   $(".checkout-close",overlay).onclick=close;
   overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
   document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)close()});
   content.addEventListener("click",e=>{
    const qty=e.target.closest("[data-qty]");if(qty){quantity=Math.max(1,Math.min(99,quantity+Number(qty.dataset.qty)));paint();return}
    if(e.target.closest(".checkout-next")){step=2;paint();return}
    if(e.target.closest(".checkout-back")){step=Math.max(1,step-1);paint();return}
    if(e.target.closest(".checkout-submit")||e.target.closest(".checkout-messenger")){
     const msg=["Hello DeLune, I would like to place an order:","Product: "+p.name,"Variant: "+selected,"Quantity: "+quantity,"Unit price: "+money(p.price),"Total: "+money(total()),"Name: "+customer.name,"Contact: "+customer.phone,"Delivery address: "+customer.address].join("\n");
     if(e.target.closest(".checkout-messenger")){
      const messengerUrl=window.DELUNE_CONFIG?.MESSENGER_URL||"";
      if(!messengerUrl){alert("Messenger ordering is not configured.");return}
      try{await navigator.clipboard.writeText(msg)}catch(err){}
      window.open(messengerUrl,"_blank","noopener");
      alert("Your order details are ready. Paste the copied message in Messenger to send your order.");
     }else{
      const number=String(window.DELUNE_CONFIG?.WHATSAPP_NUMBER||"").replace(/\D/g,"");
      if(!number){alert("WhatsApp ordering is not configured yet. Please contact DeLune.");return}
      window.open("https://wa.me/"+number+"?text="+encodeURIComponent(msg),"_blank","noopener");
     }
     close();
    }
   });
   content.addEventListener("submit",e=>{if(!e.target.matches(".checkout-form"))return;e.preventDefault();const fd=new FormData(e.target);customer={name:String(fd.get("name")||"").trim(),phone:String(fd.get("phone")||"").trim(),address:String(fd.get("address")||"").trim()};if(!customer.name||!customer.phone||!customer.address)return;step=3;paint()});
  }
  if(pics.length>1){let n=0;const show=i=>{n=(i+pics.length)%pics.length;const main=$("#galleryMain",root);main.classList.add("gallery-changing");main.src=pics[n];main.onload=()=>main.classList.remove("gallery-changing");root.querySelectorAll(".gallery-thumb").forEach((b,j)=>b.classList.toggle("active",j===n))};$(".prev",root).onclick=()=>show(n-1);$(".next",root).onclick=()=>show(n+1);root.querySelectorAll(".gallery-thumb").forEach(b=>b.onclick=()=>show(+b.dataset.i));let x=0;$(".gallery-stage",root).addEventListener("touchstart",e=>x=e.touches[0].clientX,{passive:true});$(".gallery-stage",root).addEventListener("touchend",e=>{let d=e.changedTouches[0].clientX-x;if(Math.abs(d)>35)show(n+(d<0?1:-1))},{passive:true})}
 }catch(e){console.error("Product checkout failed",e);root.innerHTML=errorPanel("This product could not be loaded. Please try again.","product")}
}
async function renderMenuCategories(){const host=$("#menuCategoryLinks");if(!host)return;try{const cs=await DeLuneStore.categories();const parents=cs.filter(c=>!c.parent_id);host.innerHTML=parents.map(c=>`<a class="menu-sub" href="/categories.html?category=${encodeURIComponent(c.slug)}">${safe(c.name)}</a>`).join("")}catch(e){host.innerHTML=""}}

async function applySavedPageTexts(){try{const {data,error}=await DeLuneStore.client.from("site_settings").select("value").eq("key","content_texts").maybeSingle();if(error||!data?.value)return;const values=JSON.parse(data.value),page=(location.pathname.split("/").pop()||"index.html").replace(/\.html$/,"");Object.entries(values).forEach(([key,value])=>{const split=key.indexOf("|"),p=key.slice(0,split),selector=key.slice(split+1);if(p!==page&&!(p==="index"&&page==="index")||typeof value!=="string")return;const el=$(selector);if(el)el.textContent=value})}catch(e){console.warn("DeLune page text settings could not be applied",e)}}
function initMotion(){
 const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(!reduce&&"IntersectionObserver" in window){
  const targets=document.querySelectorAll(".product-card,.category-card,.section-heading,.brand-note,.intro-strip,.product-detail");
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
   if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target)}
  }),{threshold:.12,rootMargin:"0px 0px -35px 0px"});
  targets.forEach((el,index)=>{el.classList.add("motion-reveal");el.style.transitionDelay=(Math.min(index%4,3)*65)+"ms";observer.observe(el)});
 }else document.querySelectorAll(".product-card,.category-card,.section-heading,.brand-note,.intro-strip,.product-detail").forEach(el=>el.classList.add("is-visible"));
 if(!reduce){
  document.addEventListener("click",event=>{
   const link=event.target.closest("a[href]");
   if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const url=new URL(link.href,location.href);
   if(url.origin!==location.origin||url.hash&&url.pathname===location.pathname||link.target||link.hasAttribute("download"))return;
   document.body.classList.add("is-leaving");
  });
  window.addEventListener("pageshow",()=>document.body.classList.remove("is-leaving"));
 }
}
function init(){initMotion();$("#year")&&($("#year").textContent=new Date().getFullYear());updateSEO();document.addEventListener("click",e=>{const retry=e.target.closest("[data-retry]");if(!retry)return;({home:renderHome,categories:renderCategories,product:renderProduct}[retry.dataset.retry]||(()=>{}))()});document.addEventListener("error",e=>{const img=e.target;if(!(img instanceof HTMLImageElement))return;const placeholder=document.createElement("div");placeholder.className="blank-image";placeholder.setAttribute("role","img");placeholder.setAttribute("aria-label","Image unavailable");img.replaceWith(placeholder)},true);$("#menuToggle")?.addEventListener("click",()=>$("#menuPanel").classList.toggle("open"));$("#searchToggle")?.addEventListener("click",()=>{$("#searchBar").classList.toggle("open");$("#searchInput").focus()});$("#searchClose")?.addEventListener("click",()=>$("#searchBar").classList.remove("open"));$("#searchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")location.href="/categories.html?q="+encodeURIComponent(e.target.value)});renderHome();renderCategories();renderProduct();renderMenuCategories();applySavedPageTexts()}document.addEventListener("DOMContentLoaded",init);
