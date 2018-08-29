const sqlite = require('sqlite')
const fs = require('fs')

const feeSQL = `SELECT leaser,
SUM(payable) AS amount
FROM (
    WITH block_leases AS (
      SELECT l.sender AS leaser,
             b.height AS height,
             SUM(l.amount) AS amount
      FROM blocks b
      INNER JOIN leases l ON b.height >= l.start + 1000
                          AND (b.height <= l.[end] OR l.[end] IS NULL) 
                          AND l.recipient = b.generator
      WHERE b.height BETWEEN ? AND ?
      AND b.generator = ?
      GROUP BY l.sender,
               b.height
    ), total_leases AS (
      SELECT b.height AS height,
             SUM(l.amount) AS amount
      FROM blocks b
      INNER JOIN leases l ON b.height >= l.start + 1000
                          AND (b.height <= l.[end] OR l.[end] IS NULL) 
                          AND l.recipient = b.generator
      WHERE b.height BETWEEN ? AND ?
      AND b.generator = ?
      GROUP BY b.height
    )
    SELECT l.leaser,
           CAST( (l.amount * 1.0 / t.amount) * (b1.fees * 0.4 + b2.fees * 0.6) AS INTEGER) AS payable
    FROM blocks b1
    INNER JOIN blocks b2 ON b2.height = b1.height + 1
    INNER JOIN block_leases l ON b1.height = l.height
    INNER JOIN total_leases t ON l.height = t.height
)
GROUP BY leaser
HAVING SUM(payable) > 0`

const mrtSQL = `SELECT leaser,
SUM(payable) AS amount
FROM (
    WITH block_leases AS (
      SELECT l.sender AS leaser,
             b.height AS height,
             SUM(l.amount) AS amount
      FROM blocks b
      INNER JOIN leases l ON b.height >= l.start + 1000
                          AND (b.height <= l.[end] OR l.[end] IS NULL) 
                          AND l.recipient = b.generator
      WHERE b.height BETWEEN ? AND ? 
      AND b.generator = ?
      GROUP BY l.sender,
               b.height
    ), total_leases AS (
      SELECT b.height AS height,
             SUM(l.amount) AS amount
      FROM blocks b
      INNER JOIN leases l ON b.height >= l.start + 1000
                          AND (b.height <= l.[end] OR l.[end] IS NULL) 
                          AND l.recipient = b.generator
      WHERE b.height BETWEEN ? AND ?
      AND b.generator = ?
      GROUP BY b.height
    )
    SELECT l.leaser,
           CAST(l.amount * 1.0 / t.amount * ? * 100 AS INTEGER) AS payable
    FROM block_leases l
    INNER JOIN total_leases t ON l.height = t.height
)
GROUP BY leaser
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
  const dbrows = await Promise.all([
    db.all(feeSQL, [config.startBlock, config.endBlock, config.address, config.startBlock, config.endBlock, config.address])
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
      }),
    db.all(mrtSQL, [config.startBlock, config.endBlock, config.address, config.startBlock, config.endBlock, config.address, config.distributableMrtPerBlock])
      .then(rows => {
        return rows.map(row => {
          return {
            'amount': row.amount,
            'fee': 100000,
            'assetId': '4uK8i4ThRGbehENwa6MxyLtxAjAo1Rj9fduborGExarC',
            'sender': config.address,
            'attachment': '',
            'recipient': row.leaser
          }
        })
      }) ])
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })
  const payout = dbrows.reduce((a, b) => a.concat(b), [])
  fs.writeFileSync(config.filename, JSON.stringify(payout))
  console.log(`Dumped ${payout.length} payments!`)
}

const config = JSON.parse(fs.readFileSync('config.json'))
calculatePayout()
