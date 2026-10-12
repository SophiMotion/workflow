import {expect,it} from 'vitest';
import {matchesBomRow,numericError,stepQuantity} from '../src/bom-controls';
import {exampleBom,totalFen} from '../src/bom-data';
it('searches across material, component and category with combined filters',()=>{
 const row=exampleBom()[0];
 expect(matchesBomRow(row,' STEEL tray ','Base')).toBe(true);
 expect(matchesBomRow(row,'steel','Motors')).toBe(false);
 expect(matchesBomRow(row,'unknown','')).toBe(false);
 const rows=exampleBom(),total=totalFen(rows);rows.filter(r=>matchesBomRow(r,'steel',''));
 expect(totalFen(rows)).toBe(total);
});
it('validates quantity and currency precision without rejecting floating point cents',()=>{
 expect(numericError('quantity',NaN)).toBeTruthy();
 expect(numericError('quantity',1.5)).toBeTruthy();
 expect(numericError('quantity',0)).toBe('');
 expect(numericError('unitPrice',1.001)).toBeTruthy();
 expect(numericError('unitPrice',19.99)).toBe('');
 expect(numericError('unitPrice',-1)).toBeTruthy();
});
it('keeps quantity steps inside the permitted range',()=>{
 expect(stepQuantity(0,-1)).toBe(0);expect(stepQuantity(100000,1)).toBe(100000);
 expect(stepQuantity(5,-1)).toBe(4);expect(stepQuantity(NaN,1)).toBe(1);
});
