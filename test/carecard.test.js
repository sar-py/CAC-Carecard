const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const logic=require('../public/organizer');
const {createApp}=require('../Server/server');
test('extracts explicit synonyms, multiple symptoms and exact evidence',()=>{
  const text='My head hurts, I feel queasy and dizzy since lunch. Pain is 7/10.';
  const a=logic.analyze(text);assert.deepEqual(a.symptoms,['Headache','Nausea','Dizziness']);assert.equal(a.severity,7);assert.equal(a.onset,'since lunch');
  a.evidence.forEach(e=>assert.equal(text.slice(e.start,e.end),e.quote));
  assert.equal(logic.analyze('My head hurts.').followUpQuestions.length,0);
  assert.equal(a.followUpQuestions.length,2);
});
test('negation, coordinated negatives, contrast and resolved symptoms',()=>{
  assert.deepEqual(logic.analyze('No headache or nausea, but dizzy. Not coughing.').symptoms,['Dizziness']);
  assert.deepEqual(logic.analyze('I have no fever but my head hurts.').symptoms,['Headache']);
  assert.deepEqual(logic.analyze('Headache is gone. No chest pain.').symptoms,[]);
  assert.deepEqual(logic.analyze('No headache. A headache started later.').symptoms,['Headache']);
  assert.equal(logic.safety('No chest pain or difficulty breathing.').level,'routine');
  assert.equal(logic.safety('Not sure why chest pain started.').level,'emergency');
  assert.equal(logic.safety('Not only chest pain but dizziness.').level,'emergency');
});
test('urgent warnings take priority without follow-up questions',()=>{
  for(const text of ["I can't breathe",'chest pressure','slurred speech','throat swelling','bleeding will not stop']) {
    const a=logic.analyze(text);assert.equal(a.safety.level,'emergency',text);assert.equal(a.followUpQuestions.length,0);
  }
});
test('product names do not invent symptoms; product note evidence retains correct offsets',()=>{
  assert.deepEqual(logic.analyze('Headache tablets',[],{name:'Headache tablets'}).symptoms,[]);
  const text='Headache tablets — felt nauseous later';
  const a=logic.analyze(text,[],{name:'Headache tablets'});assert.deepEqual(a.symptoms,['Nausea']);assert.equal(text.slice(a.evidence[0].start,a.evidence[0].end),'nauseous');
});
test('recurring questions adapt to answered and dismissed questions',()=>{
  const prior=Array.from({length:2},()=>({symptoms:['Headache'],recordedAt:new Date().toISOString(),answers:{},dismissed:[]}));
  const a=logic.analyze('headache',prior);assert.equal(a.followUpQuestions.length,2);
  prior[0].answers['Headache:location']='Left';prior[0].dismissed=['Headache:duration'];
  assert.deepEqual(logic.analyze('headache',prior).followUpQuestions.map(q=>q.key),['Headache:associated']);
});
test('temporal patterns require repeated matches and preserve evidence references',()=>{
  const e=[{id:'p1',recordedAt:'2026-01-01T10:00:00Z',product:{name:'Coffee'},symptoms:[]},{id:'s1',recordedAt:'2026-01-01T11:00:00Z',symptoms:['Headache']},{id:'p2',recordedAt:'2026-01-02T10:00:00Z',product:{name:'Coffee'},symptoms:[]},{id:'s2',recordedAt:'2026-01-02T11:00:00Z',symptoms:['Headache']}];
  assert.equal(logic.trends(e.slice(0,2)).associations.length,0);
  const t=logic.trends(e);assert.equal(t.associations[0].count,2);assert.equal(t.associations[0].pairs[0].productEntryId,'p1');
  e[3].recordedAt='2026-01-02T17:00:00Z';assert.equal(logic.trends(e).associations.length,0);
});
test('API end to end: validation, safety, storage restart, edit, image, delete and origin protections',async t=>{
  const scratch=process.env.CARECARD_TEST_TMP || os.tmpdir();
  fs.mkdirSync(scratch,{recursive:true});
  const dir=fs.mkdtempSync(path.join(scratch,'carecard-test-'));let app;
  const start=async()=>{app=createApp({dataDir:dir});await new Promise(r=>app.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+app.address().port;};
  let base=await start();
  t.after(async()=>{await new Promise(r=>app.close(r));fs.rmSync(dir,{recursive:true,force:true});});
  const call=async(route,method='GET',body)=>{const r=await fetch(base+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
  const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/Your Health, Remembered/);assert.ok(home.headers.get('content-security-policy'));
  for(const asset of ['/app.js','/voice.js','/organizer.js','/style.css','/design.css','/motion.js','/scanner.js','/vendor/zxing-0.23.0.min.js'])assert.equal((await fetch(base+asset)).status,200);
  assert.equal((await fetch(base+'/data/entries.json')).status,404);
  assert.equal((await call('/api/entries','POST',{description:''})).status,400);
  assert.equal((await call('/api/entries','POST',{description:'a'.repeat(5001)})).status,400);
  assert.equal((await call('/api/entries','POST',{description:'headache',severity:11})).status,400);
  assert.equal((await call('/api/entries','POST',{description:'headache',recordedAt:'not a date'})).status,400);
  const cross=await fetch(base+'/api/entries',{headers:{Origin:'https://example.org'}});assert.equal(cross.status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=require('node:http').get(base+'/api/entries',{headers:{Host:'attacker.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(hostStatus,403);
  const malformed=await fetch(base+'/api/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);
  const large=await fetch(base+'/api/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:'x'.repeat(750001)})});assert.equal(large.status,413);
  const saved=await call('/api/entries','POST',{description:'Headache and nausea',severity:6});assert.equal(saved.status,201);const id=saved.data.entry.id;
  await new Promise(r=>app.close(r));base=await start();
  const stored=(await call('/api/entries')).data.entries;assert.equal(stored[0].description,'Headache and nausea');assert.equal(stored[0].severity,6);
  const edit=await call('/api/entries/'+id,'PUT',{description:'No headache. Just dizzy.'});assert.deepEqual(edit.data.entry.symptoms,['Dizziness']);assert.equal(edit.data.entry.id,id);assert.equal(edit.data.entry.recordedAt,stored[0].recordedAt);
  const urgent=await call('/api/entries','POST',{description:'Chest pain'});assert.equal(urgent.data.entry.safety.level,'emergency');
  assert.equal((await call('/api/entries','POST',{description:'Tea',product:{name:'Tea',type:'drink',confirmed:false}})).status,400);
  assert.equal((await call('/api/entries','POST',{description:'Tea',image:'data:image/jpeg;base64,aGVsbG8='})).status,400);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  const p=await call('/api/entries','POST',{description:'Tea',product:{name:'Tea',type:'drink',confirmed:true},image});assert.equal(p.status,201);assert.equal(p.data.entry.image,image);
  const pEdit=await call('/api/entries/'+p.data.entry.id,'PUT',{...p.data.entry,product:{name:'Green tea',type:'drink',confirmed:true}});assert.equal(pEdit.data.entry.product.name,'Green tea');assert.equal(pEdit.data.entry.image,image);
  await call('/api/entries','POST',{description:'Headache'});await call('/api/entries','POST',{description:'Headache'});
  const repeat=(await call('/api/entries','POST',{description:'Headache again'})).data.entry;assert.equal(repeat.followUpQuestions.length,2);
  const answered=await call('/api/entries/'+repeat.id,'PUT',{...repeat,answers:{'Headache:location':'Left temple'},dismissed:['Headache:duration']});assert.equal(answered.status,200);
  const next=(await call('/api/analyze','POST',{description:'Headache'})).data.analysis;assert.deepEqual(next.followUpQuestions.map(q=>q.key),['Headache:associated']);
  assert.equal((await call('/api/trends')).status,200);
  assert.equal((await call('/api/entries/'+id,'DELETE',{})).status,200);assert.equal((await call('/api/entries/'+id,'DELETE',{})).status,404);
  assert.equal((await call('/api/entries','DELETE',{})).status,400);await call('/api/entries','DELETE',{confirm:'DELETE ALL'});assert.equal((await call('/api/entries')).data.entries.length,0);
});
