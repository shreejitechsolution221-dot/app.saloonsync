export function whatsappReminderUrl(phone:string,message:string){
 let digits=phone.replace(/\D/g,'');if(digits.length===10)digits='91'+digits;
 if(!/^[1-9]\d{7,14}$/.test(digits))return null;
 return `https://wa.me/${digits}?${new URLSearchParams({text:message})}`;
}
export function emailReminderUrl(email:string,subject:string,message:string){
 const recipient=email.trim();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))return null;
 return `mailto:${encodeURIComponent(recipient)}?${new URLSearchParams({subject,body:message}).toString().replace(/\+/g,'%20')}`;
}
