import fs from "node:fs/promises";
import path from "node:path";

const site = "https://delune2008fashion.github.io/DeLune-Fashion-";
const api = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!api || !key) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY repository secrets.");
const headers = { apikey: key, Authorization: "Bearer " + key };
const productQuery = "/rest/v1/products?select=id,name,description,price,category,image_urls,slug,seo_title,seo_description,seo_keywords,is_available,is_published&is_published=eq.true&order=created_at.desc";
let response = await fetch(api + productQuery, { headers });
if (!response.ok && /seo_keywords|column/i.test(await response.clone().text())) {
  response = await fetch(api + productQuery.replace(",seo_keywords", ""), { headers });
}
if (!response.ok) throw new Error("Supabase product fetch failed: " + response.status + " " + await response.text());
const products = await response.json();
const base = await fs.readFile("product.html", "utf8");
const esc = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const slugify = value => String(value || "product").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100);
const urls = new Set();
await fs.rm("products", { recursive: true, force: true });
await fs.mkdir("products", { recursive: true });
for (const p of products) {
  const slug = p.slug || (slugify(p.name) + "-" + String(p.id).slice(0,8));
  const url = site + "/products/" + encodeURIComponent(slug) + "/";
  const title = p.seo_title || (p.name + " — DeLune");
  const description = p.seo_description || ((p.description || "Discover " + p.name + " at DeLune.") + " Price: ৳" + Number(p.price || 0).toLocaleString("en-BD") + ".");
  const image = p.image_urls?.[0] || site + "/logo.png";
  let html = base;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description,
    keywords: String(p.seo_keywords || "").split(",").map(x => x.trim()).filter(Boolean),
    image: p.image_urls?.length ? p.image_urls : [site + "/logo.png"],
    sku: p.id,
    category: p.category || undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    brand: { "@type": "Brand", name: "DeLune" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BDT",
      price: Number(p.price || 0),
      availability: p.is_available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "DeLune", url: site + "/" }
    }
  };
  const jsonLd = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  html = html.replace("<head>", '<head>\n<base href="/DeLune-Fashion-/">\n<script type="application/ld+json">' + jsonLd + '</script>');
  html = html.replace(/<title>[^<]*<\/title>/i, "<title>" + esc(title) + "</title>");
  html = html.replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="' + esc(description) + '">');
  html = html.replace(/<link rel="canonical" href="[^"]*">/i, '<link rel="canonical" href="' + url + '">');
  html = html.replace(/<meta property="og:type" content="[^"]*">/i, '<meta property="og:type" content="product">');
  html = html.replace(/<meta property="og:title" content="[^"]*">/i, '<meta property="og:title" content="' + esc(title) + '">');
  html = html.replace(/<meta property="og:description" content="[^"]*">/i, '<meta property="og:description" content="' + esc(description) + '">');
  html = html.replace(/<meta property="og:url" content="[^"]*">/i, '<meta property="og:url" content="' + url + '">');
  html = html.replace(/<meta property="og:image" content="[^"]*">/i, '<meta property="og:image" content="' + esc(image) + '">');
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/i, '<meta name="twitter:title" content="' + esc(title) + '">');
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/i, '<meta name="twitter:description" content="' + esc(description) + '">');
  html = html.replace(/<meta name="twitter:image" content="[^"]*">/i, '<meta name="twitter:image" content="' + esc(image) + '">');
  html = html.replace("<body>", '<body data-product-id="' + esc(p.id) + '">');
  const directory = path.join("products", slug);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
  urls.add(url);
}
const fixed = ["/","/categories.html","/about.html","/contact.html"];
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...fixed.map(p=>site+p), ...urls].map(u=>"  <url><loc>"+esc(u)+"</loc></url>").join("\n") +
  "\n</urlset>\n";
await fs.writeFile("sitemap.xml", xml);
console.log("Generated " + products.length + " published product pages and sitemap.xml.");
