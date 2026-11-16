import katex from 'katex';
import type { LevelDTO } from '@graphway/contracts';
import { useId,useState } from 'react';
import { Icon } from '../app/Icon';
import { formulaTex,roleOf } from './presentation';
import { functionPolynomial,parseCoefficient,rationalToNumber } from '@graphway/math-core';
import type { CoefficientName,NumericCoefficients } from '@graphway/math-core';
import type { RawFields } from './game-state';
import styles from './Game.module.css';
export function Formula({tex,block=false}:{tex:string;block?:boolean}){
 return <span className={styles.formula} dangerouslySetInnerHTML={{__html:katex.renderToString(tex,{displayMode:block,throwOnError:false,trust:false,strict:'error',output:'htmlAndMathml'})}}/>;
}
function TheoryGraph({polynomial,numeric,role}:{polynomial:readonly number[]|null;numeric:NumericCoefficients|null;role:'shape'|'height'|'axis'}){
 const clip=useId().replaceAll(':','');
 const y=(x:number)=>polynomial!.reduceRight((sum,value)=>sum*x+value,0);
 const path=polynomial?Array.from({length:101},(_,i)=>{const x=-5+i/10;return `${i?'L':'M'}${x},${-Math.max(-40,Math.min(40,y(x)))}`;}).join(' '):null;
 const intercept=numeric?(numeric.c??numeric.b??0):0;
 const vertex=numeric?.a?-(numeric.b??0)/(2*numeric.a):null;
 return <svg className={styles.theoryMini} viewBox="-5 -7 10 12" preserveAspectRatio="xMidYMid meet" role="img" aria-label={polynomial?'Иллюстрация твоей текущей функции':'Допиши коэффициенты, чтобы увидеть иллюстрацию'}><defs><clipPath id={clip}><rect x="-5" y="-7" width="10" height="12"/></clipPath></defs>{Array.from({length:11},(_,i)=>i-5).map(n=><g key={n}><path className={styles.miniGrid} d={`M${n} -7V5M-5 ${n}H5`}/></g>)}<path className={styles.miniAxis} d="M-5 0H5M0 -7V5"/><g clipPath={`url(#${clip})`}>{path&&<path data-testid="theory-current-curve" className={styles.miniCurve} d={path}/>} {numeric&&polynomial&&role==='height'&&<circle className={styles.miniPoint} cx="0" cy={-intercept} r=".18"/>}{numeric&&polynomial&&role==='shape'&&numeric.k!==undefined&&<path className={styles.miniGuide} d={`M0 ${-intercept}H1V${-(intercept+numeric.k)}`}/>} {polynomial&&vertex!==null&&role==='axis'&&<><path className={styles.miniGuide} d={`M${vertex} -7V5`}/><circle className={styles.miniPoint} cx={vertex} cy={-y(vertex)} r=".18"/></>}</g></svg>;
}
export function TheoryPanel({level,raw=level.initial,onClose}:{level:LevelDTO;raw?:RawFields;onClose:()=>void}){
 const lesson=level.theory;const family=level.functionSpec.family;
 const [step,setStep]=useState(0);const total=lesson.example.steps.length+1;
 const names=family==='linear'?['k','b'] as const:['a','b','c'] as const;
 const values:Partial<Record<CoefficientName,number>>={};let valid=true;
 for(const name of names){const value=level.controls.some(control=>control.name===name)?raw[name]??'':String(level.fixed?.[name]??'');const parsed=parseCoefficient(value,level.bounds?.[name]??{min:-6,max:6,...(name==='a'?{minAbs:'1/8'}:{})});if(parsed.status!=='valid'){valid=false;break;}values[name]=parsed.numeric;}
 const numeric=valid?values:null;const polynomial=numeric?functionPolynomial(level.functionSpec,numeric).map(rationalToNumber):null;
 return <section className={styles.theory} aria-labelledby="theory-title">
  <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>ТЕОРИЯ · {level.id}</p><h2 id="theory-title">{family==='linear'?'Линейная функция':'Квадратичная функция'}</h2></div><button className={styles.theoryBack} onClick={onClose}><Icon name="left" size={18}/>Вернуться к графику</button></div>
  <div className={styles.theoryGrid}>
   <article className={`${styles.theoryCard} ${styles.theoryTint}`}><p className={styles.cardEyebrow}>Формула</p><h3>Цвет = роль коэффициента</h3><Formula tex={family==='linear'?formulaTex('linear'):`${formulaTex('quadratic')},\\quad a\\ne0`} block/><p>{family==='linear'?'Тёмный k отвечает за наклон, фиолетовый b — за высоту: где прямая пересекает ось y.':'a — ветви и ширина, b — ось и вершина, c — высота на оси y (c = f(0)).'}</p></article>
   <article className={styles.theoryCard}><p className={styles.cardEyebrow}>Фокус исследования</p><h3>{lesson.focus}</h3><p>{lesson.activeCoefficientMeaning}</p><p className={styles.muted}>{lesson.fixedCoefficientMeaning}</p></article>
   <article className={`${styles.theoryCard} ${styles.theoryWide}`}><p className={styles.cardEyebrow}>Твоя функция в картинках</p><p className={styles.muted}>Иллюстрации следуют твоим текущим числам — это не готовый ответ. {valid?'Цвет связывает коэффициент, формулу и график.':'Допиши число: старый график не показывается.'}</p><div className={styles.theoryVisuals}>{names.map(name=>{const role=roleOf(family,name);const fixed=!level.controls.some(control=>control.name===name);return <div className={styles.theoryVisual} key={name}><TheoryGraph polynomial={polynomial} numeric={numeric} role={role}/><div><span className={`${styles.coefficient} ${styles[`role_${role}`]}`}>{name}</span><strong>{fixed?String(level.fixed?.[name]??''):raw[name]||'…'}</strong><small>{role==='shape'?(family==='linear'?'Наклон':'Ветви и ширина'):role==='height'?'Высота на оси y':'Ось и вершина'}</small></div></div>;})}</div></article>
   <article className={`${styles.theoryCard} ${styles.theoryWide}`}><p className={styles.cardEyebrow}>Как это устроено</p>{lesson.blocks.map((block,i)=>block.kind==='formula'?<Formula key={i} tex={block.content} block/>:<p key={i}>{block.content}</p>)}</article>
   <article className={`${styles.theoryCard} ${styles.theoryWide} ${styles.example}`}><p className={styles.cardEyebrow}>Разберём другой пример</p><h3>{lesson.example.prompt}</h3>
    <ol className={styles.steps}>{lesson.example.steps.map((text,i)=><li key={i} className={`${i<step?styles.stepOn:''} ${i===step-1?styles.stepNow:''}`}><span className={styles.stepNo}>{i+1}</span><span>{text}</span></li>)}</ol>
    <h4>Проверка подстановкой</h4><p className={step>=total-1?styles.checkOn:styles.checkOff}>{lesson.example.check}</p>
    <div className={styles.stepControls}><button onClick={()=>setStep(n=>Math.max(0,n-1))} disabled={step===0}>Назад</button><button className="primary" onClick={()=>setStep(n=>n>=total-1?0:n+1)}>{step>=total-1?'Сначала':'Дальше'}</button><span className={styles.pips} aria-hidden="true">{Array.from({length:total},(_,i)=><i key={i} className={i<step?styles.pipOn:''}/>)}</span></div>
   </article>
  </div>
  <div className={styles.theoryFoot}><span>Теория не меняет твои поля. Можно пробовать разные маршруты без штрафов.</span><button className="primary" onClick={onClose}>Попробовать на трассе<Icon name="right" size={18}/></button></div>
 </section>;
}
