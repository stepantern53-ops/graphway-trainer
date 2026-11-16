import { validateRoute } from '@graphway/math-core';
import type { CoefficientName, Route, NumericCoefficients, RouteValidation } from '@graphway/math-core';
import type { LevelDTO } from '@graphway/contracts';
export type RawFields=Partial<Record<CoefficientName,string>>;
export interface Snapshot {readonly coefficients:Readonly<RawFields>;readonly numeric:NumericCoefficients;readonly route:Route;readonly curriculumVersion:string;readonly levelId:string}
export interface GameState {level:LevelDTO;raw:RawFields;validation:RouteValidation;status:'editing-invalid'|'editing-valid'|'riding'|'arrived-pending'|'completed'|'save-error';snapshot:Snapshot|null;elapsed:number;error:string|null}
export type GameEvent={type:'edit';name:CoefficientName;raw:string}|{type:'launch'}|{type:'tick';delta:number;duration:number}|{type:'completionAccepted'}|{type:'completionFailed';message:string}|{type:'retry'}|{type:'exit'};
export function createGame(level:LevelDTO):GameState{
 const raw=Object.fromEntries(Object.entries(level.initial).map(([k,v])=>[k,String(v)]));
 const validation=validateRoute(level,raw);
 return {level,raw,validation,status:validation.status==='ready'?'editing-valid':'editing-invalid',snapshot:null,elapsed:0,error:null};
}
export function gameReducer(s:GameState,e:GameEvent):GameState{
 switch(e.type){
 case 'edit':{
  if(!s.status.startsWith('editing')||!s.level.controls.some(c=>c.name===e.name))return s;
  const raw={...s.raw,[e.name]:e.raw};const validation=validateRoute(s.level,raw);
  return {...s,raw,validation,status:validation.status==='ready'?'editing-valid':'editing-invalid',error:null};
 }
 case 'launch':
  if(s.status!=='editing-valid'||s.validation.status!=='ready')return s;
  return {...s,status:'riding',elapsed:0,snapshot:Object.freeze({coefficients:Object.freeze({...s.raw}),numeric:Object.freeze({...s.validation.coefficients}),route:Object.freeze({...s.validation.route}),curriculumVersion:s.level.version,levelId:s.level.id})};
 case 'tick':{
  if(s.status!=='riding')return s;
  const elapsed=Math.min(e.duration,s.elapsed+Math.max(0,e.delta));
  return {...s,elapsed,status:elapsed>=e.duration?'arrived-pending':'riding'};
 }
 case 'completionAccepted':return s.status==='arrived-pending'?{...s,status:'completed',error:null}:s;
 case 'completionFailed':return s.status==='arrived-pending'?{...s,status:'save-error',error:e.message}:s;
 case 'retry':return s.status==='save-error'?{...s,status:'arrived-pending',error:null}:s;
 case 'exit':return {...s,snapshot:null,elapsed:0,error:null,status:s.validation.status==='ready'?'editing-valid':'editing-invalid'};
 }
}
export function robotMood(state:GameState):'idle'|'attention'|'success'{
 return state.status==='completed'?'success':state.status==='riding'?'attention':'idle';
}
