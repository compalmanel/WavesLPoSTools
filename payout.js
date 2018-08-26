const sqlite = require('sqlite')
const fs = require('fs')

const sqlquery = `SELECT leaser, SUM(payable) AS amount
FROM (
    WITH block_leases AS (
        SELECT l.sender AS leaser,
               b.height AS height,
               SUM(l.amount) AS amount 
        FROM leases l
        INNER JOIN blocks b ON l.start + 1000 <= b.height AND l.end <= b.height AND l.recipient = b.generator
        WHERE b.height BETWEEN ? AND ?
        AND b.generator = ?
        GROUP BY l.sender, b.height
    ),
        total_leases AS (
        SELECT b.height AS height,
               SUM(l.amount) AS amount 
        FROM leases l
        INNER JOIN blocks b ON l.start + 1000 <= b.height AND l.end <= b.height AND l.recipient = b.generator
        WHERE b.height BETWEEN ? AND ?
        AND b.generator = ?
        GROUP BY b.height
    )
    SELECT l.leaser,
           CAST(SUM(l.amount) * 1.0 / SUM(t.amount) * b.fees AS INTEGER) AS payable
    FROM blocks b
    INNER JOIN block_leases l ON b.height = l.height
    INNER JOIN total_leases t ON l.height = t.height
    GROUP BY l.leaser, b.height
)
GROUP BY LEASER
HAVING SUM(payable) > 0`

/**
 * Read the list of transfers from a file, and submit them to the node we are using
 * before submission transfers need to be grouped by their assetId
 */
const calculatePayout = async function () {
  // open the database
  const db = await sqlite.open(config.blockStorage)
    .then(value => {
      console.log('Connected to the blocks database.')
      return value
    })
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })

  // query the dabatase
  console.log('Calculating payout...')
  const payout = await db.all(sqlquery, [config.startBlock, config.endBlock, config.address, config.startBlock, config.endBlock, config.address])
    .then(rows => {
      return rows.map(row => {
        return {
          'amount': row.amount,
          'fee': 100000,
          'sender': config.address,
          'attachment': '',
          'recipient': row.leaser
        }
      })
    })
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })
  fs.writeFileSync(config.filename, JSON.stringify(payout))
  console.log(`Dumped ${payout.length} payments!`)
}

const config = JSON.parse(fs.readFileSync('config.json'))
calculatePayout()
