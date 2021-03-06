const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')
const axios = require('axios')
const http = require('http')
const https = require('https')
const fs = require('fs')

/*
* Create session defaults for axios
*/
module.exports = axios.create({
  // 60 sec timeout
  timeout: 60000,
  // keepAlive pools and reuses TCP connections, so it's faster
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  // follow up to 10 HTTP 3xx redirects
  maxRedirects: 10,
  // cap the maximum content length we'll accept to 50MBs, just in case
  maxContentLength: 50 * 1000 * 1000
})

const schemaSQL = [
  `CREATE TABLE IF NOT EXISTS nodes (
    address text PRIMARY KEY,
    alias text
  );`,
  `CREATE TABLE IF NOT EXISTS blocks (
    height integer PRIMARY KEY,
    generator text NOT NULL REFERENCES nodes (address),
    fees integer NOT NULL DEFAULT 0,
    reward integer NOT NULL DEFAULT 0,
    txs integer NOT NULL DEFAULT 0,
    timestamp integer NOT NULL
  );`, /*,
  `CREATE TRIGGER IF NOT EXISTS new_node
   BEFORE INSERT ON blocks
   FOR EACH ROW WHEN NOT EXISTS (SELECT address FROM nodes WHERE address = new.generator)
   BEGIN
       INSERT OR REPLACE INTO nodes (address) VALUES (new.generator);
   END;`, */
  `CREATE TABLE IF NOT EXISTS leases (
    id text PRIMARY KEY, 
    sender text NOT NULL,
    recipient text NOT NULL,
    start integer NOT NULL,
    end integer,
    amount integer NOT NULL
  );`,
  `CREATE VIEW IF NOT EXISTS missing_blocks AS
   SELECT a.height + 1 AS height
   FROM blocks a
   WHERE NOT EXISTS (
                   SELECT 1
                   FROM blocks b
                   WHERE b.height = a.height + 1
                  )
   ORDER BY a.height ASC;`
]

const aliasRE = /alias:W:(.+)/

/**
 * Resolve an alias to a Waves address
 *
 * @param {string} node the node we will retrieve the information from
 * @param {string} alias the alias to resolve
 * @returns a Promise
 */
const resolveAlias = function (node, alias) {
  return axios.get(`${node}/alias/by-alias/${alias}`)
    .then(value => value.data.address)
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })
}

/**
 * Store a transaction in the database
 *
 * @param {Object} db the database handle that represents a valid open connection
 * @param {string} node the node we will retrieve the information from
 * @param {number} height the height of the block this transactions belongs to
 * @param {Object} transaction the object containing the transaction information
 * @returns a Promise
 */
const storeTransaction = async function (db, node, height, transaction) {
  // handlers for each transaction type
  const txHandler = {
    8: async transaction => {
      const alias = aliasRE.exec(transaction.recipient)
      const recipient = alias ? await resolveAlias(node, alias[1]) : transaction.recipient
      db.run(`INSERT INTO leases (id, sender, recipient, start, amount) VALUES (?, ?, ?, ?, ?);`,
        [transaction.id, transaction.sender, recipient, height, transaction.amount])
    },
    9: async transaction => {
      db.run(`UPDATE leases SET end = ? WHERE id = ?`, [height, transaction.leaseId])
    }
  }
  return transaction.type in txHandler ? txHandler[transaction.type](transaction) : Promise.resolve(true)
}

/**
 * Store a block in the database
 *
 * @param {Object} db the database handle that represents a valid open connection
 * @param {string} node the node we will retrieve the information from
 * @param {Object} block the object containing the block information
 * @returns a Promise
 */
const storeBlock = function (db, node, block) {
  // calculate fees
  const fees = block.transactions.reduce((accumulator, currentValue) => {
    if (!currentValue.feeAsset || currentValue.feeAsset === '' || currentValue.feeAsset === null) {
      if (currentValue.fee < 10 * Math.pow(10, 8)) {
        return accumulator + currentValue.fee
      }
    } else if (block.height > 1090000 && currentValue.type === 4) {
      return accumulator + 100000
    }
  }, 0)
  // after activation of WEP4 save the block reward
  const reward = (block.height >= 1740000) ? block.reward : 0
  // write to the corresponding tables
  const savedBlock = [db.run(`INSERT OR REPLACE INTO blocks (height, generator, fees, reward, txs, timestamp) VALUES (?, ?, ?, ?, ?, ?);`,
    [block.height, block.generator, fees, reward, block.transactions.length, block.timestamp])]
  const savedTransactions = block.transactions.map(tx => storeTransaction(db, node, block.height, tx))
  // return a Promise
  return Promise.all([...savedBlock, ...savedTransactions])
    .catch(error => {
      console.error(error.message)
    })
}

/**
 * Returns the list of blocks that was requested
 * the blocks are retrieved in batches of 100 and saved to the database
 *
 * @param {Object} db the database handle that represents a valid open connection
 * @param {string} node the node we will retrieve the information from
 * @param {number} batchSize the number of blocks to download in each call
 * @param {number} startHeight the starting block height
 * @param {number} endHeight the ending block height
 * @returns a Promise
 */
const getBlocks = async function (db, node, batchSize, startHeight, endHeight) {
  for (let i = startHeight; i <= endHeight; i += batchSize) {
    await axios.get(`${node}/blocks/seq/${i}/${i + batchSize - 1}`)
      .then(value => {
        Promise.all(value.data.map(block => storeBlock(db, node, block)))
        console.log(`Stored blocks ${value.data[0].height} to ${value.data[value.data.length - 1].height}`)
      })
      .catch(error => {
        console.error(error.message)
        process.exit(1)
      })
  }
}

/**
 * Create a populate a sqlite database with the Waves Blockchain information
 *
 * @param {Object} config the configuration object
 */
const updateDatabase = async function (config) {
  // open the database
  const db = await sqlite.open({
    filename: config.blockStorage,
    driver: sqlite3.Database
  })
    .then(value => {
      console.log('Connected to the blocks database.')
      return value
    })
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })

  // handle the schema
  for (const stmt of schemaSQL) {
    await db.run(stmt)
      .catch(error => {
        console.error(error.message)
        process.exit(1)
      })
  }
  console.log('Schema is ok...')

  // try the download the blocks we are missing
  const [start, end] = await Promise.all([
    db.get('SELECT height FROM missing_blocks;')
      .then(value => value ? value.height : 0),
    axios.get(`${config.node}/blocks/height`)
      .then(value => value.data.height)
  ]).catch(error => {
    console.error(`Error getting missing blocks: ${error.message}`)
    process.exit(1)
  })
  console.log(`Will try to download blocks from ${start} to ${end}`)
  await getBlocks(db, config.node, config.batchSize, start, end)

  // close the database
  db.close()
    .then(value => {
      console.log('Closed connection to the blocks database.')
    })
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })
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

updateDatabase(getConfig())
