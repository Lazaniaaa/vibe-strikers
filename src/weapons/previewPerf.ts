/** Opt-in browser benchmark. No model/pose changes; no UI on the ordinary preview URL. */
export function installPreviewPerf(){
 const mode=new URLSearchParams(location.search).get('previewPerf');if(!mode)return null;
 const events:{control:string;value:number;handlerMs:number;nextFrameMs:number}[]=[],frames:number[]=[],measurements:{name:string;ms:number}[]=[];
 let started=0,control:HTMLInputElement|null=null,running=false,diagnostics:(()=>any)|undefined;
 document.addEventListener('input',event=>{const target=event.target;if(target instanceof HTMLInputElement&&target.closest('.weapon-controls')){control=target;started=performance.now();}},true);
 document.addEventListener('input',()=>{if(!control)return;const sample={control:control.id,value:Number(control.value),handlerMs:performance.now()-started,nextFrameMs:0};events.push(sample);const began=started;requestAnimationFrame(()=>sample.nextFrameMs=performance.now()-began);control=null;});
 const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 const settled=async()=>{const deadline=performance.now()+8000;while(diagnostics){const d=diagnostics().measurement;if(!d.scheduled&&!d.inFlight)return;if(performance.now()>deadline)throw new Error('Preview idle measurement did not settle');await new Promise(resolve=>setTimeout(resolve,20));}};
 const finish=(value:unknown)=>{let out=document.querySelector('output#preview-perf-result');if(!out){out=document.createElement('output');out.id='preview-perf-result';out.setAttribute('hidden','');document.body.append(out);}out.textContent=JSON.stringify(value);console.info('PREVIEW PERF',value);};
 const run=async()=>{
  running=true;
  const select=document.querySelector<HTMLSelectElement>('#weapon-select')!;select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}));
  const side=document.querySelector<HTMLSelectElement>('#hold-side')!;side.value='right';side.dispatchEvent(new Event('change',{bubbles:true}));
  await frame();await frame();events.length=0;frames.length=0;measurements.length=0;
  const slider=document.querySelector<HTMLInputElement>('#w-ads')!;
  const initialDiagnostics=diagnostics?.(),count=mode==='before'?5:120,began=performance.now();let dispatchMs=0;
  for(let i=0;i<count;i++){
   slider.value=String(mode==='before'?i/4:(i<60?i/59:(119-i)/59));
   const event=new Event('input',{bubbles:true}),start=performance.now();slider.dispatchEvent(event);dispatchMs+=performance.now()-start;
   if(mode==='before'){await frame();await frame();}
  }
  const burstMs=performance.now()-began;await frame();await frame();
  const worst=Math.max(...events.map(e=>e.handlerMs)),adsEvents=events.slice(),burstFrames=frames.slice(),elapsedMs=performance.now()-began;
  const afterInputs=diagnostics?.(),animation:unknown[]=[],paced:unknown[]=[],resourceChecks:unknown[]=[];
  if(mode!=='before'){
   for(const id of ['fire','reload','cycle','equip','move','strafe','aim']){
    const input=document.querySelector<HTMLInputElement>('#w-'+id)!,old=input.value;events.length=0;
    for(let i=0;i<120;i++){input.value=String(Number(input.min)+(Number(input.max)-Number(input.min))*(i%60)/59);input.dispatchEvent(new Event('input',{bubbles:true}));}
    input.value=old;input.dispatchEvent(new Event('input',{bubbles:true}));
    animation.push({control:id,count:120,worstMs:Math.max(...events.map(e=>e.handlerMs))});await frame();
   }
   const warm=async()=>{for(const id of ['0','1','2','3','4']){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));await frame();await frame();}};
   await warm();await settled();const first=diagnostics?.();await warm();await settled();const second=diagnostics?.();
   resourceChecks.push({sameResources:first?.resources===second?.resources&&first?.gpuGeometries===second?.gpuGeometries,first,second});
   select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}));
   for(const value of ['left','right','left','right']){side.value=value;side.dispatchEvent(new Event('change',{bubbles:true}));await frame();await frame();}
   slider.value='0';slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));await settled();
   const cachedBefore=diagnostics?.();slider.dispatchEvent(new Event('change',{bubbles:true}));await settled();const cachedAfter=diagnostics?.();
   resourceChecks.push({cacheReuse:cachedAfter?.measurement.cacheHits>cachedBefore?.measurement.cacheHits,noNewWorkerJob:cachedAfter?.measurement.workerJobs===cachedBefore?.measurement.workerJobs,cachedBefore,cachedAfter});
   for(const value of [0,.25,.5,.75,1]){events.length=0;slider.value=String(value);slider.dispatchEvent(new Event('input',{bubbles:true}));await frame();await frame();paced.push({...events[0]});}
   slider.dispatchEvent(new Event('change',{bubbles:true}));await settled();
  }
  const result={mode,count,totalDispatchMs:dispatchMs,burstMs,elapsedMs,worstHandlerMs:worst,events:adsEvents,frameCpuMs:burstFrames,measurements,initialDiagnostics,afterInputs,animation,paced,resourceChecks,finalDiagnostics:diagnostics?.(),pass:mode==='before'||worst<=8};
  if(mode!=='before'){
   result.pass&&=animation.every((r:any)=>r.worstMs<=8)&&initialDiagnostics?.measurement.requests===afterInputs?.measurement.requests&&resourceChecks.every((r:any)=>r.sameResources??(r.cacheReuse&&r.noNewWorkerJob));
   result.pass&&=result.finalDiagnostics?.overlayBuilds===1&&result.finalDiagnostics?.overlayNodeStable===true;
  }
  finish(result);running=false;if(!result.pass)throw new Error('Preview performance contract failed; see PREVIEW PERF result (input limit 8 ms, cache/resources must remain shared).');
 };
 setTimeout(()=>void run(),250);
 return {attach(read:()=>any){diagnostics=read;},frame(start:number){if(running)frames.push(performance.now()-start);},measure(name:string,ms:number){if(running)measurements.push({name,ms});}};
}
