(()=>{
 if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
 let installEvent;const button=document.getElementById('installApp');button.addEventListener('click',async()=>{if(installEvent){await installEvent.prompt();installEvent=null;button.hidden=true;}else document.getElementById('installHelp').hidden=!document.getElementById('installHelp').hidden;});
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;button.textContent='Install CareCard';});
 if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)button.hidden=true;
 const offline=()=>{document.getElementById('offlineNotice').hidden=navigator.onLine;};window.addEventListener('online',offline);window.addEventListener('offline',offline);offline();
})();
