import type React from 'react';
import { parseCoefficient } from '@graphway/math-core';
import type { CoefficientName } from '@graphway/math-core';
import type { LevelDTO } from '@graphway/contracts';
import type { RawFields } from './game-state';
import { roleOf } from './presentation';
import styles from './Game.module.css';
const TICKS=[-4,-3,-2,-1,0,1,2,3,4];
export function CoefficientControls({level,raw,disabled,onEdit}:{level:LevelDTO;raw:RawFields;disabled:boolean;onEdit:(name:CoefficientName,raw:string)=>void}){
 const names=level.functionSpec.family==='linear'?['k','b'] as const:['a','b','c'] as const;
 return <fieldset className={styles.controls} disabled={disabled} data-coach="controls"><legend>Коэффициенты функции</legend>
 {names.map(name=>{
  const control=level.controls.find(item=>item.name===name);
  const fixed=!control;
  const value=fixed?String(level.fixed?.[name]??''):raw[name]??'';
  const parsed=parseCoefficient(value,level.bounds?.[name]??{min:-6,max:6,...(name==='a'?{minAbs:'1/8'}:{})});
  const role=roleOf(level.functionSpec.family,name);
  const sliderValue=parsed.status==='valid'?Math.max(-4,Math.min(4,parsed.numeric)):0;
  return <div className={`${styles.control} ${fixed?styles.controlFixed:styles.controlActive}`} key={name} data-coach={control&&level.controls[0]?.name===name?'control':undefined}>
   <label htmlFor={`coefficient-${name}`} className={`${styles.coefficient} ${styles[`role_${role}`]}`}>{name}</label>
   <input id={`coefficient-${name}`} type="text" inputMode="text" autoComplete="off" spellCheck={false} maxLength={32} value={value} readOnly={fixed} aria-readonly={fixed} aria-invalid={!fixed&&parsed.status!=='valid'} aria-describedby={`help-${name}`} onChange={event=>{if(!fixed)onEdit(name,event.target.value);}}/>
   <small id={`help-${name}`} className={styles.inputHelp}>{fixed?'Фиксировано':parsed.status==='valid'?(name==='a'?'−6…6 · |a| ≥ 1/8':'−6…6 · дроби и запятая'):parsed.explanation}</small>
   {control?.mode==='slider-input'&&<span className={`${styles.rangeBox} ${styles[`role_${role}`]}`}><input className={styles.slider} type="range" aria-label={`Ползунок ${name}`} min={-4} max={4} step={0.01} value={sliderValue} style={{'--p':`${(sliderValue+4)/8*100}%`} as React.CSSProperties} onChange={event=>onEdit(name,event.target.value)}/><span className={styles.ticks} aria-hidden="true">{TICKS.map(t=><i key={t} className={`${t===0?styles.tickZero:''} ${parsed.status==='valid'&&parsed.numeric===t?styles.tickOn:''}`} style={{left:`${(t+4)/8*100}%`}}>{t%2===0?<b>{String(t).replace('-','−')}</b>:null}</i>)}</span></span>}
  </div>;
 })}
 <p className={styles.controlHint}>Дробь −3/2 или число 0,5 — без округления.</p>
 </fieldset>;
}

export function CurrentFormula({level,raw}:{level:LevelDTO;raw:RawFields}){
 const names=level.functionSpec.family==='linear'?['k','b'] as const:['a','b','c'] as const;
 return <span className={styles.currentFormula} aria-label="Текущие коэффициенты функции"><i>y</i><span>=</span>{names.map((name,index)=>{
  const fixed=!level.controls.some(control=>control.name===name);
  const value=fixed?String(level.fixed?.[name]??''):raw[name]??'';
  const valid=parseCoefficient(value,level.bounds?.[name]??{min:-6,max:6,...(name==='a'?{minAbs:'1/8'}:{})}).status==='valid';
  const power=level.functionSpec.family==='linear'?(name==='k'?'x':''):(name==='a'?'x²':name==='b'?'x':'');
  return <span key={name} className={styles.formulaTerm}>{index>0&&<span>+</span>}<span className={`${styles.valueChip} ${styles[`role_${roleOf(level.functionSpec.family,name)}`]}`} data-valid={valid}><small>{name}</small><b>{value||'…'}</b></span>{power&&<i>{power}</i>}</span>;
 })}</span>;
}
