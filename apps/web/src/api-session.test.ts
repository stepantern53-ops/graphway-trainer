import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import type { api as Api } from './app/api';
let api:typeof Api;
const owner='aabbccdd-1122-4333-8444-112233445566';
const other='bbccddee-1122-4333-8444-112233445566';
const progress={curriculumVersion:'graphway-v1',currentLevelId:'L01',nextLevelId:'L01',completedLevelIds:[],unlockedLevelIds:['L01'],completedCount:0,totalCount:24};
const snapshot={levelId:'L01',curriculumVersion:'graphway-v1',coefficients:{b:'2'},numeric:{k:1,b:2},route:{startX:-3,endX:3,startPoint:{x:-3,y:-1},endPoint:{x:3,y:5}}};
const session=(id=owner)=>({user:{id,nickname:'student_csrf',role:'student'},progress});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
// Each test exercises the module-local token cache from a fresh loading boundary.
beforeEach(async()=>{vi.resetModules();({api}=await import('./app/api'));});
afterEach(()=>{vi.restoreAllMocks();});

it('refreshes identity and CSRF once but never replays a rejected same-owner completion',async()=>{
 let token='old';let saves=0;let meReads=0;
 const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(path,init)=>{
  if(String(path)==='/api/auth/csrf')return response({csrfToken:token});
  if(String(path)==='/api/me'){meReads++;return response(session());}
  if(String(path).endsWith('/complete')){
   saves++;
   if((init?.headers as Record<string,string>)['X-CSRF-Token']!==token)return response({error:{code:'CSRF_INVALID',message:'Stale CSRF'}},403);
   return response({completion:{levelId:'L01',curriculumVersion:'graphway-v1',completedAt:'2026-11-16T00:00:00.000Z'},progress:{...progress,completedLevelIds:['L01'],completedCount:1}});
  }
  return response(progress);
 });
 await api.current('L01','graphway-v1',owner);
 token='fresh';
 await expect(api.complete(snapshot,owner)).rejects.toMatchObject({status:403,code:'CSRF_INVALID'});
 expect(meReads).toBe(1);expect(saves).toBe(1);
 const result=await api.complete(snapshot,owner);
 expect(result.progress.completedLevelIds).toEqual(['L01']);expect(saves).toBe(2);
 const posts=fetch.mock.calls.filter(([path])=>String(path).endsWith('/complete'));
 expect(posts.map(([,init])=>(init?.headers as Record<string,string>)['X-GraphWay-User'])).toEqual([owner,owner]);
});

it.each(['current','complete','logout'] as const)('rejects a changed identity during %s recovery without replaying the old action',async action=>{
 let mutations=0;let meReads=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(path,init)=>{
  if(String(path)==='/api/auth/csrf')return response({csrfToken:'fresh-other-user'});
  if(String(path)==='/api/me'){meReads++;return response(session(other));}
  if(init?.method!=='GET'){mutations++;return response({error:{code:'CSRF_INVALID',message:'Stale CSRF'}},403);}
  throw new Error('Unexpected request');
 });
 const call=()=>action==='current'?api.current('L01','graphway-v1',owner):action==='complete'?api.complete(snapshot,owner):api.logout(owner);
 await expect(call()).rejects.toMatchObject({status:409,code:'SESSION_CHANGED'});
 expect(mutations).toBe(1);expect(meReads).toBe(1);
});

it.each([[403,'LEVEL_LOCKED'],[401,'UNAUTHENTICATED']] as const)('does not refresh auth or replay HTTP %s %s',async(status,code)=>{
 const paths:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async path=>{
  paths.push(String(path));
  if(String(path)==='/api/auth/csrf')return response({csrfToken:'token'});
  return response({error:{code,message:'Rejected'}},status);
 });
 await expect(api.complete(snapshot,owner)).rejects.toMatchObject({status,code});
 expect(paths).toEqual(['/api/auth/csrf','/api/levels/L01/complete']);
});

it('keeps recovery bounded when refreshing CSRF is itself rejected',async()=>{
 let csrfReads=0;let meReads=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async path=>{
  if(String(path)==='/api/auth/csrf')return ++csrfReads===1?response({csrfToken:'old'}):response({error:{code:'CSRF_INVALID',message:'No token'}},403);
  if(String(path)==='/api/me'){meReads++;return response(session());}
  return response({error:{code:'CSRF_INVALID',message:'Stale CSRF'}},403);
 });
 await expect(api.complete(snapshot,owner)).rejects.toMatchObject({status:403,code:'CSRF_INVALID'});
 expect(csrfReads).toBe(2);expect(meReads).toBe(1);
});
