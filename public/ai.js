/* Gemini runs on save; local urgent checks never wait for the provider. */
(()=>{
 let configured=false;const cache=new Map(),pending=new Set();
 const status=document.createElement('p');status.id='aiStatus';status.className='fine';status.setAttribute('role','status');status.textContent='Checking Gemini connection…';$('saveNote').parentElement.before(status);
 const disclosure=document.createElement('p');disclosure.className='fine';disclosure.textContent='When configured, Gemini checks saved notes and prepares your summary automatically. Note text and recent symptom context are sent to Google. Check AI suggestions against your original words.';status.after(disclosure);
 const banner=$('liveSafety');$('main').insertBefore(banner,document.querySelector('.topbar').nextSibling);banner.classList.add('careguard-banner');
 function showSafety(safety){if(safety.level==='routine')return;banner.hidden=false;banner.innerHTML=safety.level==='emergency'?safetyHTML(safety):'<strong>CareGuard · Check in with a professional</strong>'+escapeHTML(safety.message);}
 $('productNotes').addEventListener('input',()=>{const safety=CareLogic.safety($('productNotes').value);banner.hidden=safety.level==='routine';showSafety(safety);});
 const rating=document.createElement('section');rating.id='savedSeverity';rating.className='card';rating.hidden=true;$('noteForm').closest('section').after(rating);
 function saved(entry){
  showSafety(entry.safety);rating.hidden=true;
  if(!entry.needsSeveritySlider||entry.severity!=null||entry.safety.level==='emergency')return;
  rating.innerHTML='<h2>Add a rating?</h2><p>Your note is saved. You can add symptom severity, or leave it blank.</p><label class="field" for="savedSeveritySlider">Severity <output id="savedSeverityValue">5 / 10</output><input id="savedSeveritySlider" type="range" min="1" max="10" value="5"></label><button type="button" class="secondary" id="saveSeverity">Add rating</button> <button type="button" class="link" id="skipSeverity">Skip</button>';rating.hidden=false;
  $('savedSeveritySlider').addEventListener('input',()=>{$('savedSeverityValue').textContent=$('savedSeveritySlider').value+' / 10';});
  $('skipSeverity').addEventListener('click',()=>rating.hidden=true);
  $('saveSeverity').addEventListener('click',async()=>{const button=$('saveSeverity');button.disabled=true;try{const current=state.entries.find(e=>e.id===entry.id);if(!current){rating.hidden=true;return;}await api('entries/'+entry.id,'PUT',{...current,severity:Number($('savedSeveritySlider').value),useAI:false});rating.hidden=true;await reload();toast('Rating added.');}catch(e){showError(e);}finally{button.disabled=false;}});
 }
 function selected(){const from=$('summaryFrom').value,to=$('summaryTo').value;if(from&&to&&from>to)return[];return state.entries.filter(e=>{const day=localTime(e.recordedAt).slice(0,10);return(!from||day>=from)&&(!to||day<=to);});}
 function key(entries){return JSON.stringify(entries.map(e=>[e.id,e.updatedAt]));}
 function paint(result,entries){if(!$('summaryParagraph'))return;$('summaryParagraph').textContent=result.paragraph;$('summaryOrigin').textContent='Gemini draft. Check against the original notes. Supporting notes: '+result.entryIds.map(id=>'['+([...entries].reverse().findIndex(e=>e.id===id)+1)+']').join(' ');}
 async function summary(){
  if(!configured)return;const entries=selected(),signature=key(entries);if(!entries.length)return;
  if(entries.length>100){$('summaryOrigin').textContent='Local summary. Select up to 100 notes for an automatic Gemini paragraph.';return;}
  if(cache.has(signature)){const cached=cache.get(signature);if(cached.error)$('summaryOrigin').textContent=cached.error;else paint(cached,entries);return;}
  if($('summaryOrigin'))$('summaryOrigin').textContent='Preparing your Gemini paragraph… Your recorded notes remain available below.';
  if(pending.has(signature))return;pending.add(signature);
  try{const {summary:result}=await api('ai/summary','POST',{consent:true,entryIds:entries.map(e=>e.id)});cache.set(signature,result);if(key(selected())===signature)paint(result,entries);}
  catch(e){const error='Rule-based summary shown. '+e.message;cache.set(signature,{error});if(key(selected())===signature&&$('summaryOrigin'))$('summaryOrigin').textContent=error;}
  finally{pending.delete(signature);}
 }
 window.CareAI={saved,summary};
 api('health').then(data=>{configured=!!data.ai?.configured;status.textContent=configured?'Gemini checks your note automatically when you save.':(data.cloud?'Gemini is not configured. Notes save to your account with rule-based analysis.':'Gemini is not configured. Notes and urgent CareGuard checks still work locally.');summary();}).catch(showError);
 const scan=document.createElement('button');scan.type='button';scan.className='secondary';scan.textContent='Read label with Gemini';scan.id='geminiLabel';$('scanPreview').after(scan);
 const scanDisclosure=document.createElement('p');scanDisclosure.className='fine';scanDisclosure.textContent='Sends this photo to Google to read visible product-label text. Confirm the name and category before saving. It cannot identify symptoms or pills.';scan.after(scanDisclosure);
 scan.addEventListener('click',async()=>{if(!state.scanImage)return toast('Choose a product-label photo first.');const image=state.scanImage;CareScan.reset();scan.disabled=true;scan.textContent='Reading label…';$('barcodeStatus').textContent='Reading the selected label photo with Gemini…';try{const {product}=await api('ai/scan','POST',{consent:true,image});if(state.scanImage!==image)return;$('productName').value=product.name;$('productConfirm').checked=false;$('barcodeStatus').textContent='Gemini label suggestion: '+product.labelText+' Check the name and category, then confirm before saving.';}catch(e){$('barcodeStatus').textContent=e.message+' Manual entry is available.';}finally{scan.disabled=false;scan.textContent='Read label with Gemini';}});
})();
