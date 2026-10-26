const {createSupabase,failure}=require('./supabase');
const {validate}=require('./server'),logic=require('../public/organizer'),{createGemini}=require('./gemini'),{createLookup}=require('./barcode');
function createCloudHandler({database=createSupabase(),ai=createGemini(),lookup=createLookup(fetch),allowedEmails=process.env.ALLOWED_EMAILS||''}={}){
 const allowed=new Set((Array.isArray(allowedEmails)?allowedEmails:allowedEmails.split(',')).map(s=>s.trim().toLowerCase()).filter(Boolean));
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
  try{
   const parsed=new URL(req.url,'http://localhost');const route=req.query?.route||parsed.searchParams.get('route')||parsed.pathname.replace(/^\/api\/?/,'');
   if(route==='config'&&req.method==='GET')return json(200,{cloud:true,configured:database.configured&&allowed.size>0,supabase:database.publicConfig()});
   if(!database.configured||!allowed.size)throw failure(503,'Cloud setup is incomplete. Configure Supabase and ALLOWED_EMAILS in Vercel.');
   const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)throw failure(403,'Cross-origin access is blocked.');
   const token=(req.headers.authorization||'').match(/^Bearer ([^\s]+)$/)?.[1];const user=await database.authenticate(token);if(!allowed.has(user.email?.toLowerCase()))throw failure(403,'This account is not invited to this CareCard app.');
   const store=database.store(token,user.id);let body=req.body;
   if(['POST','PUT','DELETE'].includes(req.method)){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')throw failure(415,'Use application/json.');
    if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>750000)throw failure(413,'Request too large.');}try{body=JSON.parse(raw||'{}');}catch{throw failure(400,'Invalid JSON.');}}
    else if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw failure(400,'Invalid JSON.');}}
    if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>750000)throw failure(400,'Invalid entry object.');
   }
   if(route==='health'&&req.method==='GET')return json(200,{ok:true,cloud:true,ai:{configured:ai.configured,provider:'Gemini',model:ai.model}});
   const barcode=route.match(/^barcode\/(\d+)$/);if(barcode&&req.method==='GET')return json(200,{product:await lookup(barcode[1])});
   const history=async()=>store.all();
   if(route==='entries'&&req.method==='GET')return json(200,{entries:await history()});
   if(route==='trends'&&req.method==='GET')return json(200,{trends:logic.trends(await history())});
   if(route==='entries'&&req.method==='DELETE'){if(body.confirm!=='DELETE ALL')throw failure(400,'Deletion confirmation is required.');await store.clear();return json(200,{success:true});}
   if(route==='analyze'&&req.method==='POST'){
    if(typeof body.description!=='string'||!body.description.trim()||body.description.length>5000)throw failure(400,'Enter a note between 1 and 5,000 characters.');const entries=await history(),previous=entries.find(e=>e.id===body.excludeId),context=entries.filter(e=>e.id!==body.excludeId);
    if(body.useAI===true){if(logic.safety(body.description).level!=='emergency')await store.aiBudget();return json(200,{analysis:await ai.analyze(body.description,context,previous?.product)});}return json(200,{analysis:logic.analyze(body.description,context,previous?.product)});
   }
   if(route==='ai/summary'&&req.method==='POST'){
    if(body.consent!==true||!Array.isArray(body.entryIds)||body.entryIds.length>100)throw failure(400,'Choose up to 100 notes.');const entries=(await history()).filter(e=>body.entryIds.includes(e.id));if(!entries.length)throw failure(400,'Save a note first.');await store.aiBudget();return json(200,{summary:await ai.summary(entries)});
   }
   if(route==='ai/scan'&&req.method==='POST'){
    if(body.consent!==true||!body.image)throw failure(400,'Choose a photo to send to Gemini.');validate({description:'Image validation',image:body.image},[]);await store.aiBudget();return json(200,{product:await ai.scan(body.image)});
   }
   const match=route.match(/^entries\/([\w-]+)$/);if(route==='entries'&&req.method==='POST'||match&&['PUT','DELETE'].includes(req.method)){
    const entries=await history(),previous=match?entries.find(e=>e.id===match[1]):null;if(match&&!previous)throw failure(404,'Entry not found.');if(req.method==='DELETE'){await store.remove(previous.id);return json(200,{success:true});}if(!previous&&entries.length>=2000)throw failure(400,'Journal limit reached. Export and remove notes to continue.');
    const context=entries.filter(e=>e.id!==previous?.id),entry=validate(body,context,previous);
    if(body.useAI!==false&&ai.configured){try{if(entry.safety.level!=='emergency')await store.aiBudget();const analysis=await ai.analyze(entry.description,context,entry.product);Object.assign(entry,analysis,{severity:analysis.needsSeveritySlider?(body.severity??analysis.severity):analysis.severity});}catch(e){entry.aiStatus='unavailable';entry.aiError=e.message;}}
    else if(previous?.analysisSource==='gemini'&&previous.description===entry.description){for(const key of ['symptoms','evidence','onset','needsSeveritySlider','followUpQuestions','analysisSource','aiStatus'])entry[key]=previous[key];if(entry.safety.level!=='emergency')entry.safety=previous.safety;}
    return json(previous?200:201,{entry:await store.put(entry,!!previous)});
   }
   throw failure(404,'API route not found.');
  }catch(e){json(e.status||500,{error:e.status?e.message:'Could not access your journal. Your change was not saved.'});}
 };
}
module.exports={createCloudHandler};
