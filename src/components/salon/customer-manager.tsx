'use client';
import {useId,useRef,useState} from 'react';
import Link from 'next/link';
import {ActionForm,Field} from './forms';
import {editCustomer,deleteCustomer} from '@/server/customer-actions';
type Customer={id:string;displayName:string;phone:string|null;notes:string|null};
export function CustomerManager({customer,administrator}:{customer:Customer;administrator:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);const title=useId();const [mode,setMode]=useState<'edit'|'delete'>('edit');
 function open(mode:'edit'|'delete'){setMode(mode);dialog.current?.showModal();}
 return <div className="customer-row-actions"><Link href={`/salon/customers/profile/${customer.id}`} className="customer-text-action">View</Link><button type="button" onClick={()=>open('edit')}>Edit</button>{administrator&&<button type="button" className="customer-delete-action" onClick={()=>open('delete')}>Delete</button>}
  <dialog className="studio-dialog customer-dialog" ref={dialog} aria-labelledby={title}><div className="dialog-heading"><h2 id={title}>{mode==='edit'?'Edit customer':'Delete customer'}</h2><button type="button" aria-label="Close customer dialog" onClick={()=>dialog.current?.close()}>×</button></div>
   {mode==='edit'?<ActionForm key="edit" action={editCustomer} submit="Save changes"><input type="hidden" name="id" value={customer.id}/><Field name="displayName" label="Full name" value={customer.displayName}/><Field name="phone" label="Phone (optional)" type="tel" required={false} value={customer.phone??''}/><label className="field">Preferences &amp; notes<textarea name="notes" maxLength={2000} defaultValue={customer.notes??''}/></label></ActionForm>:<ActionForm key="delete" action={deleteCustomer} submit="Delete customer" className="customer-delete-form"><input type="hidden" name="id" value={customer.id}/><p>Delete <strong>{customer.displayName}</strong> from this salon?</p><p className="hint">Customers with visit, loyalty, message or photo history cannot be deleted.</p><label className="settings-check"><input type="checkbox" name="confirm" required/>I confirm this customer should be deleted.</label></ActionForm>}
  </dialog>
 </div>;
}
