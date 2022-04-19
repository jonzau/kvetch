if (!process.env.URI) {
  require('dotenv').config();
}
const URI = process.env.URI;
const INSTANCES = process.env.INSTANCES || 1;
if (!URI) {
  throwInvalidURI();
}
const http = require('http');

function throwInvalidURI() {
  throw new Error('Invalid URI!');
}

function attack(attackCount) {
  return new Promise((res, rej) => {
    const start = Date.now();
    return http.get(URI, (_resp) => {
      const time = Date.now() - start;
      console.log(`Request #${attackCount} (${URI}) ${time} ms`);
      res({instance: attackCount, status: 'ok', time: time});
    }).on("error", (err) => {
      if (process.env.LOG_ERRORS === 'true') {
        console.log(`Error (${URI}):`, err);
      }
      res({instance: attackCount, status: 'error', error: err});
    });
  });
}

console.log(`Attacking ${URI} ${INSTANCES} times...\n`);

const instances = [];
for (let i = 0; i < INSTANCES; i++) {
  instances.push(attack(i));
}

Promise.all(instances).then(times => {
  let totalTime = 0;
  let min = {time: 9999999999};
  let max = {time: 0};
  let timedOut = 0;
  let totalErrors = 0;
  times.forEach(attack => {
    switch (attack.status) {
      case 'ok':
        if (attack.time > max.time) {
          max.time = attack.time;
          max.instance = attack.instance;
        }
        if (attack.time < min.time) {
          min.time = attack.time;
          min.instance = attack.instance;
        }
        totalTime += attack.time;
        break;
      case 'error':
        if (attack.error.code === 'ETIMEDOUT') {
          timedOut++;
        }
        totalErrors++;
        break;
      default:
    }
  });
  const successfulCount = times.length - totalErrors;
  const avg = totalTime / successfulCount;
  console.log(`\nAverage time (${successfulCount} requests): ${avg.toFixed()} ms`);
  console.log(`Max time (#${max.instance}): ${max.time} ms`);
  console.log(`Min time (#${min.instance}): ${min.time} ms`);
  console.log(`Timed out: ${timedOut}`);
  console.log(`Total errors: ${totalErrors}`);
});
