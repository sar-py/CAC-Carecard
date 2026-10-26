/* Native Web Animations: actual damped-spring samples, no animation dependency. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const feedback=document.getElementById('hapticFeedback');
  try {feedback.checked=localStorage.getItem('carecard-haptics')==='yes';}catch{}
  if(!('vibrate' in navigator)){feedback.disabled=true;document.getElementById('hapticSupport').textContent='Vibration is unavailable in this browser. Visual feedback is still enabled.';}
  feedback.addEventListener('change',()=>{try{localStorage.setItem('carecard-haptics',feedback.checked?'yes':'no');}catch{}});
  const vibrate=pattern=>{if(feedback.checked&&!reduced.matches&&navigator.vibrate)try{navigator.vibrate(pattern);}catch{}};
  document.getElementById('quickPrivacy').addEventListener('click',()=>document.getElementById('privacyDialog').showModal());
  const paths = {
    journal:'M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v18M12 8h4m-4 5h4',
    timeline:'M12 3a9 9 0 1 1-8.2 5.3M3 3v5h5m4-1v5l3 2',
    scan:'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M7 12h10m-8-4v8m6-8v8',
    summary:'M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Zm2 5h6m-6 5h6m-6 4h4',
    heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    brand:'M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v18m4-13h4m-4 4h3',
    sun:'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0-5v1m0 18v1M2 12h1m18 0h1M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1'
  };
  function icon(name) {return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"></path></svg>`;}
  document.querySelectorAll('nav [data-page]').forEach(button=>{button.querySelector('span').innerHTML=icon(button.dataset.page==='scan'?'scan':button.dataset.page);});
  document.querySelector('.brandmark').innerHTML=icon('brand');
  document.querySelector('.stat-icon').innerHTML=icon('timeline');
  document.querySelector('.guard-icon').innerHTML=icon('heart');
  document.querySelectorAll('.sun').forEach(el=>el.innerHTML=icon(el.closest('#page-scan')?'scan':'sun'));
  function spring(stiffness,damping,start,end,transform) {
    const frequency=Math.sqrt(stiffness),ratio=damping/(2*frequency),omega=frequency*Math.sqrt(1-ratio*ratio);
    return Array.from({length:61},(_,i)=>{
      const t=i/60,decay=Math.exp(-ratio*frequency*t);
      const progress=1-decay*(Math.cos(omega*t)+(ratio*frequency/omega)*Math.sin(omega*t));
      return {transform:transform(start+(end-start)*progress),offset:i/60};
    });
  }
  document.addEventListener('pointerdown',event=>{
    const button=event.target.closest('button');
    if(!button||button.disabled||reduced.matches||button.closest('.alert,.danger'))return;
    vibrate(8);
    button.getAnimations().forEach(a=>a.cancel());
    button.animate(spring(400,18,button.classList.contains('primary')?.85:.94,1,value=>`scale(${value})`),{duration:650,easing:'linear'});
  });
  function enter(element) {
    if(reduced.matches||!element.animate)return;
    element.animate(spring(300,22,20,0,value=>`translateY(${value}px)`),{duration:650,easing:'linear'});
    element.animate([{opacity:0},{opacity:1}],{duration:200});
  }
  new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.target.matches('dialog[open],.page:not([hidden])'))enter(m.target);
      if(m.target.id==='toast'&&!m.target.hidden)enter(m.target);
    }
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open']});
  const welcome=document.getElementById('welcomeCard');
  try {welcome.hidden=localStorage.getItem('carecard-welcome-dismissed')==='yes';}catch {welcome.hidden=false;}
  document.getElementById('getStarted').addEventListener('click',()=>{
    welcome.hidden=true;try{localStorage.setItem('carecard-welcome-dismissed','yes');}catch{}
    document.querySelector('nav [data-page="journal"]').click();
    document.getElementById('symptomInput').focus();
  });
  if(!welcome.hidden)enter(welcome);
  const celebrated=new Set();
  document.addEventListener('carecard:saved',event=>{
    vibrate([12,45,12]);
    const count=event.detail.count;
    if(reduced.matches||![1,5,10,25,50,100].includes(count)||celebrated.has(count)||document.querySelector('dialog[open]'))return;
    celebrated.add(count);
    const canvas=document.createElement('div');canvas.className='celebration';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
    for(let i=0;i<18;i++){
      const particle=document.createElement('span');particle.className='celebration-particle';canvas.append(particle);
      const angle=2*Math.PI*i/18,distance=80+(i%4)*30;
      particle.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance-45}px) rotate(${i*47}deg)`,opacity:0}],{duration:850+(i%3)*80,easing:'cubic-bezier(.16,.7,.3,1)',fill:'forwards'});
    }
    setTimeout(()=>canvas.remove(),1200);
  });
  document.addEventListener('carecard:error',()=>{
    vibrate(25);if(reduced.matches)return;
    const target=document.getElementById('toast');target.classList.remove('error-feedback');void target.offsetWidth;target.classList.add('error-feedback');
  });
})();
