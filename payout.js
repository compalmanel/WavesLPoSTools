const sqlite = require('sqlite')
const fs = require('fs')
const base58 = require("base-58")

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
           CAST( (l.amount * 1.0 / t.amount) * (? * 1.0 / 100) * (b1.fees * 0.4 + b2.fees * 0.6) AS INTEGER) AS payable
    FROM blocks b1
    INNER JOIN blocks b2 ON b2.height = b1.height - 1
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
           CAST(l.amount * 1.0 / t.amount * ? * 100.0 AS INTEGER) AS payable
    FROM block_leases l
    INNER JOIN total_leases t ON l.height = t.height
)
GROUP BY leaser
HAVING SUM(payable) > 0`

/**
 * Read the list of transfers from a file, and submit them to the node we are using
 * before submission transfers need to be grouped by their assetId
 *
 * @param {Number} startBlock the starting block for the calculation
 * @param {Number} endBlock the end block for the calculation
 * @param {Number} MrtPerBlock the amount of Miner's Reward Tokens to distribute per block
 */
const calculatePayout = async function (startBlock, endBlock, MrtPerBlock) {
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
  console.log(`Calculating payout for node ${config.address} from blocks ${startBlock} to ${endBlock}.`)
  console.log(`${config.percentageOfFeesToDistribute}% of fees will be distributed, and ${MrtPerBlock} MRT will be paid per block.`)
  const dbrows = await Promise.all([
    db.all(feeSQL, [startBlock, endBlock, config.address, startBlock, endBlock, config.address, config.percentageOfFeesToDistribute])
      .then(rows => {
        return rows.map(row => {
          return {
            'amount': row.amount,
            'fee': 100000,
            'sender': config.address,
            'attachment': config.attachment ? base58.encode(Buffer.from(config.attachment)) : '',
            'recipient': row.leaser
          }
        })
      }),
    db.all(mrtSQL, [startBlock, endBlock, config.address, startBlock, endBlock, config.address, MrtPerBlock])
      .then(rows => {
        return rows.map(row => {
          return {
            'amount': row.amount,
            'fee': 100000,
            'assetId': '4uK8i4ThRGbehENwa6MxyLtxAjAo1Rj9fduborGExarC',
            'sender': config.address,
            'attachment': config.attachment ? base58.encode(Buffer.from(config.attachment)) : '',
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
 * Parse command line parameters
 * @returns a list of parameters
 */
const getopt = function () {
  if (process.argv.length < 5) {
    console.error(`Syntax:
  ${process.argv[0].split(/[\\/]/).pop()} ${process.argv[1].split(/[\\/]/).pop()} startBlock endBlock MrtPerBlock
`)
    process.exit(1)
  } else {
    return process.argv.slice(2)
  }
}

const config = getConfig()
calculatePayout(...getopt())
