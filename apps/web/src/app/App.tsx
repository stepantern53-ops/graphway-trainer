import { useCallback,useEffect,useReducer,useRef,useState } from 'react';
import type { CompletionResult,LevelDTO,ProgressDTO,SafeUser,levelListResponseSchema } from '@graphway/contracts';
import type { z } from 'zod';
import { api,ApiError } from './api';
import { AuthScreen } from '../auth/AuthScreen';
import { HomeScreen } from '../home/HomeScreen';
import { EpisodeScreen } from '../episodes/EpisodeScreen';
import { GameScreen } from '../game/GameScreen';
import { createGame,gameReducer,type GameEvent,type GameState } from '../game/game-state';
import { OrientationGate } from '../layout/OrientationGate';
import { usePortrait } from '../layout/orientation';
import Step42Scene from '../robot/Step42Scene';
import { Icon } from './Icon';
import styles from './App.module.css';
function BrandMark(){return <svg className={styles.mark} width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="gw-mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5ee0"/><stop offset="1" stopColor="#4f2a92"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#gw-mark)"/><path d="M13 52V12M13 52h40" stroke="#fff3dc" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round"/><path d="M15 47C25 47 29 23 43 19" fill="none" stroke="#fff3dc" strokeWidth="5" strokeLinecap="round"/><circle cx="15" cy="47" r="4" fill="#4f2a92" stroke="#fff3dc" strokeWidth="2.5"/><circle cx="47" cy="18" r="10" fill="#fffdf8"/><rect x="40.5" y="13.8" width="13" height="8.6" rx="4.3" fill="#1c1530"/><rect x="43.3" y="16" width="2.4" height="4.2" rx="1.2" fill="#b597f2"/><rect x="48.3" y="16" width="2.4" height="4.2" rx="1.2" fill="#b597f2"/></svg>;}
type Route={page:'home'}|{page:'episodes';episodeId:string|null}|{page:'game';id:string};
function readRoute():Route|null{const hash=location.hash.slice(1);const game=/^\/levels\/([LQ](?:0[1-9]|1[0-2]))$/.exec(hash);if(game)return{page:'game',id:game[1]!};if(hash==='/home')return{page:'home'};const episodes=/^\/episodes(?:\/(linear|quadratic))?$/.exec(hash);return episodes?{page:'episodes',episodeId:episodes[1]??null}:null;}
function stateReducer(state:GameState|null,event:GameEvent|{type:'load';level:LevelDTO}|{type:'clear'}){if(event.type==='load')return createGame(event.level);if(event.type==='clear')return null;return state?gameReducer(state,event):null;}
export function App(){
 const [catalog,setCatalog]=useState<z.infer<typeof levelListResponseSchema>['levels']>([]);
 const [user,setUser]=useState<SafeUser|null>(null);const [progress,setProgress]=useState<ProgressDTO|null>(null);const [state,dispatch]=useReducer(stateReducer,null);const [route,setRoute]=useState<Route|null>(readRoute);const [boot,setBoot]=useState(true);const [expired,setExpired]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);const [profile,setProfile]=useState(false);const [attempt,setAttempt]=useState(0);const identity=useRef<string|null>(null);const stateRef=useRef(state);stateRef.current=state;const portrait=usePortrait();
 const profilePanel=useRef<HTMLElement>(null);const profileTrigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!profile)return;
  const trigger=profileTrigger.current;
  profilePanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setProfile(false);}
   if(event.key==='Tab'){
    const buttons=profilePanel.current?.querySelectorAll<HTMLButtonElement>('button');const first=buttons?.[0];const last=buttons?.[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);trigger?.focus();};
 },[profile]);
 const unauthorized=useCallback(()=>{setExpired(true);setUser(null);setProfile(false);},[]);
 const sessionChanged=useCallback(()=>{identity.current=null;setProgress(null);dispatch({type:'clear'});unauthorized();},[unauthorized]);
 const navigate=useCallback((target:Route)=>{const hash=target.page==='home'?'/home':target.page==='game'?`/levels/${target.id}`:`/episodes${target.episodeId?`/${target.episodeId}`:''}`;if(location.hash!==`#${hash}`)location.hash=hash;else setRoute(target);},[]);
 useEffect(()=>{const change=()=>{const next=readRoute()??{page:'home' as const};const current=stateRef.current;if(current&&(next.page!=='game'||next.id!==current.level.id))dispatch({type:'exit'});setError(null);setRoute(next);};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 useEffect(()=>{let alive=true;setBoot(true);void api.me().then(result=>{if(!alive)return;if(identity.current&&identity.current!==result.user.id)dispatch({type:'clear'});identity.current=result.user.id;setUser(result.user);setProgress(result.progress);if(!readRoute())navigate({page:'game',id:result.progress.currentLevelId});}).catch((error:unknown)=>{if(alive&&!(error instanceof ApiError&&error.status===401))setError(error instanceof Error?error.message:'Не удалось подключиться к серверу.');}).finally(()=>{if(alive)setBoot(false);});return()=>{alive=false;};},[attempt,navigate]);
 useEffect(()=>{
  // The new route owns the loading flag; cancelled predecessors cannot clear it.
  if(!user||route?.page!=='game'){
   setLoading(false);
   return;
  }
  let cancelled=false;
  const owner=user.id;
  setError(null);
  setLoading(true);
  void (async()=>{
   try {
    const [level,episodes]=await Promise.all([api.level(route.id),api.episodes()]);
    const lists=await Promise.all(episodes.episodes.map(episode=>api.levels(episode.id)));
    if(cancelled||identity.current!==owner)return;
    setCatalog(lists.flatMap(list=>list.levels));
    if(stateRef.current?.level.id!==level.id)dispatch({type:'load',level});
    const next=await api.current(level.id,level.version,owner);
    if(!cancelled&&identity.current===owner)setProgress(next);
   } catch(error) {
    if(cancelled||identity.current!==owner)return;
    if(error instanceof ApiError&&error.code==='SESSION_CHANGED'){sessionChanged();return;}
    setError(error instanceof Error?error.message:'Трасса недоступна.');
    if(error instanceof ApiError&&error.status===401)unauthorized();
   } finally {
    if(!cancelled)setLoading(false);
   }
  })();
  return()=>{cancelled=true;};
 },[user,route,attempt,unauthorized,sessionChanged]);
 const saved=useCallback((result:CompletionResult)=>setProgress(result.progress),[]);
 const authenticated=(nextUser:SafeUser,nextProgress:ProgressDTO,registered:boolean)=>{const same=identity.current===nextUser.id;identity.current=nextUser.id;if(!same)dispatch({type:'clear'});setUser(nextUser);setProgress(nextProgress);setExpired(false);setError(null);if(!same||!route)navigate({page:'game',id:registered?'L01':nextProgress.currentLevelId});};
 const logout=async()=>{
  setError(null);
  try {
   if(!user)return;
   await api.logout(user.id);
  } catch(error) {
   if(error instanceof ApiError&&error.code==='SESSION_CHANGED'){sessionChanged();return;}
   if(!(error instanceof ApiError&&error.status===401)){
    setError(error instanceof Error?error.message:'Не удалось выйти.');
    return;
   }
  }
  identity.current=null;
  setUser(null);
  setProgress(null);
  dispatch({type:'clear'});
  setProfile(false);
  setExpired(false);
  location.hash='';
  setRoute(null);
 };
 const home=()=>navigate({page:'home'});const episodes=()=>navigate({page:'episodes',episodeId:null});
 const activeGame=route?.page==='game'&&state?.level.id===route.id;
 const catalogIndex=state?catalog.findIndex(level=>level.id===state.level.id):-1;
 const previous=catalogIndex>0?catalog[catalogIndex-1]??null:null;
 const next=catalogIndex>=0?catalog[catalogIndex+1]??null:null;
 return <OrientationGate portrait={portrait}><div className={styles.app}><header className={styles.header}><button className={styles.brand} onClick={home} aria-label="GraphWay - главная"><BrandMark/>GraphWay</button>{user&&<><span className={styles.headerProgress}><Icon name="check" size={14}/>{progress?.completedCount??0} / {progress?.totalCount??24} трасс</span><button ref={profileTrigger} className={styles.profileButton} aria-expanded={profile} aria-haspopup="dialog" aria-label={`◎ ${user.nickname}`} onClick={()=>setProfile(v=>!v)}><span className={styles.avatar} aria-hidden="true">{Array.from(user.nickname)[0]?.toUpperCase()}</span><span className={styles.nick}>{user.nickname}</span></button></>}</header>
 {profile&&user&&<section ref={profilePanel} role="dialog" className={styles.profile} aria-label="Профиль"><div className={styles.profileHead}><span className={styles.avatarBig} aria-hidden="true">{Array.from(user.nickname)[0]?.toUpperCase()}</span><div><h2>{user.nickname}</h2><p>{user.role==='admin'?'Администратор · все трассы открыты':'Исследователь функций'}</p></div></div><div className={styles.profileStat}><span className={styles.profileBar}><i style={{width:`${progress&&progress.totalCount?Math.round(progress.completedCount/progress.totalCount*100):0}%`}}/></span><p>Пройдено {progress?.completedCount} из {progress?.totalCount}</p></div><button onClick={()=>{setProfile(false);home();}}><Icon name="home"/>На главную</button><button onClick={()=>void logout()}><Icon name="logout"/>Выйти из аккаунта</button><button className={styles.profileClose} onClick={()=>setProfile(false)}>Закрыть профиль</button></section>}
 {boot ? <main className={styles.message} role="status">Подключаемся к GraphWay…</main>
 : !user ? <>
   {error && <div className={styles.message} role="alert">
    <p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>Повторить подключение</button>
   </div>}
   <AuthScreen onSuccess={authenticated} expired={expired}/>
  </>
 : <>
   {error && <div className={styles.message} role="alert">
    <p>{error}</p>
    <button onClick={()=>setAttempt(n=>n+1)}>Повторить</button>
    <button onClick={episodes}>Выбрать доступную трассу</button>
   </div>}
   {loading ? <main className={styles.message} role="status">Загружаем трассу…</main>
   : route?.page==='game' ? activeGame && state && !error && (
    <GameScreen
     key={`${user.id}-${state.level.id}`}
     state={state}
     owner={user.id}
     dispatch={dispatch}
     portrait={portrait||profile}
     onSaved={saved}
     onUnauthorized={unauthorized}
     onSessionChanged={sessionChanged}
     onHome={home}
     onEpisodes={()=>navigate({page:'episodes',episodeId:state.level.episodeId})}
     onEpisodePicker={episodes}
     previous={previous?{id:previous.id,unlocked:progress?.unlockedLevelIds.includes(previous.id)??false}:null}
     next={next?{id:next.id,unlocked:progress?.unlockedLevelIds.includes(next.id)??false}:null}
     allPassed={!next&&catalogIndex>=0&&!!progress&&progress.completedCount===progress.totalCount}
     onLevel={id=>navigate({page:'game',id})}
     episodeLevels={catalog.filter(level=>level.id.startsWith(state.level.episodeId==='linear'?'L':'Q')).map(level=>({id:level.id,completed:progress?.completedLevelIds.includes(level.id)??false,unlocked:progress?.unlockedLevelIds.includes(level.id)??false}))}
     robot={(mood,active,reducedMotion)=><Step42Scene mood={mood} active={active} reducedMotion={reducedMotion}/>}
    />
   )
   : route?.page==='episodes' ? <EpisodeScreen
     episodeId={route.episodeId}
     onSelect={episodeId=>navigate({page:'episodes',episodeId})}
     onOpen={id=>navigate({page:'game',id})}
     onBack={route.episodeId?episodes:home}
     onUnauthorized={unauthorized}
    />
   : progress && <HomeScreen
     key={user.id}
     user={user}
     progress={progress}
     onEpisodes={episodes}
     onNext={()=>{if(progress.nextLevelId)navigate({page:'game',id:progress.nextLevelId});}}
     onEpisode={episodeId=>navigate({page:'episodes',episodeId})}
     onUnauthorized={unauthorized}
     robot={<Step42Scene mood="idle" active={!portrait&&!profile}/>}
    />
   }
  </>}
 <footer className={styles.footer}>GraphWay <span>Исследуй. Пробуй. Находи свой путь.</span></footer></div></OrientationGate>;
}
