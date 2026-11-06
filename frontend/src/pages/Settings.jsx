import React,{useState} from 'react';
import {KeyRound,Save} from 'lucide-react';
import {api} from '../services/api';
import {PageHead,Field} from '../components/common/UI';
export default function Settings(){
 const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();setError('');setMessage('');
  if(form.newPassword!==form.confirmPassword)return setError('New passwords do not match.');
  if(form.newPassword.length<10)return setError('Use at least 10 characters.');
  setBusy(true);try{const d=await api('/auth/password',{method:'PATCH',body:JSON.stringify({currentPassword:form.currentPassword,newPassword:form.newPassword})});setMessage(d.message);setForm({currentPassword:'',newPassword:'',confirmPassword:''});}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <><PageHead eyebrow="ADMINISTRATION" title="Settings" desc="Manage administrator account security."/><section className="panel settings-panel">
  <div className="panel-head"><div><h2><KeyRound size={18}/> Change password</h2><p className="muted">Use a unique password with at least 10 characters.</p></div></div>
  <form className="settings-form" onSubmit={submit}>
   <Field label="Current password"><input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={e=>setForm({...form,currentPassword:e.target.value})}/></Field>
   <Field label="New password"><input type="password" autoComplete="new-password" minLength="10" required value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})}/></Field>
   <Field label="Confirm new password"><input type="password" autoComplete="new-password" minLength="10" required value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})}/></Field>
   {error&&<div className="error">{error}</div>}{message&&<div className="success-message">{message}</div>}
   <button className="btn primary" disabled={busy}><Save size={16}/>{busy?'Updating…':'Update password'}</button>
  </form></section></>;
}
