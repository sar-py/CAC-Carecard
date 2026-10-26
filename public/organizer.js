/* Shared deterministic extraction: used by the browser for immediate CareGuard
   feedback and by the server as the authoritative analysis. No notes leave this app. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CareLogic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const dictionary = {
    Headache: /\b(?:headaches?|migraines?|head (?:hurts|aches?))\b/gi,
    Nausea: /\b(?:nausea|nauseous|queasy|feel(?:ing)? sick)\b/gi,
    Dizziness: /\b(?:dizz(?:y|iness)|light[- ]headed(?:ness)?)\b/gi,
    Fatigue: /\b(?:fatigue|tired|exhausted|low energy)\b/gi,
    'Stomach pain': /\b(?:stomach(?:ache| ache| pain| cramps?)|abdominal (?:pain|cramps?)|belly (?:ache|pain))\b/gi,
    'Chest discomfort': /\b(?:chest\s+(?:(?:is|was|feels?|felt|has been)\s+)?(?:hurt(?:s|ing)?|pain(?:ful)?|pressure|tight(?:ness)?|discomfort|heavy)|(?:pain|pressure|tightness)\s+in\s+(?:(?:my|the)\s+)?chest|tight chest)\b/gi,
    'Breathing difficulty': /\b(?:shortness of breath|short of breath|difficulty breathing|trouble breathing|can['’]?t breathe|cannot breathe|gasping|choking)\b/gi,
    Cough: /\b(?:cough|coughing|coughs)\b/gi,
    Fever: /\b(?:fever|feverish|high temperature)\b/gi,
    Rash: /\b(?:rash(?:es)?|hives|itchy skin)\b/gi,
    'Back pain': /\b(?:back(?:ache| ache| pain)|back hurts)\b/gi,
    'Sore throat': /\b(?:sore throat|throat (?:pain|hurts))\b/gi,
    Vomiting: /\b(?:vomit(?:ing|ed)?|threw up|throwing up)\b/gi,
    Diarrhea: /\b(?:diarrh(?:ea|oea)|loose stools?)\b/gi,
    'Sleep difficulty': /\b(?:insomnia|can['’]?t sleep|trouble sleeping|poor sleep)\b/gi,
    Palpitations: /\b(?:palpitations|heart racing|racing heart)\b/gi,
    'Stroke warning sign': /\b(?:face drooping|drooping face|slurr?ed speech|speech\s+(?:(?:is|was|became|feels?)\s+)?slurr?ed|slurring\s+(?:(?:my|the)\s+)?(?:speech|words)|sudden weakness on one side|one[- ]sided weakness|sudden (?:vision loss|confusion))\b/gi,
    'Severe bleeding': /\b(?:severe bleeding|uncontrolled bleeding|bleeding (?:won['’]?t|will not) stop)\b/gi,
    'Severe allergic warning sign': /\b(?:(?:tongue|throat) (?:is )?swelling|swollen (?:tongue|throat))\b/gi
  };
  function negated(text, index) {
    // Reset scope at punctuation or contrast, but keep coordinated negatives:
    // "no headache or nausea, but dizzy".
    const before = text.slice(0, index).split(/[.!?;,\n]|\b(?:but|however|although|now)\b|\b(?:and|or)\s+(?=(?:i|my|he|she|his|her|they|their)\b)/i).pop();
    if (/\bnot\s+(?:only|just|sure|certain)\b/i.test(before) && !/\b(?:no|without|denies)\b/i.test(before)) return false;
    return /\b(?:no|not|without|deny|denies|denied|never)\b.{0,65}$/i.test(before);
  }
  function observations(text, includeResolvedStroke = false) {
    const found = [];
    for (const [name, expression] of Object.entries(dictionary)) {
      expression.lastIndex = 0;
      for (const match of text.matchAll(expression)) {
        const after = text.slice(match.index + match[0].length, match.index + match[0].length + 25);
        if (!negated(text, match.index) && (includeResolvedStroke && name === 'Stroke warning sign' && !/^\s+(?:is |was )?(?:absent|not present)\b/i.test(after) || !/^\s+(?:is |was |has )?(?:gone|absent|resolved|not present)\b/i.test(after))) {
          found.push({name, quote: match[0], start: match.index, end: match.index + match[0].length});
          break;
        }
      }
    }
    return found.sort((a,b) => a.start - b.start);
  }
  function safety(text) {
    const symptoms = observations(text,true).map(o => o.name);
    const flags = symptoms.filter(s => ['Chest discomfort','Breathing difficulty','Stroke warning sign','Severe bleeding','Severe allergic warning sign'].includes(s));
    return flags.length ? {
      level: 'emergency', flags,
      message: 'Potential emergency warning sign recorded. If this is happening now, or a stroke sign happened recently even if it stopped, call 911 in the U.S. or your local emergency number now. Do not wait for this app or a questionnaire. CareCard cannot determine the cause or urgency.'
    } : {level: 'routine', flags: [], message: null};
  }
  function questions(symptoms, entries, text) {
    const result = [];
    for (const symptom of symptoms) {
      const recent = entries.filter(e => Date.now() - Date.parse(e.recordedAt) >= 0 && Date.now() - Date.parse(e.recordedAt) < 30*86400000);
      const prior = recent.filter(e => e.symptoms?.includes(symptom));
      const recurringWording = /\b(?:recurring|keeps? coming back|keeps? happening|every day|daily|repeated|on and off|again|another|still|often)\b/i.test(text);
      const combination = symptom === 'Headache' && symptoms.includes('Nausea') || symptom === 'Dizziness' && symptoms.includes('Palpitations');
      if (prior.length < 1 && !recurringWording && !combination) continue;
      const bank = {
        Headache: [
        ['location', 'Where do you feel the headache?'], ['duration', 'When did it start, and how long does it last?'], ['associated', 'What else do you notice with the headache?']
        ],
        Nausea: [['timing','When do you notice nausea in relation to meals?'],['duration','How long does the nausea last?']],
        Dizziness: [['onset','What are you doing when the dizziness starts, such as standing up?'],['duration','How long does each dizzy episode last?']],
        Fatigue: [['sleep','How has your sleep been around the days you feel tired?'],['duration','How long does the low energy last?']],
        Rash: [['location','Where is the rash, and has its appearance changed?'],['context','What products or activities were around the time you noticed it?']]
      };
      const options = bank[symptom] || [['duration','When does the ' + symptom.toLowerCase() + ' start, and how long does it last?'], ['context','What do you notice around the time it happens?']];
      for (const [field, label] of options) {
        if (symptom === 'Headache' && field === 'location' && /\b(?:temples?|behind (?:my |the )?eyes|left side|right side|forehead)\b/i.test(text)) continue;
        const key = symptom + ':' + field;
        if (!recent.some(e => e.answers?.[key] || e.dismissed?.includes(key))) result.push({key, label, symptom,reason:prior.length>=1?'recurring':recurringWording?'reported recurrence':'symptom combination'});
      }
    }
    return result.slice(0,2);
  }
  function analyze(text, entries = [], product = null) {
    // A product named "Headache tablets" is not a report of a headache.
    const offset = product && text.startsWith(product.name) ? product.name.length : 0;
    const reported = text.slice(offset);
    const evidence = observations(reported).map(e => ({...e,start:e.start+offset,end:e.end+offset}));
    const symptoms = evidence.map(o => o.name);
    const guard = safety(reported);
    const rating = reported.match(/\b(10|[1-9])\s*(?:\/\s*10|out of (?:10|ten))\b/i);
    const onset = reported.match(/\b(?:since|started|began)\s+[^.!?;\n]{1,80}/i);
    return {symptoms, evidence, onset: onset?.[0] || null, severity: rating ? Number(rating[1]) : null,
      needsSeveritySlider: symptoms.some(s => ['Headache','Nausea','Dizziness','Fatigue','Stomach pain','Back pain','Sore throat','Rash','Chest discomfort'].includes(s)),
      safety: guard, followUpQuestions: guard.level === 'emergency' ? [] : questions(symptoms, entries,reported)};
  }
  function trends(entries) {
    const counts = new Map();
    entries.forEach(e => (e.symptoms || []).forEach(s => { const ids = counts.get(s) || []; ids.push(e.id); counts.set(s,ids); }));
    const recurring = [...counts].map(([symptom,entryIds]) => ({symptom,count:entryIds.length,entryIds})).sort((a,b) => b.count-a.count);
    const associations = [];
    const products = entries.filter(e => e.product);
    for (const name of new Set(products.map(e => e.product.name.toLowerCase()))) {
      for (const {symptom} of recurring) {
        const pairs = [];
        entries.filter(e => e.symptoms.includes(symptom)).forEach(e => {
          const previous = products.filter(p => p.id !== e.id && p.product.name.toLowerCase() === name && Date.parse(e.recordedAt) > Date.parse(p.recordedAt) && Date.parse(e.recordedAt)-Date.parse(p.recordedAt) <= 6*3600000);
          if (previous.length) pairs.push({entryId:e.id,productEntryId:previous[previous.length-1].id});
        });
        if (pairs.length >= 2) associations.push({product: products.find(e => e.product.name.toLowerCase()===name).product.name, symptom, count:pairs.length,pairs});
      }
    }
    return {recurring,associations,windowHours:6};
  }
  function summarize(entries) {
    if(!entries.length)return 'No notes were recorded in this date range. Add a note or choose a different period to prepare an appointment overview.';
    const ranked=trends(entries).recurring;
    const symptoms=ranked.slice(0,3).map(s=>s.symptom.toLowerCase()+' ('+s.count+' '+(s.count===1?'entry':'entries')+')');
    const products=entries.filter(e=>e.product).length;
    return 'This period includes '+entries.length+' '+(entries.length===1?'recorded entry':'recorded entries')+'. '+(symptoms.length?'The most frequently logged symptoms were '+symptoms.join(', ')+'. ':'No symptoms were recognized by the organizer; review the original notes for details. ')+(products?products+' product or activity '+(products===1?'event was':'events were')+' also recorded. ':'')+'These are personal observations to discuss at an appointment, not a diagnosis.';
  }
  return {analyze,safety,trends,observations,summarize,negated};
});
