import {it,expect} from 'vitest';
import {exampleBom,lineTotalFen,totalFen,bomCsv} from '../src/bom-data';
import {defaults} from '../src/parameters';
import {defaultMotors} from '../src/motors';
it('creates material examples using current dimensions and independent motor choices',()=>{const motors=defaultMotors();motors.base_l.options.current.name='Example drive';const rows=exampleBom({...defaults,upper_arm_length:275},motors);expect(rows.find(r=>r.id==='tube-upper')!.material).toContain('275');expect(rows.find(r=>r.id==='base_l')!.item).toContain('Example drive');expect(rows.find(r=>r.id==='shoulder_l')!.quantity).toBe(2);expect(rows.every(r=>r.unitPrice>=0)).toBe(true)});
it('totals CNY prices in integer fen',()=>{const rows=[{id:'a',group:'Frame',item:'Plate',material:'Steel',quantity:3,unit:'pc',unitPrice:.1}];expect(lineTotalFen(rows[0])).toBe(30);expect(totalFen(rows)).toBe(30);expect(()=>totalFen([{...rows[0],quantity:-1}])).toThrow()});
it('exports quoted CSV with CNY labels and neutralizes spreadsheet formulas',()=>{const row={id:'a',group:'Frame',item:'=HYPERLINK("bad")',material:'Steel, 2 mm',quantity:2,unit:'pc',unitPrice:12.5};const csv=bomCsv([row]);expect(csv).toContain('CNY');expect(csv).toContain('Example prices');expect(csv).toContain('"Steel, 2 mm"');expect(csv).toContain("'=HYPERLINK");expect(csv).toContain('25.00')});
