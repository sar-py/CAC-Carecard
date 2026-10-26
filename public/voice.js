// Based on the students' original Web Speech implementation.
(() => {
  const button=document.getElementById('voiceButton'),status=document.getElementById('voiceStatus'),input=document.getElementById('symptomInput');
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const mic='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-3 0h6"/></svg>';
  button.innerHTML=mic+' Start talking';
  if(!Recognition){button.disabled=true;status.textContent='Voice is unavailable here. You can type your note.';return;}
  const recognition=new Recognition();let listening=false,failed=false;
  recognition.lang='en-US';recognition.continuous=false;recognition.interimResults=false;
  button.addEventListener('click',()=>{
    if(listening){recognition.stop();return;}
    if(!sessionStorage.getItem('carecard-voice-consent')) {
      if(!confirm('Voice transcription uses your browser’s speech service and may send audio to its provider. Continue?'))return;
      sessionStorage.setItem('carecard-voice-consent','yes');
    }
    failed=false;try{recognition.start();}catch{status.textContent='Could not start the microphone. Please try again or type.';}
  });
  recognition.onstart=()=>{listening=true;status.textContent='Listening…';button.textContent='■ Stop talking';button.classList.add('recording');button.setAttribute('aria-pressed','true');};
  recognition.onresult=event=>{const text=event.results[0][0].transcript;input.value=(input.value+(input.value?' ':'')+text).slice(0,5000);input.dispatchEvent(new Event('input'));status.textContent='Transcribed. Review your words before saving.';};
  recognition.onerror=event=>{failed=true;status.textContent=event.error==='not-allowed'?'Microphone permission was denied. You can type instead.':'Voice unavailable: '+event.error+'. You can type instead.';};
  recognition.onend=()=>{listening=false;button.innerHTML=mic+' Start talking';button.classList.remove('recording');button.setAttribute('aria-pressed','false');if(!failed&&status.textContent==='Listening…')status.textContent='No speech captured. Try again or type.';};
})();
