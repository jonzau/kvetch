if (!process.env.URI) {
  require('dotenv').config();
}
const URI = process.env.URI;
const INSTANCES = process.env.INSTANCES || 1;
if (!URI) {
  throwInvalidURI();
}
const request = require('request');

const stats = {
  totalTime: 0,
  min: { instance: -1, time: 9999999999 },
  max: { instance: -1, time: 0 },
  totalErrors: 0,
  errosMap: new Map()
};

function throwInvalidURI() {
  throw new Error('Invalid URI!');
}

function attack(attackCount) {
  return new Promise((res, _rej) => {
    const start = Date.now();
    request.get({ url: URI, time: true }, (err, resp) => {
      const time = resp?.elapsedTime | (Date.now() - start);
      if (err) {
        if (process.env.LOG_ERRORS === 'true') {
          console.log(`Error (${URI}) ${time} ms:`, err);
        }
        res({instance: attackCount, status: 'error', time: time, error: err});
      } else {
        if (process.env.LOG_REQUESTS === 'true') {
          console.log(`Request #${attackCount} (${URI}) ${time} ms`);
        }
        res({instance: attackCount, status: 'ok', time: time});
      }
    });
  });
}

console.log(`Attacking ${URI} ${INSTANCES} times...\n`);

const instances = [];
for (let i = 0; i < INSTANCES; i++) {
  instances.push(attack(i));
}

Promise.all(instances).then(times => {
  times.forEach(attack => {
    switch (attack.status) {
      case 'ok':
        if (attack.time > stats.max.time) {
          stats.max.time = attack.time;
          stats.max.instance = attack.instance;
        }
        if (attack.time < stats.min.time) {
          stats.min.time = attack.time;
          stats.min.instance = attack.instance;
        }
        stats.totalTime += attack.time;
        break;
      case 'error':
        stats.errosMap.set(attack.error.code,
          { errno: attack.error.errno, count: (stats.errosMap.get(attack.error.code)?.count | 0) + 1 });
          stats.totalErrors++;
        break;
      default:
    }
  });
  const successfulCount = times.length - stats.totalErrors;
  const avg = stats.totalTime / successfulCount;
  if (!isNaN(avg)) {
    console.log(`\nAverage time (${successfulCount} requests): ${avg.toFixed()} ms`);
    console.log(`Max time (#${stats.max.instance}): ${stats.max.time} ms`);
    console.log(`Min time (#${stats.min.instance}): ${stats.min.time} ms`);
  }
  console.log(`Total errors: ${stats.totalErrors}`);
  stats.errosMap.forEach((val, key) => {
    console.log(`  ${key} [${val.errno}]: ${val.count}`);
  });
});
