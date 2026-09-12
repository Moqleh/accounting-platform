import { isPreviewMode, previewLogin, previewRequest } from './preview-api';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const PREVIEW_ADMIN_EMAIL='admin@example.com';
const PREVIEW_INITIAL_PASSWORD_SHA256='ae2860f874fd5f156f592dd64ecea3aba2648e51842bfdbf293a205fdc49a589';
const PREVIEW_PASSWORD_KEY='accounting.preview.override.password.sha256';
const PREVIEW_COMPANY_ID='11111111-1111-1111-1111-111111111111';

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

async function sha256(text:string){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

function previewSession():Session{
  return {token:'preview-super-admin',user:{id:'user-admin',email:PREVIEW_ADMIN_EMAIL,fullName:'Super Admin'},memberships:[{companyId:PREVIEW_COMPANY_ID,companyName:'Example Trading Company',role:'Owner',dataScope:'all'}],defaultCompanyId:PREVIEW_COMPANY_ID};
}

async function previewCredentialMatches(email:string,password:string){
  if(typeof window==='undefined'||email.trim().toLowerCase()!==PREVIEW_ADMIN_EMAIL) return false;
  const expected=window.localStorage.getItem(PREVIEW_PASSWORD_KEY)||PREVIEW_INITIAL_PASSWORD_SHA256;
  return (await sha256(password))===expected;
}

async function parseError(response:Response){const text=await response.text();try{const body=JSON.parse(text) as {message?:string|string[]};return Array.isArray(body.message)?body.message.join(', '):body.message??text}catch{return text}}
async function request<T>(path:string,method:'GET'|'POST'|'PATCH',body?:unknown,extraHeaders?:Record<string,string>):Promise<T>{
  if(isPreviewMode()){
    if(path==='/auth/change-password'&&method==='POST'){
      const values=body as {currentPassword?:string;newPassword?:string};
      if(!(await previewCredentialMatches(PREVIEW_ADMIN_EMAIL,values.currentPassword??''))) throw new Error('Current password is incorrect');
      if(!values.newPassword||values.newPassword.length<10) throw new Error('New password must contain at least 10 characters');
      window.localStorage.setItem(PREVIEW_PASSWORD_KEY,await sha256(values.newPassword));
      return {changed:true} as T;
    }
    return previewRequest<T>(path,method,body);
  }
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
  if(isPreviewMode()){
    let session:Session;
    if(await previewCredentialMatches(email,password)) session=previewSession();
    else session=await previewLogin(email,password) as Session;
    saveSession(session);
    return session;
  }
  const response=await fetch(`${API_URL}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!response.ok) throw new Error(response.status===401?'Invalid email or password':`Login failed (${response.status})`);
  const session=await response.json() as Session;
  saveSession(session);
  return session;
}
