(() => {
  const cfg = window.DELUNE_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("YOUR_") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("YOUR_");
  const merchantPortal = /(?:^|\/)merchant\.html$/.test(window.location.pathname);
  const rememberKey = "delune_merchant_keep_signed_in_v1";
  const merchantAuthStorage = merchantPortal ? {
    getItem(key) {
      const storage = localStorage.getItem(rememberKey) === "true" ? localStorage : sessionStorage;
      return storage.getItem(key);
    },
    setItem(key, value) {
      const keepSignedIn = localStorage.getItem(rememberKey) === "true";
      const selectedStorage = keepSignedIn ? localStorage : sessionStorage;
      const otherStorage = keepSignedIn ? sessionStorage : localStorage;
      otherStorage.removeItem(key);
      selectedStorage.setItem(key, value);
    },
    removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } : undefined;
  const client = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY,
        merchantPortal ? { auth: { storage: merchantAuthStorage } } : undefined)
    : null;
  const demoProducts = [];
  const demoCategories = [];
  async function products(filters={}) {
    if (!client) return [];
    let q=client.from("products").select("*").eq("is_published",true).order("created_at",{ascending:false});
    if(Array.isArray(filters.categories)&&filters.categories.length) q=q.in("category",filters.categories); else if(filters.category) q=q.eq("category",filters.category);
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
  async function heroImage(){if(!client)return [];const {data,error}=await client.from("site_settings").select("value").eq("key","hero_image_url").maybeSingle();if(error)throw error;const raw=data?.value||"";if(!raw)return [];try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return parsed.filter(x=>typeof x==="string"&&x.trim())}catch{}return [raw]}
  async function product(identifier) {
    if (!client || !identifier) return null;
    let data=null, error=null;
    const isId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(identifier));
    if(isId){
      const result=await client.from("products").select("*").eq("id",identifier).maybeSingle();
      data=result.data; error=result.error;
    }else{
      const result=await client.from("products").select("*").eq("slug",identifier).maybeSingle();
      data=result.data; error=result.error;
      if(!error&&!data){
        const fallback=await client.from("products").select("*").eq("is_published",true);
        if(fallback.error) throw fallback.error;
        const slugify=value=>String(value||"product").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100)||"product";
        data=(fallback.data||[]).find(p=>(p.slug||(`${slugify(p.name)}-${String(p.id).slice(0,8)}`))===identifier)||null;
      }
    }
    if(error) throw error;
    if(!data) return null;
    return {...data,exclusive:data.is_exclusive,available:data.is_available,images:data.image_urls||[],sizes:data.sizes||[]};
  }
  window.DeLuneStore={client,products,categories,product,heroImage,configured:!!client,demoProducts,demoCategories};
})();