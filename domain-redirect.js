(function(){
  if(location.hostname.toLowerCase()!=="fahad09belal.github.io")return;
  var path=location.pathname;
  var prefix="/DeLune-Fashion-";
  if(path.toLowerCase().startsWith(prefix.toLowerCase()))path=path.slice(prefix.length);
  if(!path)path="/";
  var clean=path;
  while(clean.length>1&&clean.endsWith("/"))clean=clean.slice(0,-1);
  var routes={"/":"/index.html","/index":"/index.html","/categories":"/categories.html","/about":"/about.html","/contact":"/contact.html","/product":"/product.html","/moderate":"/moderate.html"};
  var target=routes[clean.toLowerCase()]||clean;
  location.replace("https://delune.qd.je"+target+location.search+location.hash);
})();
