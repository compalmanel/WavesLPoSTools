const sqlite3 = require('sqlite3').verbose();
const request = require('sync-request');
const fs = require('fs');
const axios = require('axios');

const schemaSQL = [
  `CREATE TABLE IF NOT EXISTS blocks (
    height integer PRIMARY KEY,
    generator text NOT NULL,
    fees integer NOT NULL DEFAULT 0,
    txs integer NOT NULL DEFAULT 0,
    timestamp integer NOT NULL
);`,
  `CREATE INDEX IF NOT EXISTS idx_generator ON blocks (generator);`,
  `CREATE TABLE IF NOT EXISTS leases (
    leaser text,
    start integer,
    end integer,
    node text,
    amount integer,
    PRIMARY KEY (leaser, start)
);`];

const sqlins = `
INSERT INTO blocks (height, generator, fees, timestamp)
VALUES (1, 'add', 1), (2, 'add', 2), (3, 'add', 3);`;

const lastblock = `
SELECT MAX(height) AS top
FROM blocks;`;

const storeBlock = function (db, block) {
  // calculate fees
  const fees = block.transactions.reduce((accumulator, currentValue) => {
    if (!currentValue.feeAsset || currentValue.feeAsset === '' || currentValue.feeAsset === null) {
      if (currentValue.fee < 10 * Math.pow(10, 8)) {
        return accumulator + currentValue.fee;
      }
    } else if (block.height > 1090000 && currentValue.type === 4) {
      return accumulator + 100000;
    }
  }, 0);
  // write the blocks db record
  return db.run(`INSERT OR REPLACE INTO blocks (height, generator, fees, txs, timestamp) VALUES (?, ?, ?, ?, ?);`,
    [block.height, block.generator, fees, block.transactions.length, block.timestamp],
    function (err) {
      if (err) {
        return console.log(err.message);
      }
      return `${this.lastID}`;
    });
};

const getBlocks = function (db) {
  const currentStartBlock = 1;
  const endBlock = 100;
  currentBlocks = JSON.parse(request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + endBlock, {
    'headers': {
      'Connection': 'keep-alive'
    }
  }).getBody('utf8'));
  return currentBlocks.map(block => storeBlock(db, block));
};

const config = JSON.parse(fs.readFileSync("config.json"));

// open the database
const db = new sqlite3.Database('blocks.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the blocks database.');
});

db.serialize(() => {

  // (re)create schema
  schemaSQL.map(stmt => db.run(stmt, function (err) {
    if (err) {
      return console.error(err.message);
    }
  }));

  // populate data
  db.parallelize(() => getBlocks(db));

  const row = db.get(lastblock, [], (err, row) => {
    if (err) {
      console.error(err.message);
      return null;
    }
    return row ? console.log(row.top) : console.log(`No results`);
  });
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Closed the database connection.');
});
