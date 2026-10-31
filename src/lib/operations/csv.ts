export function csvCell(value:string|number){let text=String(value);if(typeof value==='string'&&/^[\s]*[=+@\-]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
