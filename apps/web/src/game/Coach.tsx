import { useEffect,useMemo,useRef,useState,type RefObject } from 'react';
import type { LevelDTO } from '@graphway/contracts';
import styles from './Game.module.css';
type Wait='edit'|'ready'|'launch';
interface Step{text:string;target:string;round?:boolean;wait?:Wait}
/** Optional page-memory guidance; never edits fields, validates routes or dispatches launch. */
export function Coach({level,signals,root,onClose,paused=false,reducedMotion=false}:{level:LevelDTO;signals:{edits:number;ready:boolean;riding:boolean};root:RefObject<HTMLElement|null>;onClose:()=>void;paused?:boolean;reducedMotion?:boolean}){
 const control=level.controls[0];
 const steps=useMemo<Step[]>(()=>level.functionSpec.family==='linear'?[
  {text:`Привет! Я step42. ${level.goal}`,target:'[data-testid="goal-zone"]',round:true},
  {text:'Моя дорога — график функции y = kx + b. Соедини старт S с батареей и не касайся ям.',target:'[data-testid="graph"]'},
  {text:control?.mode==='slider-input'?`Двигай ползунок ${control.name} или впиши число — график меняется сразу. Попробуй!`:`Впиши число в поле ${control?.name??'коэффициента'} — график меняется сразу. Можно вводить дроби и запятую.`,target:'[data-coach="control"]',wait:'edit'},
  {text:`${level.theory.activeCoefficientMeaning} Подбирай числа, пока маршрут не подойдёт.`,target:'[data-testid="graph"]',wait:'ready'},
  {text:'Есть путь! Когда захочешь, жми «Пуск». Прохождение сохранится после поездки и подтверждения сервера.',target:'[data-coach="launch"]',wait:'launch'}
 ]:[
  {text:`Новый эпизод! Теперь дорога — парабола y = ax² + bx + c. ${level.goal}`,target:'[aria-label="Формула функции"]'},
  {text:level.theory.activeCoefficientMeaning,target:'[data-coach="controls"]'},
  {text:`${level.theory.fixedCoefficientMeaning} ${level.theory.focus}. Теория и подсказки не меняют твои числа.`,target:'[data-testid="graph"]'}
 ],[level,control]);
 const [stage,setStage]=useState({index:0,editsAtStart:signals.edits});
 const [ring,setRing]=useState<{left:number;top:number;width:number;height:number;round:boolean}|null>(null);
 const [atTop,setAtTop]=useState(false);const card=useRef<HTMLElement>(null);
 const step=steps[stage.index]!;
 const next=()=>{if(stage.index>=steps.length-1)onClose();else setStage({index:stage.index+1,editsAtStart:signals.edits});};
 useEffect(()=>{
  if(paused)return;
  const advance=step.wait==='edit'&&signals.edits!==stage.editsAtStart||step.wait==='ready'&&signals.ready;
  if(step.wait==='launch'&&signals.riding){onClose();return;}
  if(!advance)return;
  const timer=setTimeout(()=>setStage(current=>current.index===stage.index?{index:current.index+1,editsAtStart:signals.edits}:current),reducedMotion?0:350);
  return()=>clearTimeout(timer);
 },[paused,reducedMotion,step,stage.index,stage.editsAtStart,signals.edits,signals.ready,signals.riding,onClose]);
 useEffect(()=>{
  if(paused)return;
  let frame=0;
  const place=()=>{
   const target=root.current?.querySelector<Element>(step.target);
   if(!target){setRing(null);return;}
   const bounds=target.getBoundingClientRect();const pad=step.round?10:6;
   const nextRing={left:bounds.left-pad,top:bounds.top-pad,width:bounds.width+pad*2,height:bounds.height+pad*2,round:!!step.round};
   setRing(previous=>previous&&previous.left===nextRing.left&&previous.top===nextRing.top&&previous.width===nextRing.width&&previous.height===nextRing.height&&previous.round===nextRing.round?previous:nextRing);
   if(card.current&&getComputedStyle(card.current).position==='fixed')setAtTop(bounds.top+bounds.height/2>innerHeight*.5);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;place();});};
  schedule();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);
  const target=root.current?.querySelector<Element>(step.target);
  if(root.current)observer?.observe(root.current);if(target)observer?.observe(target);
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true,capture:true});
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);};
 },[paused,root,step]);
 useEffect(()=>{if(paused)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[paused,onClose]);
 return <>
  {!paused&&ring&&<div className={styles.coachRing} aria-hidden="true" style={{left:ring.left,top:ring.top,width:ring.width,height:ring.height,borderRadius:ring.round?'50%':22,transition:reducedMotion?'none':undefined}}/>}
  <section ref={card} hidden={paused} className={`${styles.coach} ${atTop?styles.coachTop:''}`} aria-label="Подсказки робота">
   <button type="button" className={styles.coachClose} aria-label="Закрыть подсказки" onClick={onClose}>×</button>
   <p className={styles.coachStep}>Шаг {stage.index+1} из {steps.length}</p><p className={styles.coachText} aria-live="polite">{step.text}</p>
   <div className={styles.coachControls}><button type="button" className={styles.coachSkip} onClick={onClose}>Пропустить</button><button type="button" data-next className="primary" onClick={next}>{stage.index<steps.length-1?'Дальше':'Понятно'}</button></div>
  </section>
 </>;
}
