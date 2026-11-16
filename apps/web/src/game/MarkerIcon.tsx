/** Original GraphWay SVG artwork. Decorative badge only; never a math-space hit area. */
export function MarkerIcon({kind,size=1,charge=.3}:{kind:'robot'|'battery';size?:number;charge?:number}){
 return <g aria-hidden="true" pointerEvents="none" transform={`scale(${size})`}>
  <path d="M0-1A1 1 0 1 1 0 1A1 1 0 1 1 0-1" fill={kind==='battery'?'#2a2045':'#fffdf8'} stroke={kind==='battery'?'#fff3dc':'#b597f2'} strokeWidth=".1"/>
  {kind==='robot'?<>
   <path d="M-.77-.25Q-.9-.25-.9 0T-.77.25M.77-.25Q.9-.25.9 0T.77.25" fill="#d7a5f4" stroke="#8e43c8" strokeWidth=".1"/>
   <rect x="-.71" y="-.47" width="1.42" height=".97" rx=".36" fill="#1e112f"/>
   <path d="M-.47-.04Q-.31-.28-.15-.04M.15-.04Q.31-.28.47-.04M-.16.25Q0 .38.16.25" fill="none" stroke="#e2a9ff" strokeWidth=".1" strokeLinecap="round"/>
   <path d="M-.45-.69Q-.12-.86.2-.72" fill="none" stroke="#fff" strokeWidth=".09" strokeLinecap="round"/>
  </>:<>
   <rect x="-.4" y="-.58" width=".8" height="1.2" rx=".15" fill="none" stroke="#fff3dc" strokeWidth=".08"/>
   <path d="M-.16-.75H.16V-.59H-.16Z" fill="#fff3dc"/>
   <rect x="-.29" y={.5-1*charge} width=".58" height={1*charge} rx=".08" fill="#b597f2" style={{transition:'y .8s, height .8s'}}/>
   <path d="M.09-.42L-.24.1H-.02L-.1.45L.29-.1H.06Z" fill="#fff3dc"/>
  </>}
 </g>;
}
