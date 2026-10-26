// A failed dynamic import can stay cached in a browser tab. Give each attempt
// a fresh local URL so a restored server can recover without reloading the page.
export async function loadVision({baseURL=import.meta.url,importer=url=>import(url),fetcher=fetch,token=Date.now()}={}){
  const url=new URL('./vendor/vision_bundle.mjs',baseURL);
  let failure;
  for(let attempt=0;attempt<2;attempt++){
    url.searchParams.set('load',`${token}-${attempt}`);
    try{return await importer(url.href);}catch(error){failure=error;}
  }
  let detail='The local server could not deliver the hand-tracking module.';
  try{
    const response=await fetcher(url.href,{cache:'no-store',signal:AbortSignal.timeout(5000)});
    const type=response.headers.get('content-type')||'';
    if(!response.ok)detail=`The hand-tracking module returned HTTP ${response.status}. Extract the complete workshop folder, including vendor, and restart its launcher.`;
    else if(!/javascript|ecmascript/i.test(type))detail=`The server sent the module as ${type||'an unknown file type'}. Restart using this workshop's launcher so JavaScript files are served correctly.`;
    else detail='The module is reachable, but this browser could not import it. Reload this page in Chrome or Edge and try again.';
  }catch{detail='The local server is unavailable. Keep the workshop launcher running, then click Retry hand tracking.';}
  throw new Error(`${detail} Original error: ${failure?.message||'Module import failed'}`);
}
