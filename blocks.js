const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const axios = require('axios');

const sqlsrc = `
CREATE TABLE IF NOT EXISTS blocks (
    height integer PRIMARY KEY,
    generator text NOT NULL,
    fees integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_generator ON blocks (generator);
CREATE TABLE IF NOT EXISTS leases (
    leaser text PRIMARY KEY,
    start integer,
    end integer,
    node text
)
`;

const config = JSON.parse(fs.readFileSync("config.json"));

// open the database
let db = new sqlite3.Database('blocks.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the blocks database.');
});
 
/*
db.serialize(() => {
  db.each(`SELECT PlaylistId as id,
                  Name as name
           FROM playlists`, (err, row) => {
    if (err) {
      console.error(err.message);
    }
    console.log(row.id + "\t" + row.name);
  });
});
*/

db.run(sqlsrc, function (err) {
    if (err) {
      return console.error(err.message);
    }
    console.log(`Schema (re)created.`);
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Close the database connection.');
});

