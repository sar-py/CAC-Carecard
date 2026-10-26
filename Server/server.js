/* One local origin serves both UI and API; no CORS, API key, or install needed. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {createStore} = require('./database');
const logic = require('../public/organizer');
const {createLookup,validBarcode} = require('./barcode');
const {createGemini}=require('./gemini');
for(const file of [path.join(__dirname,'../.env'),path.join(__dirname,'.env')]){try{process.loadEnvFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
const PUBLIC = path.join(__dirname,'../public');
function invalid(message) { const e = new Error(message); e.status = 400; throw e; }
function validate(body, history, previous) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Expected an entry object.');
  const description = body.description;
  if (typeof description !== 'string' || !description.trim() || description.length > 5000) invalid('Write a note between 1 and 5,000 characters.');
  if (body.severity != null && (!Number.isInteger(body.severity) || body.severity < 1 || body.severity > 10)) invalid('Severity must be a whole number from 1 to 10.');
  const recordedAt = body.recordedAt ?? previous?.recordedAt ?? new Date().toISOString();
  if (typeof recordedAt !== 'string' || !Number.isFinite(Date.parse(recordedAt)) || Date.parse(recordedAt) > Date.now()+60000 || Date.parse(recordedAt) < 0) invalid('Choose a valid date that is not in the future.');
  let product = null;
  if (body.product != null) {
    if (!['food','drink','medication','activity','other'].includes(body.product.type) || typeof body.product.name !== 'string' || !body.product.name.trim() || body.product.name.length > 120 || body.product.confirmed !== true) invalid('Confirm a product or activity name and category.');
    product = {name:body.product.name.trim(),type:body.product.type,confirmed:true};
    if(body.product.barcode!=null){if(!validBarcode(body.product.barcode))invalid('Invalid product barcode.');product.barcode=body.product.barcode;}
  }
  let image = body.image ?? null;
  if (image !== null) {
    if (typeof image !== 'string' || image.length > 700000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)) invalid('Use a JPEG, PNG, or WebP image under 500 KB.');
    const buffer = Buffer.from(image.split(',')[1],'base64');
    const valid = image.startsWith('data:image/jpeg') ? buffer[0]===255 && buffer[1]===216 && buffer[2]===255 : image.startsWith('data:image/png') ? buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
    if (!valid || buffer.length>500000) invalid('Image contents do not match a supported image.');
  }
  const analysis = logic.analyze(description,history,product);
  const answers = {}, dismissed = [];
  const allowed = new Set([...analysis.followUpQuestions.map(q=>q.key), ...(previous?.followUpQuestions||[]).map(q=>q.key), ...Object.keys(previous?.answers||{}), ...(previous?.dismissed||[])]);
  if (body.answers != null && (typeof body.answers !== 'object' || Array.isArray(body.answers))) invalid('Invalid follow-up answers.');
  for (const [key,value] of Object.entries(body.answers || {})) {
    if (!allowed.has(key) || typeof value !== 'string' || value.length>500) invalid('Invalid follow-up answer.');
    if (value.trim()) answers[key]=value.trim();
  }
  if (body.dismissed != null && (!Array.isArray(body.dismissed) || body.dismissed.length>20 || body.dismissed.some(k=>!allowed.has(k)))) invalid('Invalid dismissed question.');
  dismissed.push(...new Set(body.dismissed || []));
  return {id:previous?.id || randomUUID(),description,recordedAt:new Date(recordedAt).toISOString(),createdAt:previous?.createdAt || new Date().toISOString(),updatedAt:new Date().toISOString(),...analysis,severity: analysis.needsSeveritySlider ? body.severity ?? analysis.severity : analysis.severity,product,image,answers,dismissed};
}
function createApp(options = {}) {
  const ai=createGemini(options.aiOptions);
  async function enrich(entry,body,history,previous){
    if(body.useAI!==false&&ai.configured){try{const result=await ai.analyze(entry.description,history,entry.product);Object.assign(entry,result,{severity:result.needsSeveritySlider?(body.severity??result.severity):result.severity});}catch(e){entry.aiStatus='unavailable';entry.aiError=e.message;}}
    else if(previous?.analysisSource==='gemini'&&previous.description===entry.description){for(const key of ['symptoms','evidence','onset','needsSeveritySlider','followUpQuestions','analysisSource','aiStatus'])entry[key]=previous[key];if(entry.safety.level!=='emergency')entry.safety=previous.safety;}
    return entry;
  }
  const store = createStore(options.dataDir || process.env.CARECARD_DATA_DIR || path.join(__dirname,'../data'));
  const lookup = createLookup(options.productFetch || fetch);
  return http.createServer(async (req,res) => {
    const json = (code,value) => {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const host = req.headers.host || '';
      if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) return json(403,{error:'Local access only.'});
      if (req.headers.origin && req.headers.origin !== 'http://'+host) return json(403,{error:'Cross-origin access is blocked.'});
      const url = new URL(req.url,'http://'+host);
      const route = url.pathname;
      let body;
      if (['POST','PUT','DELETE'].includes(req.method)) {
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') return json(415,{error:'Use application/json.'});
        let raw = ''; let length = 0;
        for await (const chunk of req) {length += chunk.length; if(length>750000) {const e=new Error('Request too large.');e.status=413;throw e;} raw += chunk;}
        try { body = JSON.parse(raw || '{}'); } catch {invalid('Invalid JSON.');}
      }
      const history = () => store.all().sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt));
      const barcodeRoute=route.match(/^\/api\/barcode\/([^/]+)$/);
      if(barcodeRoute&&req.method==='GET')return json(200,{product:await lookup(barcodeRoute[1])});
      if (route === '/api/health' && req.method==='GET') return json(200,{ok:true,ai:{configured:ai.configured,provider:'Gemini',model:ai.model}});
      if (route === '/api/analyze' && req.method==='POST') {
        if (typeof body?.description !== 'string' || !body.description.trim() || body.description.length>5000) invalid('Enter a note between 1 and 5,000 characters.');
        const previous=history().find(e=>e.id===body.excludeId);
        const context=history().filter(e=>e.id!==body.excludeId);
        if(body.useAI===true)return json(200,{analysis:await ai.analyze(body.description,context,previous?.product)});
        return json(200,{analysis:logic.analyze(body.description,context,previous?.product)});
      }
      if(route==='/api/ai/summary'&&req.method==='POST'){
        if(body?.consent!==true||!Array.isArray(body.entryIds)||body.entryIds.length>100)invalid('Choose up to 100 entries and agree to send them to Gemini.');
        const entries=history().filter(e=>body.entryIds.includes(e.id));if(!entries.length)invalid('Save a note first.');return json(200,{summary:await ai.summary(entries)});
      }
      if(route==='/api/ai/scan'&&req.method==='POST'){
        if(body?.consent!==true||!body.image)invalid('Choose a photo and agree to send it to Gemini.');
        validate({description:'Image validation',image:body.image},[]);return json(200,{product:await ai.scan(body.image)});
      }
      if (route === '/api/entries' && req.method==='GET') return json(200,{entries:history()});
      if (route === '/api/trends' && req.method==='GET') return json(200,{trends:logic.trends(history())});
      if (route === '/api/entries' && req.method==='POST') {
        if (history().length>=2000) invalid('Journal limit reached (2,000 entries). Export and delete entries to continue.');
        const entry = await enrich(validate(body,history()),body,history()); store.put(entry); return json(201,{entry});
      }
      if (route === '/api/entries' && req.method==='DELETE') {
        if (body?.confirm !== 'DELETE ALL') invalid('Deletion confirmation is required.');
        store.clear(); return json(200,{success:true});
      }
      const match = route.match(/^\/api\/entries\/([\w-]+)$/);
      if (match && ['PUT','DELETE'].includes(req.method)) {
        const previous = history().find(e=>e.id===match[1]);
        if(!previous) return json(404,{error:'Entry not found.'});
        if(req.method==='DELETE') {store.remove(previous.id);return json(200,{success:true});}
        const context=history().filter(e=>e.id!==previous.id);const entry = await enrich(validate(body,context,previous),body,context,previous);store.put(entry);return json(200,{entry});
      }
      if(route.startsWith('/api/')) return json(404,{error:'API route not found.'});
      if(req.method!=='GET' && req.method!=='HEAD') return json(405,{error:'Method not allowed.'});
      const files = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/design.css':'design.css','/motion.js':'motion.js','/auth.bundle.js':'auth.bundle.js','/pwa.js':'pwa.js','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icons/icon-192.png':'icons/icon-192.png','/icons/icon-512.png':'icons/icon-512.png','/icons/maskable-512.png':'icons/maskable-512.png','/icons/apple-touch-icon.png':'icons/apple-touch-icon.png','/ai.js':'ai.js','/app.js':'app.js','/voice.js':'voice.js','/organizer.js':'organizer.js','/scanner.js':'scanner.js','/vendor/zxing-0.23.0.min.js':'vendor/zxing-0.23.0.min.js','/fonts/nunito-latin-800-normal.woff2':'fonts/nunito-latin-800-normal.woff2','/fonts/nunito-latin-900-normal.woff2':'fonts/nunito-latin-900-normal.woff2'};
      if(!files[route]) return json(404,{error:'Page not found.'});
      const file=files[route];
      if(file==='sw.js')res.setHeader('Cache-Control','no-store');
      res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.woff2')?'font/woff2':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?'':fs.readFileSync(path.join(PUBLIC,file)));
    } catch(error) {json(error.status || 500,{error:error.status?error.message:'Could not access the journal. Your change was not saved. Check disk space and server logs.'}); if(!error.status) console.error(error.message);}
  });
}
if(require.main===module) {
  const app=createApp(); const port=Number(process.env.PORT || 3000);
  app.on('error',e=>{console.error('CareCard could not start:',e.message);process.exitCode=1;});
  app.listen(port,'127.0.0.1',()=>console.log(`CareCard: http://127.0.0.1:${port}\nPrivate local journal. Press Ctrl+C to stop.`));
}
module.exports={createApp,validate};
