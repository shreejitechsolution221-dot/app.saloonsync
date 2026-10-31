import {Checkout,type CheckoutCustomer,type CheckoutItem} from './checkout';
export function DirectBill({branches,taxBps,customers,services}:{branches:{id:string;name:string}[];taxBps:number;customers:CheckoutCustomer[];services:CheckoutItem[]}){return <Checkout kind="service" branches={branches} taxBps={taxBps} customers={customers} items={services}/>;}
