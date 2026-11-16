import { useEffect,useState,type ReactNode } from 'react';
import type { ProgressDTO,SafeUser,episodesResponseSchema,levelListResponseSchema } from '@graphway/contracts';
import type { z } from 'zod';
import { api,ApiError } from '../app/api';
import { Icon } from '../app/Icon';
import styles from './Home.module.css';
type Episode=z.infer<typeof episodesResponseSchema>['episodes'][number];
type Level=z.infer<typeof levelListResponseSchema>['levels'][number];
/** Главная: для кого тренажёр, как играть, реальный подтверждённый прогресс и прямой переход к следующей трассе. */
export function HomeScreen({user,progress,onEpisodes,onNext,onEpisode,onUnauthorized,robot}:{user:SafeUser;progress:ProgressDTO;onEpisodes:()=>void;onNext:()=>void;onEpisode?:(id:string)=>void;onUnauthorized:()=>void;robot?:ReactNode}){
 const [episodes,setEpisodes]=useState<Episode[]>([]);
 const [levels,setLevels]=useState<Record<string,Level[]>>({});
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{let alive=true;setError(null);void (async()=>{
  try{const data=await api.episodes();if(!alive)return;setEpisodes(data.episodes);
   const lists=await Promise.all(data.episodes.map(async episode=>[episode.id,(await api.levels(episode.id)).levels] as const));
   if(alive)setLevels(Object.fromEntries(lists));}
  catch(error:unknown){if(!alive)return;setError(error instanceof Error?error.message:'Не удалось загрузить учебную карту.');if(error instanceof ApiError&&error.status===401)onUnauthorized();}
 })();return()=>{alive=false;};},[user.id,progress.completedCount,onUnauthorized]);
 const share=progress.totalCount?progress.completedCount/progress.totalCount:0;
 const next=progress.nextLevelId?Object.values(levels).flat().find(level=>level.id===progress.nextLevelId):undefined;
 const initial=Array.from(user.nickname)[0]?.toUpperCase();
 return <main className={styles.home}>
  {error&&<p role="alert">{error} Можно повторить загрузку через выбор эпизода.</p>}
  <div className={styles.hero}>
   <section className={styles.heroText}>
    <p className={styles.hello}><span className={styles.avatar} aria-hidden="true">{initial}</span><span>Привет, <b>{user.nickname}</b>!</span></p>
    <h1>Проложи роботу дорогу <span className={styles.mark}>графиком</span></h1>
    <p className={styles.lead}>Тренажёр функций для 7–9 класса. Меняй коэффициенты — график меняется сразу. Соедини старт с батареей и не задень ямы.</p>
    <ol className={styles.steps} aria-label="Как играть">
     <li><span className={styles.stepIcon} aria-hidden="true"><Icon name="slider"/></span><span><b>Меняй коэффициенты</b><small>k и b у прямой, a, b, c у параболы</small></span></li>
     <li><span className={styles.stepIcon} aria-hidden="true"><Icon name="target"/></span><span><b>Соедини старт и батарею</b><small>график не должен задеть яму</small></span></li>
     <li><span className={styles.stepIcon} aria-hidden="true"><Icon name="play"/></span><span><b>Жми «Пуск»</b><small>робот поедет по твоему графику</small></span></li>
    </ol>
   </section>
   <aside className={styles.stage} aria-label="Робот-напарник">
    <svg className={styles.route} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className={styles.routeAll} d="M30 90C50 89 58 62 66 47S79 26 85 21" vectorEffect="non-scaling-stroke"/><path className={styles.routeDone} d="M30 90C50 89 58 62 66 47S79 26 85 21" pathLength={100} vectorEffect="non-scaling-stroke" style={{strokeDasharray:`${Math.max(.5,share*100).toFixed(1)} 100`}}/></svg>
    <span className={styles.battery} aria-hidden="true"><svg viewBox="-27 -27 54 54"><circle r="25"/><rect x="-8" y="-13" width="16" height="26" rx="3.5" className={styles.batteryBody}/><rect x="-4" y="-17" width="8" height="4" rx="1.5" className={styles.batteryCap}/><rect x="-5" y={(10-20*Math.max(.15,share)).toFixed(1)} width="10" height={(20*Math.max(.15,share)).toFixed(1)} rx="1.5" className={styles.batteryFill}/></svg></span>
    <span className={`${styles.chip} ${styles.chip1}`} aria-hidden="true"><i>y</i> = <i>kx</i> + <i>b</i></span>
    <span className={`${styles.chip} ${styles.chip2}`} aria-hidden="true"><i>y</i> = <i>ax</i>² + <i>bx</i> + <i>c</i></span>
    <div className={styles.robot}>{robot}</div>
   </aside>
  </div>
  <div className={styles.cards}>
   <section className={styles.episodes} aria-labelledby="home-episodes">
    <div className={styles.episodesHead}>
     <div className={styles.stat}><svg className={styles.ring} viewBox="0 0 48 48" aria-hidden="true"><circle className={styles.ringBg} cx="24" cy="24" r="20"/><circle className={styles.ringFg} cx="24" cy="24" r="20" pathLength={100} style={{strokeDasharray:`${(share*100).toFixed(1)} 100`}}/></svg><div><strong>Пройдено {progress.completedCount} из {progress.totalCount}</strong><small id="home-episodes">подтверждённых трасс</small></div></div>
     <button className={styles.allEpisodes} onClick={onEpisodes} aria-label="▶ Выбрать эпизод">Выбрать эпизод<Icon name="right" size={18}/></button>
    </div>
    {episodes.map(episode=><button key={episode.id} className={styles.episodeRow} disabled={!episode.unlocked} onClick={()=>episode.unlocked&&(onEpisode?onEpisode(episode.id):onEpisodes())}>
     <span className={styles.episodeIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d={episode.id==='linear'?'M4 19L20 5':'M4 4Q12 30 20 4'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg></span>
     <span className={styles.episodeName}><b>{episode.title}</b><small>{episode.unlocked?`${episode.completedCount} из ${episode.totalCount} пройдено`:'Откроется после последней трассы эпизода 1'}</small></span>
     <span className={styles.segments} aria-hidden="true">{(levels[episode.id]??[]).map(level=><i key={level.id} className={level.completed?styles.done:level.unlocked?styles.open:''}/>)}</span>
     <Icon name={episode.unlocked?'right':'lock'} size={18} className={styles.episodeGo}/>
    </button>)}
   </section>
   <button className={styles.nextCard} onClick={progress.nextLevelId?onNext:onEpisodes} aria-label={progress.nextLevelId?'» Следующий уровень':'↻ Повторить трассу'}>
    <span className={styles.nextArt} aria-hidden="true"><svg viewBox="0 0 160 90"><path d="M0 60H160M60 0V90" stroke="rgba(255,243,220,.18)" strokeWidth="1.2"/><path d={next?.id.startsWith('Q')?'M18 22Q80 120 142 22':'M18 74L142 18'} fill="none" stroke="#cdb6ff" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 7"/><circle cx="18" cy={next?.id.startsWith('Q')?22:74} r="8" fill="rgba(181,151,242,.3)" stroke="#b597f2" strokeWidth="2.5"/><circle cx="142" cy={next?.id.startsWith('Q')?22:18} r="8" fill="rgba(255,243,220,.15)" stroke="#fff3dc" strokeWidth="2.5"/></svg></span>
    <span className={styles.nextText}><small>{progress.nextLevelId?'Следующий уровень':'Вся карта пройдена'}</small><b>{progress.nextLevelId?(next?`${next.id} · ${next.title}`:progress.nextLevelId):'Повторить трассу'}</b>{next&&<span>{next.focus}</span>}</span>
    <span className={styles.nextGo} aria-hidden="true"><Icon name="play" size={24}/></span>
   </button>
  </div>
 </main>;
}
