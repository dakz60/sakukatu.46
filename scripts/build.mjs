import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await build({entryPoints:['js/main.js'],bundle:true,format:'iife',outfile:'js/app.js',target:'es2020',charset:'utf8',legalComments:'none'});
let html = await readFile('index.html','utf8');
const css = await readFile('css/style.css','utf8');
const js = await readFile('js/app.js','utf8');
const hash = text => createHash('sha256').update(text).digest('hex').slice(0,12);
html = html.replace(/css\/style\.css\?v=[^"]*/, `css/style.css?v=${hash(css)}`).replace(/js\/app\.js\?v=[^"]*/, `js/app.js?v=${hash(js)}`);
await writeFile('index.html',html);
const offline = html.replace(/<link rel="stylesheet" href="css\/style\.css[^\"]*">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script src="js\/app\.js[^\"]*"><\/script>/, () => `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);
await writeFile('PC用.html', offline);
console.log('Built js/app.js and PC用.html');
