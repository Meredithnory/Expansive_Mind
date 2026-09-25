"use client";
import { useState } from "react";
import styles from "./report-visuals.module.scss";
type Answer = {claims:{text:string;quote:string;sourceId:string;title:string;url:string}[];interpretation:string;followUp:string;suggestedSearch:string;unavailable:string[]};
export default function ReportAssistant({id, papers, onSearch}: {id:string;papers:{index:number;title:string}[];onSearch:(query:string)=>void}) {
    const [context,setContext] = useState("");
    const [question,setQuestion] = useState("");
    const [selected,setSelected] = useState<number[]>([]);
    const [turns,setTurns] = useState<{question:string;answer:Answer}[]>([]);
    const [busy,setBusy] = useState(false);
    const [error,setError] = useState("");
    return <section className={styles.card}><h3>Your research conversation</h3><p>Ask about the evidence, compare papers, or work out what to search next. Uses your AI question allowance. Context and conversation stay in this open report; they are not saved as a personal profile.</p>
        <details><summary>Tell the assistant what matters to you</summary><label>Your goals, experience, budget, or interests<textarea maxLength={1000} value={context} onChange={e=>setContext(e.target.value)} /></label></details>
        <details><summary>Consult specific papers ({selected.length}/3)</summary><p>Select up to three papers to retrieve relevant licensed text. With none selected, the assistant uses the report’s saved supporting excerpts and commercial sources.</p>{papers.map(p=><label key={p.index}><input style={{display:"inline",width:"auto"}} type="checkbox" checked={selected.includes(p.index)} disabled={!selected.includes(p.index) && selected.length>=3} onChange={e=>setSelected(v=>e.target.checked?[...v,p.index]:v.filter(i=>i!==p.index))} /> Paper {p.index}: {p.title}</label>)}</details>
        <div aria-live="polite">{turns.map((turn,i)=><article className={styles.row} key={i}><h4>{turn.question}</h4>{turn.answer.claims.length===0 && <p>No source-matched claims were available for this answer.</p>}{turn.answer.claims.map((c,j)=><div key={j}><p>{c.text}</p><details><summary>Fact-check · {c.sourceId}</summary><blockquote>{c.quote}</blockquote><a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a><p>Quote matches retrieved text; relevance and truth still require review.</p></details></div>)}<p><strong>Interpretation · not independently verified:</strong> {turn.answer.interpretation}</p><p>{turn.answer.followUp}</p>{turn.answer.unavailable.length>0 && <p>Could not consult: {turn.answer.unavailable.join(", ")}</p>}{turn.answer.suggestedSearch && <button onClick={()=>onSearch(turn.answer.suggestedSearch)}>Use suggested search: {turn.answer.suggestedSearch}</button>}</article>)}</div>
        <form onSubmit={async e=>{e.preventDefault();if(busy || !question.trim())return;setBusy(true);setError("");const asked=question;try{const response=await fetch("/api/discover/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({discoveryId:id,question:asked,context,paperIndexes:selected,history:turns.slice(-3).flatMap(t=>[t.question,t.answer.interpretation])})});const answer=await response.json();if(!response.ok)throw new Error(answer.error || "Please sign in to ask about your saved report.");setTurns(v=>[...v,{question:asked,answer}]);setQuestion("");}catch(e){setError(e instanceof Error?e.message:"Unable to answer.");}finally{setBusy(false);}}}>
            <label>Ask your report assistant<textarea required maxLength={2000} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What evidence would change whether I should pursue this idea?" /></label><button disabled={busy || !question.trim()}>{busy?"Consulting evidence…":"Ask assistant"}</button>
        </form>{error && <p role="alert">{error}</p>}
    </section>;
}
