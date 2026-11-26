const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const www=path.join(root,'www');
fs.mkdirSync(www,{recursive:true});
for (const name of fs.readdirSync(root)) {
  if (['node_modules','android','ios','www','dist','scripts','.git'].includes(name)) continue;
  if (name.startsWith('.')) continue;
  const src=path.join(root,name);
  const st=fs.statSync(src);
  if (st.isFile() && /\.(html|js|css|png|jpg|svg|webp|woff2?)$/i.test(name)) {
    fs.copyFileSync(src, path.join(www,name));
  }
}
for (const stale of ['package.json', 'package-lock.json', 'capacitor.config.json']) {
  const extra = path.join(www, stale);
  if (fs.existsSync(extra)) fs.unlinkSync(extra);
}
console.log('copied static assets → www/');
