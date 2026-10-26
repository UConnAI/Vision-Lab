const examples={
  backprop:{code:'bpCode',language:'bpCodeLanguage',status:'bpCodeStatus',download:'bpCodeDownload',run:'bpCodeRun',python:'python/backprop_numpy.py',javascript:'math-backprop-core.mjs'},
  cnn:{code:'cnnCode',language:'cnnCodeLanguage',status:'cnnCodeStatus',download:'cnnCodeDownload',run:'cnnCodeRun',python:'python/symbol_cnn.py',javascript:'cnn-lab-core.mjs'}
};
for(const panel of document.querySelectorAll('[data-code-python]')){
  const name=panel.id;
  examples[name]={code:`${name}Code`,language:`${name}Language`,status:`${name}Status`,download:`${name}Download`,run:`${name}Run`,python:panel.dataset.codePython,javascript:panel.dataset.codeJavascript,pythonSection:panel.dataset.codeSection};
}
const $=id=>document.getElementById(id),cache=new Map(),versions=new Map();
async function source(path){
  if(!cache.has(path))cache.set(path,fetch(path).then(response=>{if(!response.ok)throw new Error(`Source returned HTTP ${response.status}.`);return response.text();}).catch(error=>{cache.delete(path);throw error;}));
  return cache.get(path);
}
function shownSource(text,section){
  if(!section)return text;
  const start=`# region ${section}`,end='# endregion',lines=text.split(/\r?\n/);
  const first=lines.findIndex(line=>line.trim()===start),last=lines.findIndex((line,index)=>index>first&&line.trim()===end);
  if(first<0||last<0)throw new Error(`Python section ${section} is missing from the source file.`);
  return lines.slice(first+1,last).join('\n').trim()+'\n';
}
async function showExample(name,language){
  const example=examples[name],version=(versions.get(name)||0)+1;versions.set(name,version);
  const code=$(example.code),button=document.querySelector(`[data-copy="${example.code}"]`),download=$(example.download),path=example[language];
  $(example.language).value=language;code.textContent='Loading source…';button.disabled=true;button.textContent='Copy shown code';download.hidden=true;
  $(example.status).textContent=language==='python'?'Python source · runs locally with Python.':'JavaScript source · used by the live browser demo.';
  $(example.run).textContent=language==='python'?`Windows: python ${path}\nMac: python3 ${path}`:'Use the live demo on this page. The browser imports this JavaScript module.';
  try{
    const text=await source(path);if(versions.get(name)!==version)return;
    const excerpt=language==='python'&&example.pythonSection;
    code.textContent=shownSource(text,excerpt);code.dataset.language=language;button.disabled=false;download.href=path;download.download=path.split('/').at(-1);download.hidden=false;
    $(example.status).textContent=`${language==='python'?'Python':'JavaScript'} · ${path} · ${excerpt?'functions excerpt; copy shown code or download the complete runnable file.':'complete file; copy/download verbatim.'}`;
  }catch(error){if(versions.get(name)!==version)return;code.textContent='Source could not be loaded. Keep the complete workshop folder and refresh this page.';$(example.status).textContent=error.message;}
}
function choose(language){
  if(!['python','javascript'].includes(language))language='python';
  $('lectureCodeLanguage').value=language;
  for(const name of Object.keys(examples))void showExample(name,language);
}
if($('lectureCodeLanguage')){
  $('lectureCodeLanguage').onchange=event=>choose(event.target.value);
  for(const example of Object.values(examples))$(example.language).onchange=event=>choose(event.target.value);
  // Start every visit in the requested teaching language. An old saved
  // JavaScript preference must not override Python on refresh.
  choose('python');
}
