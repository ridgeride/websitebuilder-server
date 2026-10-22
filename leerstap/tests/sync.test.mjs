import test from 'node:test';import assert from 'node:assert/strict';
import {records,diff,splitKey} from '../src/sync.js';
import {initialState} from '../src/core.js';
test('Only changed records are sent; documents travel without pages or file data',()=>{
 const s=initialState();s.documents.push({id:'d1',name:'h3.pdf',type:'application/pdf',warnings:[],pageCount:1,pages:[{id:'d1',page:1,text:'groot'}],data:'QUJD'});
 const before=records(s,{},'leerling-1');assert.equal(before.get('document:d1'),JSON.stringify({id:'d1',name:'h3.pdf',type:'application/pdf',warnings:[],pageCount:1}));
 assert.deepEqual(diff(before,records(s,{},'leerling-1')),{put:[],del:[]});
 s.modules[0].title='Nieuw';s.draft={profile:'leerling-1',module:'demo',title:'x',mode:'practice',questions:[],answers:[]};
 assert.deepEqual(diff(before,records(s,{},'leerling-1')),{put:['module:demo','draft:leerling-1'],del:[]});
});
test('Finishing a session deletes its draft; other children keep theirs; profiles are never deleted by omission',()=>{
 const s=initialState(),other={profile:'b',module:'demo'};s.draft={profile:'leerling-1',module:'demo'};
 const before=records(s,{b:other},'leerling-1');s.draft=null;s.profiles=[];
 assert.deepEqual(diff(before,records(s,{b:other},'leerling-1')),{put:[],del:['draft:leerling-1']});
 assert.deepEqual(splitKey('draft:abc-1'),['draft','abc-1']);
});
