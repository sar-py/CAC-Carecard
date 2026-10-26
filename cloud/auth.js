import {createClient} from '@supabase/supabase-js';
(function(){
 let client=null,cloud=false,gate=document.getElementById('authGate'),session=null;
 function message(text){const node=document.getElementById('authMessage');if(node)node.textContent=text;}
 function lock(text){document.body.classList.add('auth-locked');if(gate)gate.hidden=false;if(text)message(text);}
 function unlock(){document.body.classList.remove('auth-locked');if(gate)gate.hidden=true;}
 function setAccount(email){document.getElementById('accountEmail').textContent=email||'';document.getElementById('accountControls').hidden=false;}
 const ready=(async()=>{
  let config;try{const r=await fetch('/api/config',{cache:'no-store'});if(r.status===404){unlock();return;}if(!r.ok)throw Error();config=await r.json();}catch{if(location.hostname==='localhost'||location.hostname==='127.0.0.1'){unlock();return;}lock('Could not connect. Check your internet connection and reload.');throw Error('Could not load cloud sign-in.');}
  if(!config.cloud){unlock();return;}cloud=true;
  gate=document.getElementById('authGate');lock();
  const sidebar=document.querySelector('.sidebar-bottom');sidebar.querySelector('strong').textContent='Private to your account.';sidebar.querySelector('p').textContent='Synced securely across your devices.';
  document.querySelector('#privacyDialog p').textContent='Your hosted journal and attached photos are stored in your Supabase database under your signed-in account. Access is restricted by account ownership. Exports are separate copies. Sign out on shared devices.';
  if(!config.configured||!config.supabase){message('The owner needs to finish the Supabase and Vercel setup. Your journal is locked until then.');document.getElementById('authSubmit').disabled=true;return;}
  client=createClient(config.supabase.url,config.supabase.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
  const callback=new URL(location.href);const tokenHash=callback.searchParams.get('token_hash');
  if(tokenHash){callback.searchParams.delete('token_hash');callback.searchParams.delete('type');history.replaceState(null,'',callback.pathname+callback.search+callback.hash);const verified=await client.auth.verifyOtp({token_hash:tokenHash,type:'email'});if(verified.error)message('That link expired or was already used. Request a fresh sign-in link.');}
  const {data,error}=await client.auth.getSession();if(error){message('Could not restore your session. Please sign in again.');}session=data?.session||null;
  if(session){setAccount(session.user.email);unlock();}
  client.auth.onAuthStateChange((event,next)=>{session=next;if(event==='SIGNED_OUT'){lock('You are signed out.');document.getElementById('accountControls').hidden=true;location.reload();}else if(event==='SIGNED_IN'&&document.body.classList.contains('auth-locked')){location.reload();}});
  const form=document.getElementById('authForm');form.addEventListener('submit',async event=>{event.preventDefault();const button=document.getElementById('authSubmit');button.disabled=true;message('Sending your sign-in link…');try{const email=document.getElementById('authEmail').value.trim();const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/',shouldCreateUser:true}});if(error)throw error;message('Check your email. Open the sign-in link to continue.');}catch{message('Could not send the link. Check the email address or try again later. The owner may need to configure email delivery.');}finally{button.disabled=false;}});
  document.getElementById('signOut').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)message('Could not sign out. Try again.');});
 })();
 // Keep an early rejection from becoming an unhandled promise before app.js calls headers.
 ready.catch(()=>{});
 window.CareAuth={async headers(){await ready;if(!cloud)return{};if(!client)throw Error('Cloud sign-in setup is incomplete.');const {data,error}=await client.auth.getSession();if(error||!data.session){lock('Sign in to open your private journal.');throw Error('Sign in to access your journal.');}return{Authorization:'Bearer '+data.session.access_token};},get cloud(){return cloud;},unauthorized(){if(cloud)lock('Your session expired or your account is not invited. Sign in with an invited email.');},ready};
})();
