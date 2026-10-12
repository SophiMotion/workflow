import {expect,it} from 'vitest';
import {defaults,parseConfig} from '../src/parameters';
it('round trips saved parameters',()=>{const p={...defaults,base_length:1000};expect(parseConfig(JSON.parse(JSON.stringify({version:1,sourceSha256:'source',parameters:p})),'source')).toEqual(p)});
it('rejects another assembly',()=>expect(()=>parseConfig({version:1,sourceSha256:'other',parameters:defaults},'source')).toThrow('different model'));
it('rejects missing and string-valued parameters',()=>{expect(()=>parseConfig({version:1,sourceSha256:'source',parameters:{}},'source')).toThrow('Missing');expect(()=>parseConfig({version:1,sourceSha256:'source',parameters:{...defaults,hip_length:'300'}},'source')).toThrow('Missing')});
it('validates imported geometry before applying it',()=>expect(()=>parseConfig({version:1,sourceSha256:'source',parameters:{...defaults,base_length:1}},'source')).toThrow('Base length'));
