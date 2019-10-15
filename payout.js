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

/**
 * Query the blocks database to retrieve the leasers and their respective
 * share of the node's revenue for the given period
 *
 * @param {Object} config the configuration object
 * @param {Object} args the command line arguments we received
 */
const calculatePayout = async function (config, args) {
  // get the LeaserTransferFee
  const leaserTransferFee = config.leaserTransferFee || 0
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
  console.log(`Calculating fees and rewards for generator ${config.address} from blocks ${args.startBlock} to ${args.endBlock}.`)
  console.log(`Will distribute ${config.percentageOfFeesToDistribute}% of earnings, and charge ${leaserTransferFee} Waves for each transfer.`)
  const dbrows = await db.all(feeSQL, [args.startBlock, args.endBlock, config.address, args.startBlock, args.endBlock, config.address, config.percentageOfFeesToDistribute])
    .then(rows => {
      return rows.map(row => {
        const payout = {
          'amount': row.amount - Math.trunc(leaserTransferFee * 100000000),
          'fee': 100000,
          'sender': config.address,
          'recipient': row.leaser
        }
        if (config.attachment) payout.attachment = base58.encode(Buffer.from(config.attachment))
        return payout
      })
    })
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
  if (nans.length > 0 || process.argv.length < 4) {
    console.error(`Error parsing command line arguments...\n\nSyntax: ${path.basename(process.argv[0])} ${path.basename(process.argv[1])} startBlock endBlock`)
    process.exit(1)
  }
  return {
    'startBlock': args[0],
    'endBlock': args[1]
  }
}

calculatePayout(getConfig(), getArgs())
