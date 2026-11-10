const $=(s,root=document)=>root.querySelector(s);
const money=n=>"৳"+Number(n||0).toLocaleString("en-BD");
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const imageOf=p=>p.images?.[0]||"https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80";
function productCard(p){return `<a class="product-card" href="product.html?id=${encodeURIComponent(p.id)}"><div class="product-photo"><img loading="lazy" src="${safe(imageOf(p))}" alt="${safe(p.name)}">${p.exclusive?'<span class="product-tag">Exclusive</span>':""}</div><div class="product-info"><h3>${safe(p.name)}</h3><div class="product-meta"><span>${safe(p.category||"Collection")}</span><strong>${money(p.price)}</strong></div></div></a>`}
async function renderHome(){
  const grid=$("#exclusiveGrid"), cats=$("#categoryGrid");
  if(!grid||!cats)return;
  try{
    const [ps,cs]=await Promise.all([DeLuneStore.products({exclusive:true}),DeLuneStore.categories()]);
    grid.innerHTML=ps.length?ps.map(productCard).join():'<div class="empty-state">New exclusive pieces are coming soon.</div>';
    cats.innerHTML=cs.map(c=>`<a class="category-card" href="categories.html?category=${encodeURIComponent(c.slug)}"><img loading="lazy" src="${safe(c.image_url||imageOf({}))}" alt="${safe(c.name)}"><div><h3>${safe(c.name)}</h3><span>Explore collection ↗</span></div></a>`).join("");
  }catch(e){grid.innerHTML='<div class="empty-state">The collection could not load. Please try again later.</div>';cats.innerHTML="";}
}
async function renderCategories(){
  const grid=$("#allProducts"), filters=$("#filters"); if(!grid)return;
  const params=new URLSearchParams(location.search); let category=params.get("category")||"";
  try{
    const cs=await DeLuneStore.categories();
    filters.innerHTML=`<button class="filter-btn ${!category?"active":""}" data-category="">All</button>`+cs.map(c=>`<button class="filter-btn ${category===c.slug?"active":""}" data-category="${safe(c.slug)}">${safe(c.name)}</button>`).join("");
    async function load(cat){category=cat;filters.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.category===cat));const ps=await DeLuneStore.products({category:cat||undefined});grid.innerHTML=ps.length?ps.map(productCard).join():'<div class="empty-state">No available products in this collection yet.</div>';}
    filters.addEventListener("click",e=>{const b=e.target.closest("button[data-category]");if(b)load(b.dataset.category)});
    await load(category);
  }catch(e){grid.innerHTML='<div class="empty-state">Could not load products.</div>'}
}
async function renderProduct(){
  const root=$("#productDetail");if(!root)return;
  const id=new URLSearchParams(location.search).get("id");
  try{
    const p=await DeLuneStore.product(id);if(!p){root.innerHTML='<p class="empty-state">Product not found.</p>';return;}
    const sizes=(p.sizes||[]).map(s=>`<span class="size-chip">${safe(s)}</span>`).join("")||'<span class="size-chip">One size</span>';
    root.innerHTML=`<img class="detail-image" src="${safe(imageOf(p))}" alt="${safe(p.name)}"><div class="detail-copy"><p class="eyebrow">${p.exclusive?"EXCLUSIVE PIECE":safe(p.category||"DELUNE COLLECTION")}</p><h1>${safe(p.name)}</h1><p class="detail-price">${money(p.price)}</p><p class="detail-description">${safe(p.description||"A considered addition to your everyday collection.")}</p><p class="eyebrow" style="margin-top:30px">AVAILABLE SIZES</p><div class="size-list">${sizes}</div><p class="detail-description">${p.available?"Available to order":"Currently unavailable"}</p>${p.available?`<a class="whatsapp-button" target="_blank" rel="noopener" href="${whatsappUrl(p)}">Order on WhatsApp ↗</a>`:""}</div>`;
  }catch(e){root.innerHTML='<p class="empty-state">Could not load this product.</p>'}
}
function whatsappUrl(p){
  const number=window.DELUNE_CONFIG?.WHATSAPP_NUMBER||"";
  const msg=`Hello DeLune, I would like to order: ${p.name} (${money(p.price)}). Please confirm available sizes and delivery details.`;
  return `https://wa.me/${number.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
}
function init(){
  $("#year")&&($("#year").textContent=new Date().getFullYear());
  $("#menuToggle")?.addEventListener("click",()=>{const panel=$("#menuPanel"),open=panel.classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open))});
  $("#searchToggle")?.addEventListener("click",()=>{$("#searchBar").classList.toggle("open");$("#searchInput").focus()});
  $("#searchClose")?.addEventListener("click",()=>$("#searchBar").classList.remove("open"));
  $("#searchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")location.href="categories.html?q="+encodeURIComponent(e.target.value)});
  renderHome();renderCategories();renderProduct();
}
document.addEventListener("DOMContentLoaded",init);