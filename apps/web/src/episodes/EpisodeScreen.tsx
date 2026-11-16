import { useEffect,useRef,useState } from 'react';
import type { z } from 'zod';
import type { episodesResponseSchema,levelListResponseSchema } from '@graphway/contracts';
import { api,ApiError } from '../app/api';
import { Formula } from '../game/TheoryPanel';
import { Icon } from '../app/Icon';
import styles from './Episodes.module.css';
export function EpisodeScreen({episodeId,onSelect,onOpen,onBack,onUnauthorized}:{episodeId:string|null;onSelect:(id:string)=>void;onOpen:(id:string)=>void;onBack:()=>void;onUnauthorized:()=>void}){
 const [episodes,setEpisodes]=useState<z.infer<typeof episodesResponseSchema>['episodes']>([]);
 const [levels,setLevels]=useState<z.infer<typeof levelListResponseSchema>['levels']>([]);
 const [selected,setSelected]=useState(0);
 const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const [attempt,setAttempt]=useState(0);
 const swipe=useRef<{x:number;y:number;id:number}|null>(null);
 const swiped=useRef(false);
 useEffect(()=>{let active=true;setLoading(true);setError(null);void (async()=>{
  try{if(episodeId){const data=await api.levels(episodeId);if(active)setLevels(data.levels);}else{const data=await api.episodes();if(active)setEpisodes(data.episodes);}}
  catch(error){if(active){setError(error instanceof Error?error.message:'Не удалось загрузить каталог.');if(error instanceof ApiError&&error.status===401)onUnauthorized();}}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[episodeId,attempt,onUnauthorized]);
 const current=episodes[selected];
 return <main className={styles.screen}>
  <button className={styles.back} onClick={onBack}><Icon name="left" size={18}/>{episodeId?'Все эпизоды':'На главную'}</button>
  <p className={styles.eyebrow}>{episodeId?'ВЫБОР ТРАССЫ':'ДВА СПОСОБА УВИДЕТЬ ФУНКЦИЮ'}</p>
  <h1>{episodeId?(episodeId==='linear'?'Линейный путь':'Параболический путь'):'Выбери эпизод'}</h1>{episodeId&&!loading&&!error&&levels.length>0&&<p className={styles.summary}><span className={styles.bar}><i style={{width:`${Math.round(levels.filter(l=>l.completed).length/levels.length*100)}%`}}/></span>Пройдено <b>{levels.filter(l=>l.completed).length} из {levels.length}</b></p>}
  {loading&&<p role="status">Загружаем учебную карту…</p>}
  {error&&<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>Повторить загрузку</button></div>}
  {!loading&&!error&&(episodeId?<div className={styles.levels}>{levels.map(level=><button key={level.id} className={`${styles.level} ${level.completed?styles.levelDone:level.unlocked?(level.id===levels.find(l=>l.unlocked&&!l.completed)?.id?styles.levelCurrent:styles.levelOpen):styles.levelLocked}`} disabled={!level.unlocked} onClick={()=>onOpen(level.id)}><span className={styles.levelArt} aria-hidden="true"><svg viewBox="0 0 160 70"><path d="M0 46H160M50 0V70" className={styles.levelAxis}/><path d={level.id.startsWith('Q')?'M18 14Q80 100 142 14':'M18 58L142 12'} className={styles.levelCurve}/></svg></span><span className={styles.levelTop}><span className={styles.levelNumber}>{level.id}</span><span className={styles.levelStatus}>{level.completed?<><Icon name="check" size={13}/>Пройдено</>:level.unlocked?(level.id===levels.find(l=>l.unlocked&&!l.completed)?.id?<><Icon name="play" size={13}/>Следующая</>:'Доступно'):<><Icon name="lock" size={13}/>Закрыто</>}</span></span><strong>{level.title}</strong><small>{level.focus}</small>{!level.unlocked&&<small className={styles.lockHint}>Пройди предыдущую трассу</small>}</button>)}</div>:
   <section className={styles.carousel} role="region" aria-roledescription="карусель" aria-label="Эпизоды" tabIndex={0}
    onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setSelected(index=>Math.max(0,Math.min(episodes.length-1,index+(event.key==='ArrowRight'?1:-1))));}}}
    onPointerDown={event=>{if(event.isPrimary===false||swipe.current)return;swiped.current=false;swipe.current={x:event.clientX,y:event.clientY,id:event.pointerId};}}
    onPointerMove={event=>{const start=swipe.current;if(start&&Math.abs(event.clientX-start.x)>12&&Math.abs(event.clientX-start.x)>Math.abs(event.clientY-start.y))event.currentTarget.setPointerCapture?.(event.pointerId);}}
    onPointerCancel={()=>{swipe.current=null;}}
    onPointerUp={event=>{const start=swipe.current;swipe.current=null;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)){swiped.current=true;setSelected(index=>Math.max(0,Math.min(episodes.length-1,index+(dx<0?1:-1))));}}}
    onClickCapture={event=>{if(swiped.current&&event.detail!==0){swiped.current=false;event.preventDefault();event.stopPropagation();}}}
   >
    <div className={styles.carouselWindow}><div className={styles.episodeTrack} style={{transform:`translateX(calc(50% - var(--card-width) / 2 - ${selected} * (var(--card-width) + var(--card-gap))))`}}>
     {episodes.map((episode,index)=><button key={episode.id} className={styles.episode} aria-pressed={selected===index} aria-label={`Эпизод ${index+1}: ${episode.title}`} onClick={()=>{if(selected===index&&episode.unlocked)onSelect(episode.id);else setSelected(index);}}>
      <span className={styles.badge}>Эпизод {index+1}</span><h2>{episode.title}</h2>
      <svg viewBox="0 0 400 180" aria-hidden="true"><path className={styles.artGrid} d="M0 45H400M0 90H400M0 135H400M100 0V180M200 0V180M300 0V180"/><path className={styles.artCurve} d={episode.id==='linear'?'M30 150L370 30':'M30 20Q200 300 370 20'}/></svg>
      <Formula tex={episode.id==='linear'?'y=kx+b':'y=ax^2+bx+c'}/><p className={styles.cardProgress}><span className={styles.bar}><i style={{width:`${episode.totalCount?Math.round(episode.completedCount/episode.totalCount*100):0}%`}}/></span>{episode.completedCount} из {episode.totalCount} пройдено</p><span className={episode.unlocked?styles.status:styles.lock}>{episode.unlocked?'Доступен':<><Icon name="lock" size={15}/>Закрыто · сначала пройди L12</>}</span>
     </button>)}
    </div></div>
    <div className={styles.carouselControls}>
     <button aria-label="Предыдущий эпизод" disabled={selected===0} onClick={()=>setSelected(index=>Math.max(0,index-1))}><Icon name="left" size={24}/></button>
     <span aria-live="polite">{selected+1} / {episodes.length}</span>
     <button aria-label="Следующий эпизод" disabled={selected===episodes.length-1} onClick={()=>setSelected(index=>Math.min(episodes.length-1,index+1))}><Icon name="right" size={24}/></button>
    </div>
    <button className="primary" disabled={!current?.unlocked} onClick={()=>{if(current?.unlocked)onSelect(current.id);}}>Открыть трассы</button>
    <p className={styles.carouselHint}>{current?.unlocked?'Выбери карточку, используй стрелки или свайп.':'Можно рассмотреть эпизод. Трассы откроются после L12.'}</p>
   </section>)}
 </main>;
}
