export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const DEMO_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID ?? '11111111-1111-1111-1111-111111111111';

export type Session={token:string;user:{id:string;email:string;fullName:string};memberships:Array<{companyId:string;companyName:string;role:string;dataScope?:string|null}>;defaultCompanyId?:string};

export function getSession():Session|null{
  if(typeof window==='undefined') return null;
  const raw=window.localStorage.getItem('accounting.session');
  if(!raw) return null;
  try{return JSON.parse(raw) as Session}catch{return null}
}

export function saveSession(session:Session){
  if(typeof window!=='undefined') window.localStorage.setItem('accounting.session',JSON.stringify(session));
}

export function clearSession(){
  if(typeof window!=='undefined') window.localStorage.removeItem('accounting.session');
}

function headers(extra?:Record<string,string>){
  const token=getSession()?.token;
  return {'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...extra};
}

export async function apiGet<T>(path:string):Promise<T>{
  const response=await fetch(`${API_URL}${path}`,{cache:'no-store',headers:headers()});
  if(response.status===401&&typeof window!=='undefined'){clearSession();if(window.location.pathname!=='/login')window.location.assign('/login')}
  if(!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path:string,body:unknown):Promise<T>{
  const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:headers(),body:JSON.stringify(body)});
  if(response.status===401&&typeof window!=='undefined'){clearSession();if(window.location.pathname!=='/login')window.location.assign('/login')}
  if(!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function login(email:string,password:string){
  const response=await fetch(`${API_URL}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!response.ok) throw new Error(response.status===401?'Invalid email or password':`Login failed (${response.status})`);
  const session=await response.json() as Session;
  saveSession(session);
  return session;
}
