const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const logic=require('../public/organizer');
const {createLookup,validBarcode}=require('../Server/barcode');
const {createApp}=require('../Server/server');
test('severity is conditional across rated symptoms and absent for neutral/negated notes',()=>{
  for(const text of ['headache','nausea','dizzy','tired','stomach pain','back pain','sore throat','rash'])assert.equal(logic.analyze(text).needsSeveritySlider,true,text);
  for(const text of ['I had a good day','no headache or nausea','fever','Coffee'])assert.equal(logic.analyze(text).needsSeveritySlider,false,text);
  assert.equal(logic.analyze('Headache 0/10').severity,null);
});
test('clarification rules are optional, symptom-specific and independently suppressed by CareGuard',()=>{
  assert.equal(logic.analyze('Headache today').followUpQuestions.length,0);
  const repeated=logic.analyze('Recurring nausea');assert.match(repeated.followUpQuestions[0].label,/meals/);
  const combo=logic.analyze('Headache and nausea');assert.ok(combo.followUpQuestions.length);
  assert.equal(combo.followUpQuestions[0].reason,'symptom combination');
  assert.equal(logic.analyze('Headache, nausea and chest pressure').followUpQuestions.length,0);
  const old=[{symptoms:['Headache'],recordedAt:'2020-01-01T00:00:00Z'},{symptoms:['Headache'],recordedAt:'2020-01-02T00:00:00Z'}];
  assert.equal(logic.analyze('Headache',old).followUpQuestions.length,0);
});
test('occasional follow-ups trigger on the second mention and natural recurrence wording',()=>{
  const prior=[{symptoms:['Headache'],recordedAt:new Date().toISOString(),answers:{},dismissed:[]}];
  assert.equal(logic.analyze('I have a headache').followUpQuestions.length,0);
  assert.equal(logic.analyze('I have a headache',prior).followUpQuestions.length,2);
  for(const text of ['I have a headache again','Another headache','I still feel nauseous','Dizziness keeps happening'])assert.ok(logic.analyze(text).followUpQuestions.length,text);
  prior[0].answers={'Headache:location':'Left temple'};prior[0].dismissed=['Headache:duration','Headache:associated'];
  assert.equal(logic.analyze('Headache again',prior).followUpQuestions.length,0);
  assert.equal(logic.analyze('Chest pain again',prior).followUpQuestions.length,0);
});
test('bundled fallback really decodes an independently generated EAN-13 PNG',()=>{
  const png=fs.readFileSync(path.join(__dirname,'fixtures/nutella-ean13.png'));
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);let offset=8;const data=[];
  while(offset<png.length){const size=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')data.push(png.subarray(offset+8,offset+8+size));offset+=size+12;}
  const rows=zlib.inflateSync(Buffer.concat(data)),gray=new Uint8ClampedArray(width*height);
  for(let y=0;y<height;y++){assert.equal(rows[y*(width*3+1)],0);for(let x=0;x<width;x++)gray[y*width+x]=rows[y*(width*3+1)+1+x*3];}
  const z=require('../public/vendor/zxing-0.23.0.min');
  const bitmap=new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(gray,width,height)));
  const hints=new Map([[z.DecodeHintType.POSSIBLE_FORMATS,[z.BarcodeFormat.EAN_13]]]);
  assert.equal(new z.MultiFormatReader().decode(bitmap,hints).getText(),'3017620422003');
});
test('barcode validation, sourced lookup and cache never invent a name',async()=>{
  assert.equal(validBarcode('3017620422003'),true);assert.equal(validBarcode('3017620422004'),false);assert.equal(validBarcode('../secret'),false);
  let calls=0;
  const lookup=createLookup(async(url,options)=>{calls++;assert.match(url,/^https:\/\/world.openfoodfacts.org\/api\/v2\/product\/3017620422003/);assert.match(options.headers['User-Agent'],/CareCard/);return {ok:true,status:200,json:async()=>({status:1,product:{product_name:'Nutella',brands:'Ferrero'}})};});
  assert.equal((await lookup('3017620422003')).name,'Nutella');assert.equal((await lookup('3017620422003')).source,'Open Food Facts');assert.equal(calls,1);
  await assert.rejects(()=>lookup('3017620422004'),e=>e.status===400);
  for(const payload of [{status:0},{status:1,product:{}},{status:1,product:{product_name:'  '}}])await assert.rejects(()=>createLookup(async()=>({ok:true,status:200,json:async()=>payload}))('3017620422003'),e=>e.status===404);
  await assert.rejects(()=>createLookup(async()=>{throw new Error('network timeout');})('3017620422003'),e=>e.status===503);
  await assert.rejects(()=>createLookup(async()=>({ok:false,status:429}))('3017620422003'),e=>e.status===503);
  await assert.rejects(()=>createLookup(async()=>({ok:true,status:200,json:async()=>{throw new Error('bad JSON');}}))('3017620422003'),e=>e.status===503);
});
test('HTTP contracts: conditional rating, stable issued questions, confirmed barcode persistence and lookup failures',async t=>{
  const dir=fs.mkdtempSync(path.join(process.env.CARECARD_TEST_TMP||os.tmpdir(),'carecard-features-'));
  const app=createApp({dataDir:dir,productFetch:async url=>url.includes('2999913370424')?{ok:false,status:404}:{ok:true,status:200,json:async()=>({status:1,product:{product_name:'Nutella'}})}});
  await new Promise(r=>app.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>app.close(r));fs.rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+app.address().port;
  const call=async(route,method='GET',body)=>{const res=await fetch(base+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};};
  assert.equal((await call('/api/analyze','POST',{description:'Nausea'})).body.analysis.needsSeveritySlider,true);
  assert.equal((await call('/api/analyze','POST',{description:'No nausea or headache'})).body.analysis.needsSeveritySlider,false);
  assert.equal((await call('/api/entries','POST',{description:'Headache',severity:0})).status,400);
  assert.equal((await call('/api/entries','POST',{description:'Headache',severity:1})).body.entry.severity,1);
  await call('/api/entries','POST',{description:'Headache',severity:10});
  const pending=(await call('/api/entries','POST',{description:'Headache'})).body.entry;
  assert.equal(pending.followUpQuestions.length,2);
  const other=(await call('/api/entries','POST',{description:'Headache'})).body.entry;
  await call('/api/entries/'+other.id,'PUT',{...other,answers:{'Headache:location':'Left'},dismissed:['Headache:duration']});
  // The earlier entry's issued fields must remain answerable despite changed history.
  assert.equal((await call('/api/entries/'+pending.id,'PUT',{...pending,answers:{'Headache:location':'Right'},dismissed:['Headache:duration']})).status,200);
  const next=(await call('/api/analyze','POST',{description:'Headache'})).body.analysis;
  assert.deepEqual(next.followUpQuestions.map(q=>q.key),['Headache:associated']);
  const urgent=(await call('/api/analyze','POST',{description:'Headache and chest pain'})).body.analysis;
  assert.equal(urgent.safety.level,'emergency');assert.equal(urgent.followUpQuestions.length,0);
  assert.equal((await call('/api/barcode/3017620422003')).body.product.name,'Nutella');
  assert.equal((await call('/api/barcode/2999913370424')).status,404);
  assert.equal((await call('/api/barcode/3017620422004')).status,400);
  const product={name:'Nutella',type:'food',barcode:'3017620422003',confirmed:false};
  assert.equal((await call('/api/entries','POST',{description:'Nutella',product})).status,400);
  product.confirmed=true;const saved=await call('/api/entries','POST',{description:'Nutella',product});assert.equal(saved.status,201);assert.equal(saved.body.entry.product.barcode,product.barcode);
});
