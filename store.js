(() => {
  const cfg = window.DELUNE_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("YOUR_") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("YOUR_");
  const client = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const demoProducts = [
    {id:"demo-1",name:"The Everyday Jacket",description:"A considered outer layer with a relaxed silhouette and clean finishing.",price:3850,category:"jackets",sizes:["S","M","L"],available:true,exclusive:true,images:["https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=900&q=80"]},
    {id:"demo-2",name:"Essential Knit Hoodie",description:"An easy, tactile layer for everyday wear.",price:2450,category:"hoodies",sizes:["M","L","XL"],available:true,exclusive:true,images:["https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80"]},
    {id:"demo-3",name:"Minimal Court Sneaker",description:"A versatile low-profile sneaker with a timeless shape.",price:3200,category:"sneakers",sizes:["40","41","42","43"],available:true,exclusive:true,images:["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80"]},
    {id:"demo-4",name:"Signature Cotton Tee",description:"A clean everyday essential in soft cotton.",price:1250,category:"t-shirts",sizes:["S","M","L","XL"],available:true,exclusive:false,images:["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80"]}
  ];
  const demoCategories = [
    {slug:"sneakers",name:"Sneakers",image_url:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80"},
    {slug:"hoodies",name:"Hoodies",image_url:"https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80"},
    {slug:"jackets",name:"Jackets",image_url:"https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=900&q=80"},
    {slug:"t-shirts",name:"T-shirts",image_url:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80"}
  ];
  async function products(filters={}) {
    if (!client) return demoProducts.filter(p => (!filters.category || p.category===filters.category) && (!filters.exclusive || p.exclusive));
    let q=client.from("products").select("*").order("created_at",{ascending:false});
    if(filters.category) q=q.eq("category",filters.category);
    if(filters.exclusive) q=q.eq("is_exclusive",true);
    if(filters.availableOnly!==false) q=q.eq("is_available",true);
    const {data,error}=await q;
    if(error) throw error;
    return (data||[]).map(p=>({...p,exclusive:p.is_exclusive,available:p.is_available,images:p.image_urls||[],sizes:p.sizes||[]}));
  }
  async function categories() {
    if(!client) return demoCategories;
    const {data,error}=await client.from("categories").select("*").eq("is_visible",true).order("sort_order");
    if(error) throw error; return data||[];
  }
  async function product(id) {
    if(!client) return demoProducts.find(p=>p.id===id);
    const {data,error}=await client.from("products").select("*").eq("id",id).single();
    if(error) throw error; return {...data,exclusive:data.is_exclusive,available:data.is_available,images:data.image_urls||[],sizes:data.sizes||[]};
  }
  window.DeLuneStore={client,products,categories,product,configured:!!client,demoProducts,demoCategories};
})();