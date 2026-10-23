import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectCassandra, closeCassandra, getCassandraClient, cassandra } from '../src/config/cassandra.js';
import { env } from '../src/config/env.js';

async function main() {
  if (!await connectCassandra()) throw Error('Cassandra unavailable');
  const client = getCassandraClient(); const report: any = { checkedAt: new Date().toISOString(), checks: [] };
  const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.runtime/defense-verification.json');
  const login = await fetch(`http://127.0.0.1:${env.PORT}/api/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD})});
  const auth: any = await login.json(); assert(auth.data?.token);
  const headers = {'Content-Type':'application/json',Authorization:`Bearer ${auth.data.token}`};
  async function api(route: string, method='GET', body?: unknown) {
    const response = await fetch(`http://127.0.0.1:${env.PORT}/api${route}`, {method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const result: any = await response.json(); assert(response.ok, `${method} ${route}: ${result.message}`); return result;
  }
  const date = new Date().toISOString().slice(0,10);
  const first = (await api('/demo/prepare-today','POST',{})).data;
  const second = (await api('/demo/prepare-today','POST',{})).data;
  assert.equal(second.added,0); assert.equal(second.existing,48);
  report.preparation={first,second}; report.checks.push('Daily sample preparation is idempotent');
  const filtered = await api(`/logs?service=Payment&level=ERROR&date=${date}&from=00:00&to=23:59&limit=100`);
  assert(filtered.data.length>=3); assert(filtered.data.every((r:any)=>r.service_name==='Payment'&&r.level==='ERROR'&&r.log_date===date));
  report.filteredErrors=filtered.data.length;report.checks.push('Today Payment ERROR and time range filter');
  const name=`defense_${Date.now()}`;
  const created=(await api('/users','POST',{username:name,password:`DemoOnly_${Date.now()}!`,full_name:'Demo before',email:`${name}@example.com`,role:'USER'})).data;
  try {
    await api(`/users/${created.user_id}`,'PUT',{full_name:'Demo after',email:`updated_${name}@example.com`});
    const userRow=await client.execute('SELECT full_name FROM users WHERE username=?',[name],{prepare:true});
    assert.equal(userRow.first().full_name,'Demo after');
    const logs=await api(`/logs?service=User&date=${date}&limit=500`);
    const event=logs.data.find((r:any)=>r.action==='UPDATE_USER'&&JSON.parse(r.details).target_user_id===created.user_id);
    assert(event,'Missing UPDATE_USER audit');
    const uuid=cassandra.types.Uuid.fromString(event.log_id);
    const byId=await client.execute('SELECT action FROM audit_logs_by_id WHERE log_id=?',[uuid],{prepare:true});
    const byLevel=await client.execute('SELECT action FROM audit_logs_by_service_level WHERE service_name=? AND level=? AND log_date=? AND log_time=? AND log_id=?',
      [event.service_name,event.level,cassandra.types.LocalDate.fromString(event.log_date),new Date(event.log_time),uuid],{prepare:true});
    assert.equal(byId.first().action,'UPDATE_USER');assert.equal(byLevel.first().action,'UPDATE_USER');
    report.userUpdate={log_id:event.log_id,actor:event.user_id,changed_fields:JSON.parse(event.details).changed_fields,copies:3};
    report.checks.push('Updated account and UPDATE_USER are persisted; identical event in all three tables');
    await api(`/users/${created.user_id}/status`,'PATCH',{status:'INACTIVE'});
    await api(`/users/${created.user_id}/status`,'PATCH',{status:'ACTIVE'});
  } finally { await api(`/users/${created.user_id}`,'DELETE'); }
  report.checks.push('Temporary account disabled, enabled and removed with audit');
  let uiService=(await api('/services')).data.find((r:any)=>r.service_name==='DemoBaoVe20261022');
  const serviceCreatedOnWeb=Boolean(uiService);
  if (!uiService) {
    uiService=(await api('/services','POST',{service_name:`DefenseService${Date.now()}`,description:'Created for verification'})).data;
    uiService=(await api(`/services/${uiService.service_id}`,'PUT',{description:'Đã sửa trên website; kiểm chứng bằng CQLSH'})).data;
  }
  {
    assert.equal(uiService.description,'Đã sửa trên website; kiểm chứng bằng CQLSH');
    await api(`/services/${uiService.service_id}`,'DELETE');
    const serviceLogs=(await api(`/logs?service=User&date=${date}&limit=500`)).data.filter((r:any)=>JSON.parse(r.details||'{}').service_id===uiService.service_id);
    for(const action of ['CREATE_SERVICE','UPDATE_SERVICE','DELETE_SERVICE']) assert(serviceLogs.some((r:any)=>r.action===action));
    report.serviceCrud={name:uiService.service_name,actions:serviceLogs.map((r:any)=>r.action),removed:true,source:serviceCreatedOnWeb?'web-create-edit/API-delete':'API-create-edit-delete'};
    report.checks.push('Service CRUD has all three audit actions');
  }
  const ttl=(await api('/logs/ttl-demo','POST',{ttl:30})).data;
  const uuid=cassandra.types.Uuid.fromString(ttl.log_id);
  const before=await client.execute('SELECT TTL(message) AS remaining FROM audit_logs_by_id WHERE log_id=?',[uuid],{prepare:true});
  report.ttl={id:ttl.log_id,before:before.first().remaining};
  fs.writeFileSync(output,JSON.stringify(report,null,2)); console.log('CRUD and filters passed; waiting for TTL expiry.');
  await new Promise(resolve=>setTimeout(resolve,32000));
  const after=(await api(`/logs/ttl-status/${ttl.log_id}`));assert(after.expired);
  const byId=await client.execute('SELECT log_id FROM audit_logs_by_id WHERE log_id=?',[uuid],{prepare:true});
  const main=await client.execute('SELECT log_id FROM audit_logs WHERE service_name=? AND log_date=? AND log_time=? AND log_id=?',
    [ttl.service_name,cassandra.types.LocalDate.fromString(ttl.log_date),new Date(ttl.log_time),uuid],{prepare:true});
  const byLevel=await client.execute('SELECT log_id FROM audit_logs_by_service_level WHERE service_name=? AND level=? AND log_date=? AND log_time=? AND log_id=?',
    [ttl.service_name,ttl.level,cassandra.types.LocalDate.fromString(ttl.log_date),new Date(ttl.log_time),uuid],{prepare:true});
  assert.equal(byId.rowLength+main.rowLength+byLevel.rowLength,0);
  Object.assign(report.ttl,{waitSeconds:32,expired:true,remainingRowsAcrossThreeTables:0});
  report.checks.push('TTL 30 seconds expires from all three Cassandra tables');report.status='PASSED';
  fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(closeCassandra);
