import { useEffect,useId,useMemo,useRef,useState,type CSSProperties } from 'react';
import { parseCoefficient,functionPolynomial,rationalToNumber,toRational } from '@graphway/math-core';
import type { LevelDTO } from '@graphway/contracts';
import type { NumericCoefficients,Scalar } from '@graphway/math-core';
import type { GameState } from './game-state';
import { MarkerIcon } from './MarkerIcon';
import styles from './Game.module.css';
const scalar=(value:Scalar)=>rationalToNumber(toRational(value));
export function GraphBoard({state,duration}:{state:GameState;duration:number}){
 const clip=useId().replace(/:/g,'');const {level}=state;
 const svgRef=useRef<SVGSVGElement>(null);
 const [size,setSize]=useState({width:0,height:0});
 const [loupe,setLoupe]=useState<number|null>(null);
 const loupeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(loupeTimer.current)clearTimeout(loupeTimer.current);},[]);
 useEffect(()=>{
  const element=svgRef.current;
  if(!element||typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(entries=>{
   const bounds=entries[0]?.contentRect;
   if(bounds&&bounds.width>0&&bounds.height>0)setSize({width:bounds.width,height:bounds.height});
  });
  observer.observe(element);
  return()=>observer.disconnect();
 },[]);
 const aspect=size.width&&size.height?size.width/size.height:1;
 const frame=useMemo(()=>{
  const circles=[level.geometry.start,level.geometry.goal,...level.geometry.pits].map(circle=>({x:scalar(circle.x),y:scalar(circle.y),r:scalar(circle.r)}));
  const domain=level.geometry.domain??{min:-6,max:6};
  const minX=Math.min(domain.min,...circles.map(circle=>circle.x-circle.r))-.8,maxX=Math.max(domain.max,...circles.map(circle=>circle.x+circle.r))+.8;
  const minY=Math.min(0,...circles.map(circle=>circle.y-circle.r))-1.2,maxY=Math.max(0,...circles.map(circle=>circle.y+circle.r))+1.2;
  return {x:(minX+maxX)/2,y:(minY+maxY)/2,width:maxX-minX,height:Math.max(8.8,maxY-minY)};
 },[level]);
 const viewHeight=Math.max(frame.height,frame.width/aspect);
 const viewWidth=viewHeight*aspect;
 const left=frame.x-viewWidth/2;
 const top=-frame.y-viewHeight/2;
 const unitPixels=size.height?size.height/viewHeight:20;
 const labelCharacters=String(Math.ceil(viewWidth/2)).length+1;
 const minimumStep=Math.max(1,(labelCharacters*7.5+8)/unitPixels);
 const stepMagnitude=10**Math.floor(Math.log10(minimumStep));
 const normalizedStep=minimumStep/stepMagnitude;
 const majorStep=(normalizedStep<=1?1:normalizedStep<=2?2:normalizedStep<=5?5:10)*stepMagnitude;
 const domain=level.geometry.domain??{min:-6,max:6};
 let numeric:NumericCoefficients|null=state.snapshot?.numeric??null;
 if(!numeric){const values:Partial<Record<'a'|'b'|'c'|'k',number>>={};let valid=true;for(const name of level.functionSpec.family==='linear'?['k','b'] as const:['a','b','c'] as const){const raw=state.raw[name]??String(level.fixed?.[name]??'');const p=parseCoefficient(raw,level.bounds?.[name]??{min:-6,max:6,...(name==='a'?{minAbs:'1/8'}:{})});if(p.status!=='valid'){valid=false;break;}values[name]=p.numeric;}if(valid)numeric=values;}
 const polynomial=numeric?functionPolynomial(level.functionSpec,numeric).map(rationalToNumber):null;
 const y=(x:number)=>polynomial!.reduceRight((sum,c)=>sum*x+c,0);
 const path=(start:number,end:number)=>Array.from({length:321},(_,i)=>{const x=start+(end-start)*i/320;return `${i?'L':'M'}${x.toFixed(5)},${(-Math.max(-1000,Math.min(1000,y(x)))).toFixed(5)}`;}).join(' ');
 const preview=state.snapshot?{route:state.snapshot.route,safeEndX:state.snapshot.route.endX}:state.validation.preview;
 const route=preview?.route;
 const progress=Math.min(1,state.elapsed/duration);
 const markerX=route?route.startX+(route.endX-route.startX)*progress:null;
 const charged=state.status==='completed';
 const zone=(circle:LevelDTO['geometry']['start'],kind:'start'|'goal'|'pit',index=0)=>{
  const x=scalar(circle.x),y=-scalar(circle.y),radius=scalar(circle.r);
  const badgeSize=Math.min(.55,Math.max(.32,radius*.65));
  const badgeY=radius<.4?y-radius-.7:y;
  return <g key={`${kind}-${index}`} className={styles[kind]}>
   <circle data-testid={`${kind}-zone`} cx={x} cy={y} r={radius} style={kind==='pit'?{fill:`url(#${clip}-hatch)`}:undefined}/>
   {kind!=='pit'&&<g transform={`translate(${x},${badgeY})`}>{radius<.4&&<path d={`M0 ${badgeSize}V${y-badgeY-radius}`} className={styles.badgeLeader}/>}<MarkerIcon kind={kind==='goal'?'battery':'robot'} size={badgeSize} charge={charged?1:.3}/></g>}
   <text x={x} y={Math.min(y-radius-.35,badgeY-badgeSize-.3)} textAnchor="middle" dominantBaseline="central" className={styles.zoneLabel}>{kind==='start'?'Старт S':kind==='goal'?'Батарея':'яма'}</text>
  </g>;
 };

 /* ---------- Подсказки на графике: только геометрия собственной кривой ученика, ничего не проверяют ---------- */
 const px=size.height?viewHeight/size.height:.05;
 const family=level.functionSpec.family;
 const editing=state.status==='editing-valid'||state.status==='editing-invalid';
 const num=(value:number)=>{const q=Math.round(value*4)/4;const v=Math.abs(q-value)<1e-9?q:Math.round(value*100)/100;return String(v).replace('-','−').replace('.',',');};
 const pointAt=(clientX:number)=>{const box=svgRef.current?.getBoundingClientRect();if(!box||!box.width)return;let x=left+(clientX-box.left)/box.width*viewWidth;const q=Math.round(x*4)/4;if(Math.abs(q-x)/px<7)x=q;setLoupe(x);};
 const nearest=(cx:number,cy:number)=>{let best={d:Infinity,x:0,y:0};for(let i=0;i<=600;i++){const x=domain.min+(domain.max-domain.min)*i/600;const v=y(x);const d=Math.hypot(x-cx,v-cy);if(d<best.d)best={d,x,y:v};}return best;};
 const overlays=polynomial&&numeric?<g className={styles.hints} aria-hidden="true">
  {family==='quadratic'&&numeric.a&&(()=>{const a=numeric.a!,b=numeric.b??0,c=numeric.c??0;const xv=-b/(2*a),yv=c-b*b/(4*a);return <>
   {level.controls.some(control=>control.name==='b')&&<path className={styles.vertexTrace} d={Array.from({length:161},(_,i)=>{const x=left+viewWidth*i/160;return `${i?'L':'M'}${x.toFixed(4)},${(-Math.max(-1000,Math.min(1000,c-a*x*x))).toFixed(4)}`;}).join(' ')}/>}
   <path className={styles.symmetryAxis} d={`M${xv} ${top}V${top+viewHeight}`}/>
   <circle className={styles.vertex} cx={xv} cy={-yv} r={5.5*px}/>
   <text className={styles.hintLabel} x={xv+10*px} y={-yv+18*px} fontSize={12*px}>вершина ({num(xv)}; {num(yv)})</text>
  </>;})()}
  {family==='linear'&&level.controls.some(control=>control.name==='k')&&<path className={styles.slope} d={`M0 ${-(numeric.b??0)}H1V${-((numeric.b??0)+(numeric.k??0))}`}/>}
  <circle key={`pulse-${family==='linear'?numeric.b:numeric.c}`} className={styles.pivotRing} cx={0} cy={-(family==='linear'?numeric.b??0:numeric.c??0)} r={7*px}/>
  <circle className={styles.pivot} cx={0} cy={-(family==='linear'?numeric.b??0:numeric.c??0)} r={6*px}/>
  {editing&&(state.validation.status==='no-start'||state.validation.status==='no-goal')&&(()=>{const target=state.validation.status==='no-start'?level.geometry.start:level.geometry.goal;const cx=scalar(target.x),cy=scalar(target.y),r=scalar(target.r);const p=nearest(cx,cy);if(p.d-r<14*px)return null;const ux=(p.x-cx)/p.d,uy=(p.y-cy)/p.d,ex=cx+ux*r,ey=cy+uy*r,hs=7*px,bx=ex+ux*hs*1.6,by=ey+uy*hs*1.6,nx=-uy,ny=ux;return <g className={styles.gap}><path d={`M${p.x} ${-p.y}L${ex} ${-ey}`}/><path className={styles.gapHead} d={`M${ex} ${-ey}L${bx+nx*hs} ${-(by+ny*hs)}L${bx-nx*hs} ${-(by-ny*hs)}Z`}/></g>;})()}
  {editing&&state.validation.status==='pit-contact'&&state.validation.preview?.firstPitX!=null&&(()=>{const x=state.validation.preview!.firstPitX!;return <g className={styles.hit}><circle className={styles.hitRing} cx={x} cy={-y(x)} r={6*px}/><circle className={styles.hitCore} cx={x} cy={-y(x)} r={4.5*px}/><text className={styles.hintLabel} x={x-12*px} y={-y(x)+18*px} fontSize={12.5*px} textAnchor="end">касание</text></g>;})()}
  {(level.exactConditions??[]).map((point,i)=>{const x=scalar(point.x),v=scalar(point.y),q=5.5*px;return <path key={i} className={`${styles.exactPoint} ${state.validation.status==='ready'?styles.exactOk:''}`} d={`M${x} ${-v-q}L${x+q} ${-v}L${x} ${-v+q}L${x-q} ${-v}Z`}/>;})}
  {state.status==='editing-valid'&&preview&&<path key="wave" className={styles.wave} pathLength={100} d={path(preview.route.startX,preview.safeEndX)}/>}
  {loupe!==null&&loupe>=domain.min&&loupe<=domain.max&&Math.abs(y(loupe))<60&&(()=>{const v=y(loupe);const label=`x = ${num(loupe)}  →  y = ${num(v)}`;const w=(label.length*7+20)*px;let tx=loupe+14*px;if(tx+w>left+viewWidth-6*px)tx=loupe-14*px-w;let ty=-v-38*px;if(ty<top+6*px)ty=-v+12*px;return <g className={styles.loupe}><path className={styles.loupeLine} d={`M${loupe} 0V${-v}H0`}/><circle className={styles.loupeDot} cx={loupe} cy={-v} r={6*px}/><rect x={tx} y={ty} width={w} height={26*px} rx={9*px} className={styles.loupeTag}/><text x={tx+10*px} y={ty+17.5*px} fontSize={12.5*px} className={styles.loupeText}>{label}</text></g>;})()}
 </g>:null;
 return <figure className={styles.figure}><svg ref={svgRef} data-testid="graph" style={{'--pixel-unit':`${px}px`} as CSSProperties} onPointerMove={event=>{if(event.pointerType!=='touch')pointAt(event.clientX);}} onPointerLeave={event=>{if(event.pointerType!=='touch')setLoupe(null);}} onPointerDown={event=>{if(event.pointerType!=='touch')return;pointAt(event.clientX);if(loupeTimer.current)clearTimeout(loupeTimer.current);loupeTimer.current=setTimeout(()=>setLoupe(null),1800);}} viewBox={`${left} ${top} ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`График ${level.functionSpec.family==='linear'?'линейной':'квадратичной'} функции. Старт, цель и ямы показаны кругами с одинаковым масштабом осей.`}>
 <defs><pattern id={`${clip}-hatch`} patternUnits="userSpaceOnUse" width=".22" height=".22" patternTransform="rotate(45)"><rect width=".22" height=".22" fill="#0b0816"/><rect width=".06" height=".22" fill="#fff3dc" opacity=".55"/></pattern><clipPath id={clip}><rect x={domain.min} y={top} width={domain.max-domain.min} height={viewHeight}/></clipPath></defs>
 {Array.from({length:Math.floor(left+viewWidth)-Math.ceil(left)+1},(_,i)=>Math.ceil(left)+i).map(x=><g key={`x${x}`}><line className={styles.grid} x1={x} x2={x} y1={top} y2={top+viewHeight}/>{x!==0&&x%majorStep===0&&<text className={styles.axisLabel} x={x} y={.55} textAnchor="middle">{x}</text>}</g>)}
 {Array.from({length:Math.floor(-top)-Math.ceil(-top-viewHeight)+1},(_,i)=>Math.ceil(-top-viewHeight)+i).map(v=><g key={`y${v}`}><line className={styles.grid} x1={left} x2={left+viewWidth} y1={-v} y2={-v}/>{v!==0&&<text className={styles.axisLabel} x={-.25} y={-v+.15} textAnchor="end">{v}</text>}</g>)}
 <path className={styles.axis} d={`M${left} 0H${left+viewWidth} M0 ${top+viewHeight}V${top}`}/><text className={styles.axisLabel} x={left+viewWidth-.55} y={-.35}>x</text><text className={styles.axisLabel} x={.3} y={top+.6}>y</text><text className={styles.axisLabel} x={.25} y={.6}>0</text>
 <g clipPath={`url(#${clip})`}>{polynomial&&<path data-testid="current-graph" className={styles.fullGraph} d={path(domain.min,domain.max)}/>}{polynomial&&preview&&<path className={styles.safeGraph} d={path(preview.route.startX,preview.safeEndX)}/>}</g>
 {zone(level.geometry.start,'start')}{zone(level.geometry.goal,'goal')}{level.geometry.pits.map((p,i)=>zone(p,'pit',i))}
 {overlays}
 {polynomial&&route&&<>{[route.startX,route.endX].map((x,i)=><circle key={i} className={styles.contact} cx={x} cy={-y(x)} r={.09}/>)}{markerX!==null&&<g data-testid="rider" transform={`translate(${markerX},${-y(markerX)})`} className={styles.rider}><MarkerIcon kind="robot" size={.3}/></g>}</>}
 </svg><figcaption>
 <span>◯ Старт S = ({String(level.geometry.start.x).replaceAll('-','−')}; {String(level.geometry.start.y).replaceAll('-','−')}), r = {String(level.geometry.start.r)}</span>
 <span>◯ Цель ϟ = ({String(level.geometry.goal.x).replaceAll('-','−')}; {String(level.geometry.goal.y).replaceAll('-','−')}), r = {String(level.geometry.goal.r)}</span>
 {level.geometry.pits.length>0&&<span>⊗ Яма — не касаться</span>}
 {level.geometry.pits.map((pit,i)=><span key={i}>Яма {i+1}: ({String(pit.x)}; {String(pit.y)}), r = {String(pit.r)}</span>)}
 {route&&<span className="sr-only">Контакты: x ≈ {route.startX.toFixed(3)} → {route.endX.toFixed(3)}</span>}
 </figcaption></figure>;
}
