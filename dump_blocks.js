const sqlite3 = require('sqlite3').verbose()

// open the database
const db = new sqlite3.Database('blocks.db', (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log('Connected to the blocks database.')
})

const sql = `SELECT height, generator, fees, txs, timestamp
            FROM blocks
            ORDER BY height`

db.each(sql, [], (err, row) => {
  if (err) {
    throw err
  }
  console.log(`height: ${row.height} generator: ${row.generator} fees: ${row.fees} txs: ${row.txs} timestamp: ${row.timestamp}`)
})

// close the database connection
db.close()
