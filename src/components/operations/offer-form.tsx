'use client';
import {useState} from 'react';
import {ActionForm,Field} from '@/components/salon/forms';
import {addOffer} from '@/server/growth-inventory';
export function OfferForm(){const [kind,setKind]=useState('percentage');return <ActionForm action={addOffer} submit="Create offer"><Field name="name" label="Offer name"/><Field name="code" label="Coupon code"/><label className="field">Discount type<select name="kind" value={kind} onChange={event=>setKind(event.target.value)}><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off</option></select></label>{kind==='percentage'?<Field name="offerPercent" label="Discount (%)" type="number" min={0.01} max={100}/>:<Field name="valueRupees" label="Discount amount (INR)" type="number" min={0.01}/>}<Field name="expiresOn" label="Expires on" type="date"/></ActionForm>;}
