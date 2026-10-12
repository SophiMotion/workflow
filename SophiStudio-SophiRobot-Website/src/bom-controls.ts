import type {BomRow} from './bom-data';

export function matchesBomRow(row:BomRow,query:string,category:string){
 return (!category||row.group===category)&&query.trim().toLowerCase().split(/\s+/).every(term=>`${row.item} ${row.material} ${row.group}`.toLowerCase().includes(term));
}
export function numericError(key:'quantity'|'unitPrice',value:number):string{
 if(!Number.isFinite(value))return 'Enter a number.';
 if(key==='quantity')return Number.isInteger(value)&&value>=0&&value<=100000?'':'Use a whole number from 0 to 100,000.';
 if(value<0||value>10000000)return 'Use a price from ¥0 to ¥10,000,000.';
 return Math.abs(value*100-Math.round(value*100))<0.000001?'':'Use up to two decimal places.';
}
export function stepQuantity(value:number,delta:number){return Math.max(0,Math.min(100000,(Number.isFinite(value)?Math.round(value):0)+delta));}
