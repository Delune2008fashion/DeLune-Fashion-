(function(){
  var host=location.hostname.toLowerCase();
  var githubHost="delune2008fashion.github.io";
  var primary="https://delune.qd.je";
  if(host!==githubHost)return;
  var path=location.pathname||"/";
  var prefix="/DeLune-Fashion-";
  if(path.toLowerCase().startsWith(prefix.toLowerCase()))path=path.slice(prefix.length)||"/";
  var target=primary+(path.startsWith("/")?path:"/"+path)+location.search+location.hash;
  location.replace(target);
})();
