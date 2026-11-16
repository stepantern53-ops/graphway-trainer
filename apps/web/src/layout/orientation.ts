import { useEffect,useState } from 'react';

interface OrientationState {portrait:boolean;width:number}
interface OrientationMeasurement {type?:string;width:number;height:number;previous:boolean;previousWidth?:number;editing:boolean}

export function stablePortrait({type,width,height,previous,previousWidth,editing}:OrientationMeasurement){
 if(type?.startsWith('portrait'))return true;
 if(type?.startsWith('landscape'))return false;
 const widthChanged=previousWidth!==undefined&&width!==previousWidth;
 return editing&&!widthChanged?previous:height>width;
}

export function usePortrait(){
 const measure=(previous?:OrientationState):OrientationState=>{
  const width=document.documentElement.clientWidth;
  const height=document.documentElement.clientHeight;
  return {width,portrait:stablePortrait({
   type:window.matchMedia('(pointer: coarse)').matches?window.screen.orientation?.type:undefined,
   width,height,
   previous:previous?.portrait??height>width,
   previousWidth:previous?.width,
   editing:previous!==undefined&&document.activeElement instanceof HTMLInputElement
  })};
 };
 const [orientation,setOrientation]=useState(()=>measure());
 useEffect(()=>{
  const change=()=>setOrientation(previous=>measure(previous));
  window.addEventListener('resize',change);
  window.screen.orientation?.addEventListener('change',change);
  document.addEventListener('focusout',change);
  return()=>{
   window.removeEventListener('resize',change);
   window.screen.orientation?.removeEventListener('change',change);
   document.removeEventListener('focusout',change);
  };
 },[]);
 return orientation.portrait;
}
