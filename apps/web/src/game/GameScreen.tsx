import { useCallback,useEffect,useRef,useState,type Dispatch,type ReactNode,type MouseEvent } from 'react';
import type { CompletionResult } from '@graphway/contracts';
import { api,ApiError } from '../app/api';
import type { GameEvent,GameState } from './game-state';
import { robotMood } from './game-state';
import { CoefficientControls,CurrentFormula } from './CoefficientControls';
import { GraphBoard } from './GraphBoard';
import { TheoryPanel } from './TheoryPanel';
import { Icon } from '../app/Icon';
import { prettyFunction,robotLine,toneOf } from './presentation';
import styles from './Game.module.css';
import { Coach } from './Coach';
const coachSeen=new Set<string>();
export function GameScreen({state,owner,dispatch,portrait,onSaved,onUnauthorized,onSessionChanged,onHome,onEpisodes,onEpisodePicker,previous,next,allPassed,onLevel,episodeLevels=[],robot}:{state:GameState;owner:string;dispatch:Dispatch<GameEvent>;portrait:boolean;onSaved:(result:CompletionResult)=>void;onUnauthorized:()=>void;onSessionChanged:()=>void;onHome:()=>void;onEpisodes:()=>void;onEpisodePicker:()=>void;previous:{id:string;unlocked:boolean}|null;next:{id:string;unlocked:boolean}|null;allPassed:boolean;onLevel:(id:string)=>void;episodeLevels?:readonly {id:string;completed:boolean;unlocked:boolean}[];robot?:(mood:'idle'|'attention'|'success',active:boolean,reducedMotion?:boolean)=>ReactNode}){
 const [theory,setTheory]=useState(false);const [menu,setMenu]=useState(false);const [hidden,setHidden]=useState(document.hidden);const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);const inFlight=useRef(false);
 const menuOpener=useRef<HTMLButtonElement|null>(null);
 const [menuAt,setMenuAt]=useState<{top:number;right:number}|null>(null);
 const panel=useRef<HTMLElement>(null);
 const fullButton=useRef<HTMLButtonElement>(null);
 const [full,setFull]=useState(false);
 const layout=useRef<HTMLDivElement>(null);
 const [coach,setCoach]=useState(()=>!coachSeen.has(`${owner}:${state.level.episodeId}`));
 const [edits,setEdits]=useState(0);
 const closeCoach=useCallback(()=>setCoach(false),[]);
 useEffect(()=>{if(coach)coachSeen.add(`${owner}:${state.level.episodeId}`);},[coach,owner,state.level.episodeId]);
 useEffect(()=>{
  const exit=()=>{if(!document.fullscreenElement){setFull(false);fullButton.current?.focus();}};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&full){event.preventDefault();if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});setFull(false);fullButton.current?.focus();}};
  document.addEventListener('fullscreenchange',exit);
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('fullscreenchange',exit);document.removeEventListener('keydown',key);};
 },[full]);
 useEffect(()=>{if(portrait){if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});setFull(false);}},[portrait]);
 const toggleFull=()=>{if(full){if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});setFull(false);fullButton.current?.focus();return;}setFull(true);void panel.current?.requestFullscreen?.().catch(()=>{});};
 const openMenu=(event:MouseEvent<HTMLButtonElement>)=>{
  menuOpener.current=event.currentTarget;
  const r=event.currentTarget.getBoundingClientRect();setMenuAt({top:r.bottom+10,right:Math.max(12,innerWidth-r.right)});
  setMenu(true);
 };
 const closeMenu=()=>{
  setMenu(false);
  menuOpener.current?.focus();
 };
 useEffect(()=>{const visibility=()=>setHidden(document.hidden);const media=matchMedia('(prefers-reduced-motion: reduce)');const motion=()=>setReduced(media.matches);document.addEventListener('visibilitychange',visibility);media.addEventListener('change',motion);return()=>{document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motion);};},[]);
 const duration=reduced?500:3000;const paused=theory||menu||portrait||hidden;
 useEffect(()=>{
  if(state.status!=='riding'||paused)return;
  let frame=0;let previous:number|null=null;
  const tick=(now:number)=>{if(previous!==null)dispatch({type:'tick',delta:now-previous,duration});previous=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[state.status,paused,duration,dispatch]);
 useEffect(()=>{
  if(state.status!=='arrived-pending'||!state.snapshot||inFlight.current)return;
  inFlight.current=true;
  let cancelled=false;
  void api.complete(state.snapshot,owner).then(result=>{
   if(cancelled)return;
   onSaved(result);
   dispatch({type:'completionAccepted'});
  }).catch((error:unknown)=>{
   if(cancelled)return;
   if(error instanceof ApiError&&error.code==='SESSION_CHANGED'){onSessionChanged();return;}
   dispatch({type:'completionFailed',message:error instanceof Error?error.message:'Не удалось сохранить прохождение.'});
   if(error instanceof ApiError&&error.status===401)onUnauthorized();
  }).finally(()=>{inFlight.current=false;});
  return()=>{cancelled=true;};
 },[state.status,state.snapshot,owner,dispatch,onSaved,onUnauthorized,onSessionChanged]);

 const status=state.status==='riding'?(paused?'Поездка на паузе':'Едем к батарее…'):state.status==='arrived-pending'?'Цель достигнута. Сохраняем на сервере…':state.status==='save-error'?`Цель достигнута, но прохождение не подтверждено. ${state.error}`:state.status==='completed'?'Прохождение подтверждено сервером. Трасса сохранена.':state.validation.explanation;
 const tone=toneOf(state);const pretty=prettyFunction(state.level,state.raw);
 return <div ref={layout} className={styles.gameLayout}>
 <aside className={styles.sidebar}>
  <button className={styles.episodeButton} onClick={onEpisodePicker}><span className={styles.eyebrow}>{state.level.episodeId==='linear'?'ЭПИЗОД 1':'ЭПИЗОД 2'}</span><strong>{state.level.episodeId==='linear'?'Линейный путь':'Параболический путь'}</strong><Icon name="right" size={18} className={styles.episodeChevron}/></button>
  <p className={styles.levelPill}><b>{state.level.id}</b>{!!episodeLevels.length&&<span>из {episodeLevels.length}</span>}</p>
  {!!episodeLevels.length&&<ol className={styles.progressDots} aria-label="Прогресс эпизода">{episodeLevels.map(level=><li key={level.id} data-completed={level.completed} data-unlocked={level.unlocked} aria-current={level.id===state.level.id?'step':undefined} title={`${level.id} · ${level.completed?'пройдено':level.unlocked?'доступно':'закрыто'}`}><span className="sr-only">{level.id}{level.completed?' пройдено':''}</span></li>)}</ol>}
  <nav aria-label="Навигация трассы">
   <button aria-label="Предыдущий уровень" disabled={!previous?.unlocked} onClick={()=>{if(previous?.unlocked)onLevel(previous.id);}}><Icon name="left"/><span>Назад</span></button>
   <button aria-label="Следующий уровень" disabled={!next?.unlocked} onClick={()=>{if(next?.unlocked)onLevel(next.id);}}><Icon name="right"/><span>Дальше</span></button>
   <button aria-label="Все трассы эпизода" onClick={onEpisodes}><Icon name="levels"/><span>Трассы</span></button>
   <button className={styles.homeButton} aria-label="На главную" onClick={onHome}><Icon name="home"/><span>Главная</span></button>
  </nav>
 </aside>
 <main className={styles.gameMain} aria-label="Игровая трасса"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>ТРАССА {state.level.id}</p><h1>{state.level.title}</h1></div><div className={styles.tabs}><button aria-pressed={!theory} onClick={()=>setTheory(false)}><Icon name="graph" size={18}/>Игра</button><button aria-pressed={theory} onClick={()=>setTheory(true)}><Icon name="book" size={18}/>Теория</button></div><button className={styles.menuButton} onClick={openMenu} aria-label="☰ Меню трассы" aria-expanded={menu}><Icon name="menu" size={22}/></button></div>
 <section className={styles.task} aria-label="Условие трассы"><span className={styles.taskIcon} aria-hidden="true"><Icon name="target" size={24}/></span><div className={styles.taskBody}><p className={styles.taskGoal}><strong>Цель:</strong> {state.level.goal}</p><p className={styles.taskExplanation}>{state.level.theory.activeCoefficientMeaning}</p><div className={styles.taskMeta}><p className={styles.focus}><Icon name="eye" size={16}/><span><strong>Исследуем:</strong> {state.level.focus}</span></p>{!!state.level.exactConditions?.length&&<p className={styles.exact}><strong>Точные условия:</strong> {state.level.exactConditions.map(p=>`f(${p.x}) = ${p.y}`).join('; ')}. Проверь все точки.</p>}</div></div></section>
 {theory?<TheoryPanel level={state.level} raw={state.raw} onClose={()=>setTheory(false)}/>:<section ref={panel} className={`${styles.graphPanel} ${full?styles.full:''}`} aria-label="Настройка маршрута">
  <div className={styles.boardWrap}><GraphBoard state={state} duration={duration}/><button ref={fullButton} className={styles.fullButton} aria-pressed={full} aria-label={full?'Выйти из полноэкранного режима':'График на весь экран'} title={full?'Свернуть':'На весь экран'} onClick={toggleFull}><Icon name={full?'collapse':'expand'}/></button></div>
  <div className={styles.deck}>
   <div className={styles.deckHead}><div className={styles.formulaBar} aria-label="Формула функции"><CurrentFormula level={state.level} raw={state.raw}/></div><p className={styles.pretty}>{pretty?<>Сейчас: <b>y = {pretty}</b></>:'Допиши число — и формула оживёт'}</p></div>
   <CoefficientControls level={state.level} raw={state.raw} disabled={!state.status.startsWith('editing')} onEdit={(name,raw)=>{setEdits(n=>n+1);dispatch({type:'edit',name,raw});}}/>
  </div>
  <div className={styles.launchRow} data-tone={tone}>
   <span className={styles.launchIcon} aria-hidden="true"><Icon name={tone==='ok'?'check':tone==='ride'?'play':tone==='done'?'spark':'hint'} size={22}/></span>
   <p id="route-status" role="status" data-testid="route-status">{status}</p>
   {state.status!=='completed'&&<button data-coach="launch" className={`primary ${styles.launch}`} onClick={()=>dispatch({type:'launch'})} disabled={state.status!=='editing-valid'} aria-describedby="route-status" aria-label="▶ Пуск"><Icon name="play"/>Пуск</button>}
   {state.status==='save-error'&&<button className="primary" onClick={()=>dispatch({type:'retry'})}>Повторить сохранение</button>}
   {state.status==='completed'&&next&&<button className={`primary ${styles.nextButton}`} disabled={!next.unlocked} onClick={()=>{if(next.unlocked)onLevel(next.id);}}>Следующий уровень →</button>}
   {(allPassed||(state.status==='completed'&&!next))&&<div className={styles.endpoint}>{allPassed&&<strong>Все трассы пройдены</strong>}<button onClick={onEpisodes}>Выбрать уровень</button></div>}
  </div>
 </section>}
 </main><aside className={styles.robotStage} aria-label="Робот-напарник">
  <button className={styles.helpButton} aria-label="Как играть — подсказки робота" aria-pressed={coach} onClick={()=>setCoach(value=>!value)}>?</button>
  {coach?<Coach level={state.level} signals={{edits,ready:state.status==='editing-valid',riding:state.status==='riding'}} root={layout} onClose={closeCoach} paused={paused||full} reducedMotion={reduced}/>:<p className={styles.bubble} aria-hidden="true">{robotLine(state,paused)}</p>}
  <div className={styles.robotSlot}>{robot?.(robotMood(state),!paused,reduced)}</div>
 </aside>
 {menu&&<div className={styles.menuBackdrop} onClick={e=>{if(e.target===e.currentTarget)closeMenu();}}>
  <section className={styles.menu} style={menuAt?{top:menuAt.top,right:menuAt.right}:undefined} role="dialog" aria-modal="true" aria-labelledby="menu-title" onKeyDown={e=>{
   if(e.key==='Escape'){e.preventDefault();closeMenu();}
   if(e.key==='Tab'){
    const buttons=e.currentTarget.querySelectorAll('button');
    const first=buttons[0];const last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  }}>
   <div className={styles.menuHead}><span className={styles.menuPause} aria-hidden="true"><Icon name="pause"/></span><div><h2 id="menu-title">Меню трассы</h2><p>Поездка на паузе. Введённые числа не сбрасываются.</p></div></div>
   <button autoFocus className="primary" onClick={closeMenu}>Продолжить</button>
   <button onClick={()=>{setTheory(true);closeMenu();}}><Icon name="book"/>Открыть теорию</button>
   <button onClick={()=>{setTheory(false);setCoach(true);closeMenu();}}><Icon name="hint"/>Как играть</button>
   <button onClick={onEpisodes}><Icon name="levels"/>Выйти к выбору уровней</button>
   <button onClick={onHome}><Icon name="home"/>На главную</button>
   <small>Выход во время поездки отменит её без зачёта. Можно запустить снова.</small>
  </section>
 </div>}
 </div>;
}
