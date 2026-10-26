'use strict';
const $ = id => document.getElementById(id);
const state = {entries:[],editing:null,noteImage:null,scanImage:null,questionEntry:null,ready:false};
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const localTime = value => {const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
function toast(message) { $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5000); }
async function api(route,method='GET',body) {
  const authHeaders=await (window.CareAuth?.headers()||{});
  const response=await fetch('/api/'+route,{method,headers:{...authHeaders,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if(response.status===401||response.status===403)window.CareAuth?.unauthorized();
  const data=await response.json();if(!response.ok) throw new Error(data.error||'Request failed.');return data;
}
function showError(error) {toast(error.message || 'Connection failed. Check your connection and sign-in.');document.dispatchEvent(new CustomEvent('carecard:error'));}
function page(name) {
  if(!['journal','timeline','scan','summary'].includes(name)) name='journal';
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!=='page-'+name);
  document.querySelectorAll('nav button').forEach(el=>{el.classList.toggle('active',el.dataset.page===name);if(el.dataset.page===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(location.hash!=='#'+name) history.replaceState(null,'','#'+name);
  if(name==='summary') renderSummary();
}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{page(button.dataset.page);window.scrollTo({top:0});}));
window.addEventListener('hashchange',()=>{if(['journal','timeline','scan','summary'].includes(location.hash.slice(1)))page(location.hash.slice(1));});
document.addEventListener('click',event=>{const link=event.target.closest('a[data-summary-ref]');if(link){event.preventDefault();$('source-'+link.dataset.summaryRef)?.scrollIntoView({block:'center'});}});
$('today').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
function safetyHTML(safety) {return `<strong>CareGuard · Please act now</strong>${escapeHTML(safety.message)}<p class="fine"><a href="https://www.cdc.gov/stroke/signs-symptoms/" target="_blank" rel="noreferrer">Stroke warning signs · CDC</a> · <a href="https://www.nhs.uk/symptoms/chest-pain/" target="_blank" rel="noreferrer">Chest pain · NHS</a> · <a href="https://www.nhs.uk/symptoms/shortness-of-breath/" target="_blank" rel="noreferrer">Breathing difficulty · NHS</a></p>`;}
let analysisVersion=0,analysisTimer;
function renderNoteAnalysis(analysis) {
  $('severitySection').hidden=!analysis.needsSeveritySlider;
  if(!analysis.needsSeveritySlider)$('includeSeverity').checked=false;
  if(analysis.severity>=1&&!$('includeSeverity').checked){$('severitySlider').value=analysis.severity;$('severityValue').textContent=analysis.severity+' / 10';}
  $('analysisStatus').textContent=analysis.symptoms.length?'Recognized: '+analysis.symptoms.join(' · '):'';
}
function updateInput() {
  const text=$('symptomInput').value;
  $('charCount').textContent=text.length.toLocaleString()+' / 5,000';
  const analysis=CareLogic.analyze(text,state.entries.filter(e=>e.id!==state.editing),state.entries.find(e=>e.id===state.editing)?.product);
  renderNoteAnalysis(analysis);
  $('liveSafety').hidden=analysis.safety.level!=='emergency';
  $('liveSafety').innerHTML=analysis.safety.level==='emergency'?safetyHTML(analysis.safety):'';
  if(analysis.safety.level==='emergency')$('optionalFollowUp').hidden=true;
  const version=++analysisVersion,editing=state.editing;
  clearTimeout(analysisTimer);
  if(text.trim())analysisTimer=setTimeout(async()=>{
    try{const data=await api('analyze','POST',{description:text,excludeId:editing});if(version===analysisVersion)renderNoteAnalysis(data.analysis);}
    catch{if(version===analysisVersion)$('analysisStatus').textContent+=' · Local preview; server analysis will run when you save.';}
  },250);
}
$('symptomInput').addEventListener('input',updateInput);
$('severitySlider').addEventListener('input',()=>{$('severityValue').textContent=$('severitySlider').value+' / 10';$('includeSeverity').checked=true;});
async function reload() {
  const data=await api('entries');state.entries=data.entries;state.ready=true;
  $('connectionError').hidden=true;render();
}
function entryHTML(e) {
  const tags=e.symptoms.map(s=>`<button type="button" class="tag evidence" data-evidence="${e.id}" data-symptom="${escapeHTML(s)}" title="See the original words">${escapeHTML(s)} ↗</button>`).join('');
  return `<article class="card entry" id="entry-${e.id}"><div class="entry-head"><time datetime="${e.recordedAt}">${escapeHTML(date(e.recordedAt))}</time><span>${e.product?escapeHTML(e.product.type):'Health note'}${e.image?' · Photo attached':''}</span></div><p class="note">${escapeHTML(e.description)}</p><div class="tags">${tags}${e.product?`<span class="tag">${escapeHTML(e.product.name)}</span>`:''}${e.severity!=null?`<span class="tag">Severity ${e.severity}/10</span>`:''}${e.safety.level==='emergency'?'<span class="tag warning">CareGuard warning recorded</span>':''}</div><div class="entry-actions">${pendingQuestions(e).length?`<button class="link" data-questions="${e.id}">Optional questions</button>`:''}<button class="link" data-evidence="${e.id}">Original note ↗</button><button class="link" data-edit="${e.id}">Edit</button><button class="link" data-delete="${e.id}">Delete</button></div></article>`;
}
const emptyHTML=(title,text)=>`<div class="empty"><div class="empty-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M8 4h16a3 3 0 0 1 3 3v22H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm2 0v25m5-17h7m-7 6h5"/></svg></div><h3>${title}</h3><p>${text}</p></div>`;
function render() {
  $('entryCount').textContent=state.entries.length;
  const symptoms=[...new Set(state.entries.flatMap(e=>e.symptoms))].sort();
  $('symptomCount').textContent=symptoms.length;
  $('dayCount').textContent=new Set(state.entries.map(e=>new Date(e.recordedAt).toLocaleDateString())).size;
  $('recentEntries').innerHTML=state.entries.length?state.entries.slice(0,3).map(entryHTML).join(''):emptyHTML('Nothing here. Yet.','Your first note goes right here. Start with whatever you noticed today.');
  const selected=$('symptomFilter').value;
  $('symptomFilter').innerHTML='<option value="">All symptoms</option>'+symptoms.map(s=>`<option>${escapeHTML(s)}</option>`).join('');
  if(symptoms.includes(selected)) $('symptomFilter').value=selected;
  renderTimeline();renderPatterns();renderSummary();
}
function renderTimeline() {
  const query=$('searchInput').value.toLowerCase();
  let entries=state.entries.filter(e=>(e.description.toLowerCase().includes(query)||e.product?.name.toLowerCase().includes(query)) && (!$('symptomFilter').value || e.symptoms.includes($('symptomFilter').value)) && (!$('typeFilter').value || ($('typeFilter').value==='product'?e.product:!e.product)));
  if($('sortOrder').value==='oldest') entries=[...entries].reverse();
  $('timelineCount').textContent=entries.length+' of '+state.entries.length+' moments';
  $('timelineEntries').innerHTML=entries.length?entries.map(entryHTML).join(''):emptyHTML('No moments to show',state.entries.length?'Try a different search or filter.':'Save a health note or product to begin your timeline.');
}
for(const id of ['searchInput','symptomFilter','typeFilter','sortOrder']) $(id).addEventListener('input',renderTimeline);
function renderPatterns() {
  const trends=CareLogic.trends(state.entries);
  const recurring=trends.recurring.filter(t=>t.count>=2).slice(0,4);
  $('patternList').innerHTML=recurring.length?recurring.map(t=>`<div class="pattern"><div class="pattern-line"><span>${escapeHTML(t.symptom)}</span><strong>${t.count} entries</strong></div><div class="bar"><span></span></div></div>`).join(''):'<p class="fine">We’ll put repeated symptoms here once there’s something to notice. No homework for now.</p>';
  // Widths use the DOM property rather than inline HTML to respect the app CSP.
  $('patternList').querySelectorAll('.bar span').forEach((el,i)=>el.style.width=Math.max(8,recurring[i].count/Math.max(state.entries.length,1)*100)+'%');
  $('patternList').insertAdjacentHTML('beforeend',trends.associations.slice(0,3).map(t=>`<p class="fine"><strong>${escapeHTML(t.symptom)}</strong> was recorded within 6 hours after <strong>${escapeHTML(t.product)}</strong> in ${t.count} symptom entries. Timing is not proof of a cause.</p>`).join(''));
}
function renderSummary() {
  const from=$('summaryFrom').value,to=$('summaryTo').value;
  if(from&&to&&from>to) {$('summaryReport').innerHTML='<p role="alert">The start date must be before the end date.</p>';return;}
  const entries=[...state.entries].reverse().filter(e=>{const day=localTime(e.recordedAt).slice(0,10);return (!from||day>=from)&&(!to||day<=to);});
  const refs=new Map(entries.map((e,i)=>[e.id,i+1]));
  const ref = id => `<a href="#source-${id}" data-summary-ref="${id}">[${refs.get(id)}]</a>`;
  const trends=CareLogic.trends(entries);
  const rows=trends.recurring.map(t=>`<tr><td>${escapeHTML(t.symptom)}</td><td>${t.count}</td><td>${t.entryIds.map(ref).join(' ')}</td></tr>`).join('');
  const products=entries.filter(e=>e.product);
  const questions=entries.flatMap(e=>Object.entries(e.answers||{}).map(([key,answer])=>`<li>${escapeHTML(key.replace(':',' · '))}: ${escapeHTML(answer)} ${ref(e.id)}</li>`));
  $('summaryReport').innerHTML=`<p class="eyebrow">CARECARD / APPOINTMENT NOTES</p><h2>Your health, remembered.</h2><p>Prepared ${escapeHTML(date(new Date()))} · ${entries.length} entries<br>Period: ${escapeHTML(from||'First entry')} through ${escapeHTML(to||'Latest entry')} · Times shown in ${escapeHTML(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p><p class="fine">Patient-reported notes organized with local rules and optional Gemini assistance. This report is not a diagnosis, clinical assessment, or a complete medical record. Extraction can miss or misread wording; verify against the original notes below.</p>${!entries.length?'<p>No entries in this period.</p>':''}<section class="summary-overview"><h3>At a glance</h3><p id="summaryParagraph">${escapeHTML(CareLogic.summarize(entries))}</p><p id="summaryOrigin" class="fine">From your recorded notes.</p></section><h3>Symptoms & original-note references</h3>${rows?`<table><thead><tr><th>Symptom</th><th>Entries</th><th>EvidenceLink</th></tr></thead><tbody>${rows}</tbody></table>`:'<p>No recognized symptoms in this period.</p>'}<h3>Recurring observations & timing</h3><ul>${trends.recurring.filter(t=>t.count>=2).map(t=>`<li>${escapeHTML(t.symptom)} appears in ${t.count} notes. ${t.entryIds.map(ref).join(' ')}</li>`).join('')||'<li>No recurring symptoms yet.</li>'}${trends.associations.map(t=>`<li>${escapeHTML(t.symptom)} recorded within 6 hours after ${escapeHTML(t.product)} in ${t.count} symptom entries. ${t.pairs.map(p=>ref(p.productEntryId)+' → '+ref(p.entryId)).join('; ')}. Timing does not establish causation; this method does not compare exposure-free periods.</li>`).join('')}</ul><h3>Products & activities</h3>${products.length?`<ul>${products.map(e=>`<li>${escapeHTML(date(e.recordedAt))} · ${escapeHTML(e.product.type)} · ${escapeHTML(e.product.name)} ${ref(e.id)}</li>`).join('')}</ul>`:'<p>No products or activities recorded.</p>'}<h3>Additional context & questions for your appointment</h3>${questions.length?'<ul>'+questions.join('')+'</ul>':''}<ul><li>Which of these recurring observations should we discuss?</li><li>What details would be useful for me to track?</li></ul><h3>Original notes</h3>${entries.map((e,i)=>`<blockquote id="source-${e.id}"><strong>[${i+1}] ${escapeHTML(date(e.recordedAt))}</strong><p class="original">${escapeHTML(e.description)}</p>${e.severity!=null?`<p>Reported severity: ${e.severity}/10</p>`:''}${e.onset?`<p>Onset wording: ${escapeHTML(e.onset)}</p>`:''}${e.safety.level==='emergency'?'<p>CareGuard: predefined emergency warning sign recorded; warning was shown.</p>':''}${e.image?'<p>Photo attached to original entry (view in journal).</p>':''}</blockquote>`).join('')}`;
}
const originalRenderSummary=renderSummary;renderSummary=function(){originalRenderSummary();window.CareAI?.summary();};
for(const id of ['summaryFrom','summaryTo']) $(id).addEventListener('change',renderSummary);
$('printSummary').addEventListener('click',()=>{if($('summaryFrom').value&&$('summaryTo').value&&$('summaryFrom').value>$('summaryTo').value)return toast('Choose a valid date range.');window.print();});
function resetNote() {
  state.editing=null;state.noteImage=null;$('noteForm').reset();$('severityValue').textContent='5 / 10';$('saveNote').innerHTML='Save note ↗';$('noteImagePreview').innerHTML='';$('removeNoteImage').hidden=true;updateInput();
  document.querySelector('#noteForm .cancel-edit')?.remove();
  $('editProductFields')?.remove();
}
$('noteForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!state.ready) return toast('The journal is not connected. Restart the server and reload.');
  const button=$('saveNote');button.disabled=true;button.textContent='Saving…';
  try {
    const previous=state.entries.find(e=>e.id===state.editing);
    const product=previous?.product?{...previous.product,name:$('editProductName').value.trim(),type:$('editProductType').value,confirmed:true}:null;
    const body={description:$('symptomInput').value,recordedAt:$('noteTime').value?new Date($('noteTime').value).toISOString():undefined,severity:$('includeSeverity').checked?Number($('severitySlider').value):null,image:state.noteImage,product,answers:previous?.answers||{},dismissed:previous?.dismissed||[]};
    const {entry}=await api('entries'+(state.editing?'/'+state.editing:''),state.editing?'PUT':'POST',body);
    resetNote();await reload();window.CareAI?.saved(entry);toast(entry.aiStatus==='used'?'Saved with Gemini.':entry.aiStatus==='unavailable'?(window.CareAuth?.cloud?'Saved to your account. ':'Saved locally. ')+entry.aiError:entry.aiStatus==='skipped_urgent'?'Saved. CareGuard warning shown immediately.':'Your note is saved.');
    if(entry.safety.level==='emergency') showEvidence(entry.id);
    else {document.dispatchEvent(new CustomEvent('carecard:saved',{detail:{count:state.entries.length}}));if(entry.followUpQuestions.length) offerQuestions(entry,!previous);}
  } catch(error) {showError(error);} finally {button.disabled=false;button.textContent=state.editing?'Save changes ↗':'Save note ↗';}
});
function showEvidence(id,symptom) {
  const e=state.entries.find(e=>e.id===id);if(!e) return;
  const evidence=e.evidence.find(o=>o.name===symptom);
  const text=evidence?escapeHTML(e.description.slice(0,evidence.start))+'<mark>'+escapeHTML(e.description.slice(evidence.start,evidence.end))+'</mark>'+escapeHTML(e.description.slice(evidence.end)):escapeHTML(e.description);
  $('entryDialogTitle').textContent=symptom?'EvidenceLink · '+symptom:'Original note';
  $('entryDetail').innerHTML=`${e.safety.level==='emergency'?`<div class="alert danger" role="alert">${safetyHTML(e.safety)}</div>`:''}<p>${escapeHTML(date(e.recordedAt))}</p><div class="original-text">${text}</div><p class="fine">Entry reference: ${e.id}. Tags are extracted from this text using rules, not a clinical assessment.</p>${e.image?`<img class="preview" src="${e.image}" alt="Photo attached to this journal entry">`:''}${Object.keys(e.answers).length?'<h3>Additional context</h3><ul>'+Object.entries(e.answers).map(([key,value])=>`<li>${escapeHTML(key.replace(':',' · '))}: ${escapeHTML(value)}</li>`).join('')+'</ul>':''}`;
  $('entryDialog').showModal();
}
function editEntry(id) {
  const e=state.entries.find(e=>e.id===id);resetNote();state.editing=id;state.noteImage=e.image;
  const rating=e.severity>=1?e.severity:5;
  $('symptomInput').value=e.description;$('noteTime').value=localTime(e.recordedAt);$('includeSeverity').checked=e.severity>=1;$('severitySlider').value=rating;$('severityValue').textContent=rating+' / 10';$('saveNote').textContent='Save changes ↗';
  if(e.image){$('noteImagePreview').innerHTML=`<img src="${e.image}" class="preview" alt="Current attached photo">`;$('removeNoteImage').hidden=false;}
  if(e.product){const fields=document.createElement('div');fields.id='editProductFields';fields.innerHTML=`<label class="field">Confirmed product or activity name<input id="editProductName" required maxlength="120" value="${escapeHTML(e.product.name)}"></label><label class="field">Category<select id="editProductType">${['food','drink','medication','activity','other'].map(t=>`<option value="${t}" ${t===e.product.type?'selected':''}>${t}</option>`).join('')}</select></label>`;$('symptomInput').after(fields);}
  const cancel=document.createElement('button');cancel.type='button';cancel.className='link cancel-edit';cancel.textContent='Cancel editing';cancel.addEventListener('click',resetNote);$('saveNote').before(cancel);updateInput();page('journal');$('symptomInput').focus();window.scrollTo({top:0});
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.evidence) showEvidence(button.dataset.evidence,button.dataset.symptom);
  if(button.dataset.edit) editEntry(button.dataset.edit);
  if(button.dataset.questions)showQuestions(state.entries.find(e=>e.id===button.dataset.questions));
  if(button.dataset.delete && confirm('Delete this note and its photo? This cannot be undone.')) {
    button.disabled=true;try{await api('entries/'+button.dataset.delete,'DELETE',{});if(state.editing===button.dataset.delete)resetNote();await reload();toast('Note deleted.');}catch(error){showError(error);button.disabled=false;}
  }
});
$('closeEntry').addEventListener('click',()=>$('entryDialog').close());
function pendingQuestions(entry){return entry.safety.level==='emergency'?[]:(entry.followUpQuestions||[]).filter(q=>!entry.answers?.[q.key]&&!entry.dismissed?.includes(q.key));}
function showQuestions(entry) {
  state.questionEntry={...entry,followUpQuestions:pendingQuestions(entry)};
  if(!state.questionEntry.followUpQuestions.length)return;
  $('questionFields').innerHTML=state.questionEntry.followUpQuestions.map((q,i)=>`<label class="field" for="answer-${i}">${escapeHTML(q.label)}<textarea id="answer-${i}" maxlength="500" rows="2"></textarea></label>`).join('');
  $('questionsDialog').showModal();
}
function offerQuestions(entry,autoOpen=true) {
  const panel=$('optionalFollowUp');panel.hidden=false;panel.replaceChildren();
  const title=document.createElement('h2');title.textContent='Optional follow-up · '+entry.followUpQuestions.map(q=>q.symptom).filter((s,i,a)=>a.indexOf(s)===i).join(', ');
  const text=document.createElement('p');text.textContent=entry.followUpQuestions.map(q=>q.label).join(' ');
  const open=document.createElement('button');open.type='button';open.className='secondary';open.textContent='Add optional context';open.addEventListener('click',()=>showQuestions(state.entries.find(e=>e.id===entry.id)||entry));
  const skip=document.createElement('button');skip.type='button';skip.className='link';skip.textContent='Dismiss questions';skip.addEventListener('click',async()=>{state.questionEntry=entry;await finishQuestions(true);});
  panel.append(title,text,open,document.createTextNode(' '),skip);
  if(autoOpen)showQuestions(entry);
}
async function finishQuestions(skip) {
  const entry=state.questionEntry;if(!entry)return;
  const answers={...entry.answers};const dismissed=[...entry.dismissed];
  entry.followUpQuestions.forEach((q,i)=>{const answer=skip?'':$('answer-'+i).value.trim();if(!skip&&answer)answers[q.key]=answer;else dismissed.push(q.key);});
  try{await api('entries/'+entry.id,'PUT',{...entry,answers,dismissed,useAI:false});$('questionsDialog').close();$('optionalFollowUp').hidden=true;state.questionEntry=null;await reload();toast(skip?'Questions skipped. Your note is saved.':'Additional context saved.');}catch(error){showError(error);}
}
$('questionsForm').addEventListener('submit',e=>{e.preventDefault();finishQuestions(false);});
$('skipQuestions').addEventListener('click',()=>finishQuestions(true));$('closeQuestions').addEventListener('click',()=>finishQuestions(true));
$('questionsDialog').addEventListener('cancel',e=>{e.preventDefault();finishQuestions(true);});
async function prepareImage(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a JPEG, PNG, or WebP image under 10 MB.');
  const bitmap=await createImageBitmap(file);
  try {const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);let image=canvas.toDataURL('image/jpeg',.78);if(image.length>660000)image=canvas.toDataURL('image/jpeg',.45);if(image.length>660000)throw new Error('This photo is too detailed. Choose a smaller image.');return image;} finally{bitmap.close();}
}
let scanUploadVersion=0;
async function uploadPhoto(event,scan) {
  const file=event.target.files[0];if(!file)return;
  const version=scan?++scanUploadVersion:0;
  if(scan)CareScan.reset();
  $('saveProduct').disabled=true;$('saveNote').disabled=true;
  try {
    const image=await prepareImage(file);
    if(scan&&version!==scanUploadVersion)return;
    if(scan)state.scanImage=image;else state.noteImage=image;
    $(scan?'scanPreview':'noteImagePreview').innerHTML=`<img class="preview" src="${image}" alt="Selected ${scan?'product or symptom':'symptom'} photo">`;
    $(scan?'removeScanImage':'removeNoteImage').hidden=false;
    if(scan)await CareScan.scan(file);
  }catch(error){if(!scan||version===scanUploadVersion){showError(error);event.target.value='';}}finally{if(!scan||version===scanUploadVersion){$('saveProduct').disabled=false;$('saveNote').disabled=false;}}
}
$('symptomPhoto').addEventListener('change',e=>uploadPhoto(e,false));$('barcodePhoto').addEventListener('change',e=>uploadPhoto(e,true));
$('removeNoteImage').addEventListener('click',()=>{state.noteImage=null;$('symptomPhoto').value='';$('noteImagePreview').innerHTML='';$('removeNoteImage').hidden=true;});
$('removeScanImage').addEventListener('click',()=>{scanUploadVersion++;state.scanImage=null;$('barcodePhoto').value='';$('scanPreview').innerHTML='';$('removeScanImage').hidden=true;CareScan.reset();});
$('productForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('saveProduct');button.disabled=true;button.textContent='Saving…';
  try{const product={name:$('productName').value.trim(),type:$('productType').value,confirmed:$('productConfirm').checked,...(CareScan.getBarcode()?{barcode:CareScan.getBarcode()}:{})};const description=product.name+($('productNotes').value.trim()?' — '+$('productNotes').value.trim():'');const {entry}=await api('entries','POST',{description,product,image:state.scanImage,recordedAt:$('productTime').value?new Date($('productTime').value).toISOString():undefined});$('productForm').reset();state.scanImage=null;$('scanPreview').innerHTML='';$('removeScanImage').hidden=true;CareScan.reset();await reload();window.CareAI?.saved(entry);toast('Product or activity saved.');if(entry.safety.level==='emergency')showEvidence(entry.id);else if(entry.followUpQuestions.length)offerQuestions(entry);}catch(error){showError(error);}finally{button.disabled=false;button.textContent='Save product or activity ↗';}
});
$('privacyButton').addEventListener('click',()=>$('privacyDialog').showModal());$('closePrivacy').addEventListener('click',()=>$('privacyDialog').close());
$('exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({app:'CareCard',version:1,exportedAt:new Date().toISOString(),entries:state.entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='carecard-journal-'+localTime(new Date()).slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Export downloaded. Keep this health information private.');});
$('deleteAll').addEventListener('click',async()=>{if(prompt('This permanently deletes every note and photo from this journal. Type DELETE ALL to continue.')!=='DELETE ALL')return;try{await api('entries','DELETE',{confirm:'DELETE ALL'});resetNote();await reload();$('privacyDialog').close();toast('All journal data deleted.');}catch(error){showError(error);}});
page(location.hash.slice(1));
reload().catch(error=>{$('connectionError').hidden=false;$('connectionError').textContent='Could not load your journal. Check your connection and sign-in, then reload. '+(error.message||'');});
