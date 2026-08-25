const datePart=(parts:Intl.DateTimeFormatPart[],type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value;

/** Product pricing has no tenant time-zone setting, so the browser calendar is the supported fallback. */
export const calendarDateInTimeZone=(value:Date,timeZone:string)=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
 const year=datePart(parts,'year'),month=datePart(parts,'month'),day=datePart(parts,'day');
 if(!year||!month||!day)throw new Error('Unable to resolve calendar date.');
 return `${year}-${month}-${day}`;
};

export const browserLocalCalendarDate=(value=new Date())=>calendarDateInTimeZone(value,Intl.DateTimeFormat().resolvedOptions().timeZone);
