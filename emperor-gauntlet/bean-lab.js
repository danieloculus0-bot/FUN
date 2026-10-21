/* BEAN gameplay laboratory; loaded only for Emperor Gauntlet ?bean=1.
 * Training is on the original game tick function, not a simplified mock. */
(async function(){
  "use strict";
  const Q=globalThis.EmperorBeanQ,env=globalThis.__EG_BEAN_GAME;
  if(!Q||!env)return;
  const POLICY_KEY="bean-emperor-q-v1";
  const MAX_STEPS=180,TICKS=18;
  const sleep=()=>new Promise(resolve=>setTimeout(resolve,0));
  const store=(()=>{try{return localStorage;}catch{return null;}})();
  let learner;
  try{learner=QL.QLearner.restore(JSON.parse(store.getItem(POLICY_KEY)));}catch{learner=new Q.QLearner();}
  let running=false,runCount=0,high=0,last=0;
  const dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open("bean-emperor-ledger",1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("episodes"))db.createObjectStore("episodes",{keyPath:"id"});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  async function writeEpisode(row){
    const db=await dbPromise;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction("episodes","readwrite");
      tx.objectStore("episodes").put(row);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }
  async function allEpisodes(){
    const db=await dbPromise;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction("episodes","readonly");
      const req=tx.objectStore("episodes").getAll();
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  const panel=document.createElement("section");
  panel.id="bean-q-lab";
  panel.style.cssText="position:fixed;top:9px;right:9px;z-index:200;background:#091a23eb;border:2px solid #a8f852;border-radius:9px;box-shadow:0 4px 25px #000b;color:#e9ffe5;padding:13px;max-width:min(360px,94vw);font:12px/1.5 ui-monospace,monospace;max-height:95vh;overflow:auto";
  panel.innerHTML='<strong style="color:#a8f852;font-size:15px">🌱 BEAN vs EMPEROR GAUNTLET</strong><div>REWARD-DRIVEN · TABULAR Q · PERSISTENT LEDGER</div><p id="bean-progress" aria-live="polite">READY TO LEARN</p><div id="bean-stats">No trials yet.</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px"><button id="bean-100">TRAIN 100</button><button id="bean-1000">TRAIN 1,000</button><button id="bean-eval">HELD-OUT TEST</button><button id="bean-export">EXPORT ALL LEDGER</button><button id="bean-stop">STOP AFTER EPISODE</button></div><small>Persisted locally in this browser. Export to retain your complete experiment.</small>';
  document.body.append(panel);
  for(const b of panel.querySelectorAll("button"))b.style.cssText="background:#c3f47e;color:#111d15;padding:5px 9px;border:0;font:inherit;font-weight:bold;cursor:pointer";
  const stat=panel.querySelector("#bean-stats"),progress=panel.querySelector("#bean-progress");
  function display(detail=""){
    stat.textContent="EPISODES "+runCount+" | BEST "+high+" | LAST "+last+
      " | Q STATES "+Object.keys(learner.table).length+
      " | UPDATES "+learner.updates+(detail?" | "+detail:"");
  }
  async function runEpisode(seed,{learn=false,random=false,trace=false}={}){
    const agent=random?new Q.QLearner({epsilon:1,seed:seed+973}):learner;
    let obs=env.reset(seed),score=0,returnTotal=0;
    const ledger=trace?new Q.Trace(seed):null;
    let steps=0;
    for(;steps<MAX_STEPS&&obs.status==="running";steps++){
      const action=agent.select(obs,{explore:learn||random});
      env.act(Q.policyCommand(obs,action));
      const after=env.step(TICKS);
      const done=after.status!=="running"||steps+1===MAX_STEPS;
      const reward=Q.rewardFor(obs,after,done&&after.status!=="running");
      if(learn)learner.update(obs,action,reward,after,done);
      if(ledger)ledger.add(obs,action,reward,after,done);
      returnTotal+=reward;obs=after;
    }
    score=obs.kills;
    return {seed,score,wave:obs.wave,reason:obs.cause,steps,returnTotal:Number(returnTotal.toFixed(3)),ledger:ledger?.export()};
  }
  function savePolicy(){if(store)try{store.setItem(POLICY_KEY,JSON.stringify(learner.snapshot()));}catch(e){progress.textContent="Local Q snapshot exceeded storage; EXPORT LEDGER: "+e.message;}}
  async function train(count){
    if(running)return;
    running=true;progress.textContent="Training on original game physics...";
    try{
      const existing=await allEpisodes();
      let start=existing.length;
      for(let i=0;i<count&&running;i++){
        const episode=start+i+1,seed=100000+episode*37;
        learner.epsilon=Math.max(.035,.28*Math.exp(-episode/500));
        const run=await runEpisode(seed,{learn:true,trace:true});
        const record={id:episode,type:"training",created:new Date().toISOString(),
          agentVersion:Q.VERSION,gameVersion:env.version,epsilon:learner.epsilon,seed,
          kills:run.score,wave:run.wave,steps:run.steps,returnTotal:run.returnTotal,
          reason:run.reason,trace:run.ledger};
        await writeEpisode(record);
        runCount++;last=run.score;high=Math.max(high,last);
        progress.textContent="LEARNING "+(i+1)+"/"+count+" | EP "+episode+" | PENGUINS "+last;
        display();
        if(i%5===0){savePolicy();await sleep();}
      }
      savePolicy();progress.textContent="Training run complete. Use HELD-OUT TEST to measure improvement.";
    }catch(e){progress.textContent="Experiment error: "+e.message;console.error(e);}
    finally{running=false;}
  }
  async function evaluate(){
    if(running)return;
    running=true;progress.textContent="Paired unseen-seed evaluation (random vs frozen learned policy)...";
    try{
      // Holdout region deliberately disjoint from training seed sequence.
      const samples=[];
      for(let i=0;i<10;i++){
        if(!running)break;
        const seed=800001+i*101;
        const base=await runEpisode(seed,{random:true});
        const learned=await runEpisode(seed,{learn:false});
        samples.push({seed,random:base.score,learned:learned.score});
        progress.textContent="HELD-OUT "+(i+1)+"/10";
        await sleep();
      }
      const mean=(f)=>samples.reduce((n,v)=>n+v[f],0)/Math.max(1,samples.length);
      const result={id:"evaluation-"+Date.now(),type:"heldout",date:new Date().toISOString(),
        agentVersion:Q.VERSION,trainingEpisodes:runCount,
        frozenQUpdates:learner.updates,seeds:samples,
        randomMean:mean("random"),learnedMean:mean("learned")};
      await writeEpisode(result);
      display("RANDOM "+result.randomMean.toFixed(2)+" | BEAN "+result.learnedMean.toFixed(2));
      progress.textContent=result.learnedMean>result.randomMean?"Measured held-out improvement in this sample.":"No held-out advantage demonstrated yet.";
    }catch(e){progress.textContent="Evaluation error: "+e.message;console.error(e);}
    finally{running=false;}
  }
  async function exportData(){
    try{
      const data={format:"bean-emperor-complete-ledger-v1",exported:new Date().toISOString(),
        gameVersion:env.version,policy:learner.snapshot(),episodes:await allEpisodes()};
      const blob=new Blob([JSON.stringify(data)],{type:"application/json"});
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);
      a.download="bean-emperor-ledger-"+Date.now()+".json";a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    }catch(e){progress.textContent="Export error: "+e.message;}
  }
  panel.querySelector("#bean-100").onclick=()=>train(100);
  panel.querySelector("#bean-1000").onclick=()=>train(1000);
  panel.querySelector("#bean-eval").onclick=evaluate;
  panel.querySelector("#bean-export").onclick=exportData;
  panel.querySelector("#bean-stop").onclick=()=>{running=false;};
  try{
    const rows=await allEpisodes();
    runCount=rows.filter(x=>x.type==="training").length;
    high=Math.max(0,...rows.filter(x=>x.type==="training").map(x=>x.kills||0));
    display();
  }catch(e){progress.textContent="IndexedDB unavailable: "+e.message;}
})();
