const sqlite = require('sqlite')
const fs = require('fs')
const path = require('path')
const base58 = require('base-58')

const feeSQL = `SELECT leaser,
CAST( SUM(payable) AS INTEGER ) AS amount
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
           (l.amount * 1.0 / t.amount) * (? / 100.0) * (b1.fees * 0.4 + b2.fees * 0.6 + b1.reward) AS payable
    FROM blocks b1
    INNER JOIN blocks b2 ON b2.height = b1.height - 1
    INNER JOIN block_leases l ON b1.height = l.height
    INNER JOIN total_leases t ON l.height = t.height
)
GROUP BY leaser
HAVING SUM(payable) > 0`

const mrtSQL = `SELECT leaser,
CAST( SUM(payable) * 100 AS INTEGER ) AS amount
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
           l.amount * 1.0 / t.amount * ? AS payable
    FROM block_leases l
    INNER JOIN total_leases t ON l.height = t.height
)
GROUP BY leaser
HAVING SUM(payable) > 0`

/**
 * Read the list of transfers from a file, and submit them to the node we are using
 * before submission transfers need to be grouped by their assetId
 *
 * @param {Object} config the configuration object
 * @param {Object} args the command line arguments we received
 */
const calculatePayout = async function (config, args) {
  // open the database
  const db = await sqlite.open(config.blockStorage, sqlite.OPEN_READONLY)
    .then(value => {
      console.log('Connected to the blocks database.')
      return value
    })
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })

  // query the dabatase
  console.log(`Calculating payout for generator ${config.address} from blocks ${args.startBlock} to ${args.endBlock}.`)
  console.log(`${config.percentageOfFeesToDistribute}% of fees will be distributed, and ${args.MrtPerBlock} MRT will be paid per block.`)
  const dbrows = await Promise.all([
    db.all(feeSQL, [args.startBlock, args.endBlock, config.address, args.startBlock, args.endBlock, config.address, config.percentageOfFeesToDistribute])
      .then(rows => {
        return rows.map(row => {
          const payout = {
            'amount': row.amount,
            'fee': 100000,
            'sender': config.address,
            'recipient': row.leaser
          }
          if (config.attachment) payout.attachment = base58.encode(Buffer.from(config.attachment))
          return payout
        })
      }),
    db.all(mrtSQL, [args.startBlock, args.endBlock, config.address, args.startBlock, args.endBlock, config.address, args.MrtPerBlock])
      .then(rows => {
        return rows.map(row => {
          const payout = {
            'amount': row.amount,
            'fee': 100000,
            'assetId': '4uK8i4ThRGbehENwa6MxyLtxAjAo1Rj9fduborGExarC',
            'sender': config.address,
            'recipient': row.leaser
          }
          if (config.attachment) payout.attachment = base58.encode(Buffer.from(config.attachment))
          return payout
        })
      }) ])
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })
  const payout = (dbrows.reduce((a, b) => a.concat(b), [])).filter(transfer => transfer.amount > 0)
  fs.writeFileSync(config.filename, JSON.stringify(payout))
  console.log(`Dumped ${payout.length} payments!`)
}

/**
 * Read the configuration from 'config.json'
 */
const getConfig = function () {
  try {
    return JSON.parse(fs.readFileSync('config.json'))
  } catch (error) {
    console.error(`Encountered an error reading the config file: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Get command line arguments
 */
const getArgs = function () {
  const args = process.argv.slice(2).map(i => parseInt(i))
  const nans = args.filter(i => isNaN(i))
  if (nans.length > 0 || process.argv.length < 5) {
    console.error(`Error parsing command line arguments...\n\nSyntax: ${path.basename(process.argv[0])} ${path.basename(process.argv[1])} startBlock endBlock MrtPerBlock`)
    process.exit(1)
  }
  return {
    'startBlock': args[0],
    'endBlock': args[1],
    'MrtPerBlock': args[2]
  }
}

calculatePayout(getConfig(), getArgs())
