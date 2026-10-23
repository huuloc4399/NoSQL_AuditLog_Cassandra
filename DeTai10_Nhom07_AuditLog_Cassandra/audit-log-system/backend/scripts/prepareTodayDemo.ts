import { connectCassandra, closeCassandra } from '../src/config/cassandra.js';
import { prepareTodayDemoData } from '../src/services/demoDataService.js';
async function main() {
  if (!await connectCassandra()) throw new Error('Cassandra unavailable');
  console.log(JSON.stringify(await prepareTodayDemoData()));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(closeCassandra);
