'use client';
import {useId,useRef,useState} from 'react';
import {whatsappReminderUrl,emailReminderUrl} from '@/lib/salon/customer-reminders';
export function CustomerReminder({name,phone,salon}:{name:string;phone:string|null;salon:string}){
 const dialog=useRef<HTMLDialogElement>(null);const title=useId();
 const [channel,setChannel]=useState<'whatsapp'|'email'>('whatsapp');const [number,setNumber]=useState(phone??'');const [email,setEmail]=useState('');
 const [message,setMessage]=useState(`Hi ${name}, we’d love to welcome you back to ${salon}. It may be time for your next visit. Reply to arrange a convenient appointment. We look forward to seeing you!`);const [error,setError]=useState('');
 function open(channel:'whatsapp'|'email'){setChannel(channel);setError('');dialog.current?.showModal();}
 return <div className="customer-reminder-actions"><button type="button" className="reminder-whatsapp" onClick={()=>open('whatsapp')}>WhatsApp</button><button type="button" onClick={()=>open('email')}>Email</button>
  <dialog className="studio-dialog customer-dialog" ref={dialog} aria-labelledby={title}><div className="dialog-heading"><div><p className="eyebrow">VISIT REMINDER</p><h2 id={title}>{name}</h2></div><button type="button" aria-label="Close reminder" onClick={()=>dialog.current?.close()}>×</button></div><form className="studio-form" onSubmit={event=>{event.preventDefault();const url=channel==='whatsapp'?whatsappReminderUrl(number,message):emailReminderUrl(email,`Your next visit at ${salon}`,message);if(!url){setError(channel==='whatsapp'?'Enter a valid WhatsApp number with country code.':'Enter a valid customer email address.');return;}setError('');if(channel==='whatsapp')window.open(url,'_blank','noopener,noreferrer');else window.location.href=url;}}>
   <label className="field">Send with<select value={channel} onChange={e=>setChannel(e.target.value as 'email'|'whatsapp')}><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></label>
   {channel==='whatsapp'?<label className="field">WhatsApp number (with country code)<input type="tel" required value={number} onChange={e=>setNumber(e.target.value)} maxLength={30}/></label>:<label className="field">Customer email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>}
   <label className="field">Reminder message<textarea required value={message} onChange={e=>setMessage(e.target.value)} maxLength={2000}/></label><p className="hint">Opens an editable draft in {channel==='whatsapp'?'WhatsApp':'your email app'}. Review and send it there. Customer email is used for this draft only.</p>{error&&<p role="alert" className="status error">{error}</p>}<button className="primary">Open {channel==='whatsapp'?'WhatsApp':'email'} draft ↗</button>
  </form></dialog>
 </div>;
}
