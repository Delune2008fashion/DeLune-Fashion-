(function(){
  if(location.hostname.toLowerCase()!=="fahad09belal.github.io")return;
  var path=location.pathname||"/";
  var prefix="/DeLune-Fashion-";
  if(path.toLowerCase().startsWith(prefix.toLowerCase()))path=path.slice(prefix.length);
  var clean=path;
  while(clean.length>1&&clean.endsWith("/"))clean=clean.slice(0,-1);
  var routes={"/":"/index.html","/index":"/index.html","/categories":"/categories.html","/about":"/about.html","/contact":"/contact.html","/product":"/product.html","/moderate":"/moderate.html"};
  var base="https://delune2008fashion.github.io/DeLune-Fashion-";
  var match=clean.match(/^\/products\/(.+?)(?:\/index\.html)?\/?$/i);
  if(match){
    var slug=match[1].split("/")[0];
    try{slug=decodeURIComponent(slug)}catch(e){}
    location.replace(base+"/product.html?slug="+encodeURIComponent(slug)+location.search+location.hash);
    return;
  }
  var target=routes[clean.toLowerCase()]||clean;
  location.replace(base+target+location.search+location.hash);
})();