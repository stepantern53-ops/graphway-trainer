import { authResponseSchema,completionResultSchema,episodesResponseSchema,levelDTOSchema,levelListResponseSchema,progressDTOSchema,csrfResponseSchema,errorResponseSchema } from '@graphway/contracts';
import { z } from 'zod';
import type { Snapshot } from '../game/game-state';
export class ApiError extends Error {constructor(public readonly status:number,public readonly code:string,message:string){super(message);}}
let csrf:string|null=null;
async function request<T>(path:string,schema:z.ZodType<T>,method='GET',body?:unknown,owner?:string):Promise<T>{
 try{
  if(method!=='GET'&&!csrf){const result=await request('/api/auth/csrf',csrfResponseSchema);csrf=result.csrfToken;}
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(method!=='GET'?{'X-CSRF-Token':csrf!}:{}),...(owner?{'X-GraphWay-User':owner}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok){
   const parsed=errorResponseSchema.safeParse(await response.json().catch(()=>null));
   const code=parsed.success?parsed.data.error.code:'HTTP_ERROR';
   if(response.status===401)csrf=null;
   if(method!=='GET'&&((response.status===403&&code==='CSRF_INVALID')||(response.status===409&&code==='SESSION_CHANGED'))){
    csrf=null;
    // Refresh credentials only: never replay a write, especially across identities.
    if(owner){
     const session=await request('/api/me',authResponseSchema);
     if(session.user.id!==owner)throw new ApiError(409,'SESSION_CHANGED','Аккаунт изменился в другой вкладке. Войди снова; прежний заезд очищен.');
    }
    const fresh=await request('/api/auth/csrf',csrfResponseSchema);
    csrf=fresh.csrfToken;
    if(code==='CSRF_INVALID')throw new ApiError(403,code,'Сессия обновлена. Повтори действие.');
   }
   throw new ApiError(response.status,code,parsed.success?parsed.data.error.message:response.status===503?'Сервер временно недоступен. Попробуй ещё раз.':`Ошибка сервера (${response.status}). Попробуй ещё раз.`);
  }
  return schema.parse(response.status===204?undefined:await response.json());
 }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(0,'CONNECTION_ERROR','Не удалось получить корректный ответ сервера. Проверь соединение и повтори.');}
}
export const api={
 me:()=>request('/api/me',authResponseSchema),
 auth:async(mode:'login'|'register',nickname:string,password:string)=>{csrf=null;const result=await request(`/api/auth/${mode}`,authResponseSchema,'POST',{nickname,password});csrf=null;return result;},
 logout:async(owner:string)=>{await request('/api/auth/logout',z.void(),'POST',undefined,owner);csrf=null;},
 episodes:()=>request('/api/episodes',episodesResponseSchema),
 levels:(episodeId:string)=>request(`/api/episodes/${encodeURIComponent(episodeId)}/levels`,levelListResponseSchema),
 level:(id:string)=>request(`/api/levels/${encodeURIComponent(id)}`,levelDTOSchema),
 current:(levelId:string,curriculumVersion:string,owner:string)=>request('/api/progress/current',progressDTOSchema,'PUT',{levelId,curriculumVersion},owner),
 complete:(snapshot:Snapshot,owner:string)=>request(`/api/levels/${encodeURIComponent(snapshot.levelId)}/complete`,completionResultSchema,'POST',{curriculumVersion:snapshot.curriculumVersion,coefficients:snapshot.coefficients},owner)
};
