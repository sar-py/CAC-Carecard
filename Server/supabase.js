const failure=(status,message)=>Object.assign(new Error(message),{status});
function createSupabase({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY,fetcher=fetch}={}){
 let role='';try{role=JSON.parse(Buffer.from((key||'').split('.')[1]||'','base64url').toString()).role;}catch{}
 const configured=!!(url&&/^https:\/\/[a-z0-9.-]+\/?$/i.test(url)&&key&&!key.startsWith('sb_secret_')&&role!=='service_role');
 async function call(route,token,options={}){
  if(!configured)throw failure(503,'Cloud sign-in is not configured. Complete the Vercel setup guide.');
  let response;try{response=await fetcher(url.replace(/\/$/,'')+route,{...options,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000)});}catch{throw failure(503,'Could not reach your private journal database. Your change was not saved.');}
  const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw failure(503,'The database returned an unreadable response.');}
  if(!response.ok)throw failure(response.status===401||response.status===403?401:503,response.status===401||response.status===403?'Your session expired. Sign in again.':'Could not access the private journal. Check the database setup; your change was not saved.');return data;
 }
 async function authenticate(token){if(!token)throw failure(401,'Sign in to access your journal.');const user=await call('/auth/v1/user',token);if(!user?.id||!user.email_confirmed_at)throw failure(401,'Verify your email, then sign in.');return user;}
 function store(token,userID){
  const base='/rest/v1/carecard_entries',owner='user_id=eq.'+encodeURIComponent(userID);
  return{
   async all(){const result=[];for(let offset=0;offset<=2000;offset+=500){const rows=await call(base+'?'+owner+'&select=payload&order=recorded_at.desc,id.asc&limit=500&offset='+offset,token);result.push(...rows.map(r=>r.payload));if(rows.length<500)break;}return result;},
   async put(entry,existing=false){const rows=await call(base+(existing?'?'+owner+'&id=eq.'+encodeURIComponent(entry.id):''),token,{method:existing?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(existing?{payload:entry,recorded_at:entry.recordedAt}:{id:entry.id,user_id:userID,payload:entry,recorded_at:entry.recordedAt})});if(!Array.isArray(rows)||rows.length!==1)throw failure(409,'This note changed or was removed. Reload your journal before trying again.');return rows[0].payload;},
   async remove(id){await call(base+'?'+owner+'&id=eq.'+encodeURIComponent(id),token,{method:'DELETE'});},
   async clear(){await call(base+'?'+owner,token,{method:'DELETE'});},
   async aiBudget(){const allowed=await call('/rest/v1/rpc/carecard_take_ai_slot',token,{method:'POST',body:'{}'});if(allowed!==true)throw failure(429,'AI request limit reached. Your note can still be saved with local rules. Try again in a minute.');}
  };
 }
 return{configured,publicConfig:()=>configured?{url,key}:null,authenticate,store};
}
module.exports={createSupabase,failure};
