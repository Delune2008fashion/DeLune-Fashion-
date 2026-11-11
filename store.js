(() => {
  const cfg = window.DELUNE_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("YOUR_") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("YOUR_");
  const client = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const demoProducts = [];
  const demoCategories = [];
  async function products(filters={}) {
    if (!client) return [];
    let q=client.from("products").select("*").order("created_at",{ascending:false});
    if(filters.category) q=q.eq("category",filters.category);
    if(filters.exclusive) q=q.eq("is_exclusive",true);
    if(filters.availableOnly!==false) q=q.eq("is_available",true);
    const {data,error}=await q;
    if(error) throw error;
    return (data||[]).map(p=>({...p,exclusive:p.is_exclusive,available:p.is_available,images:p.image_urls||[],sizes:p.sizes||[]}));
  }
  async function categories() {
    if(!client) return [];
    const {data,error}=await client.from("categories").select("*").eq("is_visible",true).order("sort_order");
    if(error) throw error; return data||[];
  }
  async function heroImage(){if(!client)return "";const {data,error}=await client.from("site_settings").select("value").eq("key","hero_image_url").maybeSingle();if(error)throw error;return data?.value||""}
  async function product(id) {
    if(!client) return null;
    const {data,error}=await client.from("products").select("*").eq("id",id).single();
    if(error) throw error; return {...data,exclusive:data.is_exclusive,available:data.is_available,images:data.image_urls||[],sizes:data.sizes||[]};
  }
  window.DeLuneStore={client,products,categories,product,heroImage,configured:!!client,demoProducts,demoCategories};
})();