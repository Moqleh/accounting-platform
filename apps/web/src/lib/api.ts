export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type Session={token:string;user:{id:string;email:string;fullName:string};memberships:Array<{companyId:string;companyName:string;role:string;dataScope?:string|null}>;defaultCompanyId?:string};

export function getSession():Session|null{
  if(typeof window==='undefined') return null;
  const raw=window.localStorage.getItem('accounting.session');
  if(!raw) return null;
  try{return JSON.parse(raw) as Session}catch{return null}
}

export function saveSession(session:Session){
  if(typeof window!=='undefined') {
    window.localStorage.setItem('accounting.session',JSON.stringify(session));
    if(session.defaultCompanyId&&!window.localStorage.getItem('accounting.companyId')) window.localStorage.setItem('accounting.companyId',session.defaultCompanyId);
  }
}

export function clearSession(){
  if(typeof window!=='undefined') {
    window.localStorage.removeItem('accounting.session');
    window.localStorage.removeItem('accounting.companyId');
  }
}

export function getCompanyId(){
  if(typeof window==='undefined') return '';
  const session=getSession();
  if(!session?.memberships.length) return '';
  const selected=window.localStorage.getItem('accounting.companyId');
  if(selected&&session.memberships.some(m=>m.companyId===selected)) return selected;
  return session.defaultCompanyId??session.memberships[0].companyId;
}

export function setCompanyId(companyId:string){
  if(typeof window==='undefined') return;
  const session=getSession();
  if(session?.memberships.some(m=>m.companyId===companyId)) window.localStorage.setItem('accounting.companyId',companyId);
}

function headers(extra?:Record<string,string>){
  const token=getSession()?.token;
  return {'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...extra};
}

function loginPath(){
  if(typeof window==='undefined') return '/login/';
  const prefix=window.location.pathname.startsWith('/accounting-platform')?'/accounting-platform':'';
  return `${prefix}/login/`;
}

async function parseError(response:Response){const text=await response.text();try{const body=JSON.parse(text) as {message?:string|string[]};return Array.isArray(body.message)?body.message.join(', '):body.message??text}catch{return text}}
async function request<T>(path:string,method:'GET'|'POST'|'PATCH',body?:unknown,extraHeaders?:Record<string,string>):Promise<T>{
  const response=await fetch(`${API_URL}${path}`,{method,cache:method==='GET'?'no-store':undefined,headers:headers(extraHeaders),...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(response.status===401&&typeof window!=='undefined'){clearSession();const target=loginPath();if(window.location.pathname!==target&&window.location.pathname!==target.slice(0,-1))window.location.assign(target)}
  if(!response.ok) throw new Error(`API ${response.status}: ${await parseError(response)}`);
  return response.json() as Promise<T>;
}

export function apiGet<T>(path:string){return request<T>(path,'GET')}
export function apiPost<T>(path:string,body:unknown,extraHeaders?:Record<string,string>){return request<T>(path,'POST',body,extraHeaders)}
export function apiPatch<T>(path:string,body:unknown,extraHeaders?:Record<string,string>){return request<T>(path,'PATCH',body,extraHeaders)}

export function idempotencyHeaders(){return {'Idempotency-Key':crypto.randomUUID()}}

export async function login(email:string,password:string){
  const response=await fetch(`${API_URL}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!response.ok) throw new Error(response.status===401?'Invalid email or password':`Login failed (${response.status})`);
  const session=await response.json() as Session;
  saveSession(session);
  return session;
}
