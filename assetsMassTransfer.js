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

/**
 * Read the list of transfers from a file, and submit them to the node we are using
 * before submission transfers need to be grouped by their assetId
 */
const submitTransfers = function () {
  const transfers = JSON.parse(fs.readFileSync(config.filename))
  console.log(`${transfers.length} total transfers were found:`)
  const assets = transfers.reduce(transfersPerAsset, {})
  Object.keys(assets).map(asset => console.log(`${assets[asset].length} transfers of ${asset}`))
  const requests = Object.keys(assets).map(assetId => assetsMassTransfer(assets[assetId], assetId))
  Promise.all([].concat(...requests))
    .then(values => {
      console.log(`${values.length} massTransfer transactions were submitted!`)
      console.log(`${values.filter(value => value != null).length} massTransfer transactions were accepted!`)
    })
    .catch(error => {
      console.error(error.response ? `Got error status ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`)
    })
}

/**
 * Function that groups transfers by their assetId
 * each list will contain only a recipient and amount
 *
 * @param {Object} accumulator
 * @param {Array} currentValue
 * @returns returns a dictionary of lists
 */
const transfersPerAsset = function (accumulator, currentValue) {
  const assetId = currentValue.assetId ? currentValue.assetId : 'Waves'
  const transfer = { 'recipient': currentValue.recipient, 'amount': currentValue.amount }
  if (!accumulator[assetId]) {
    accumulator[assetId] = [transfer]
  } else {
    accumulator[assetId].push(transfer)
  }
  return accumulator
}

/**
 * Utility function that breaks a list into chunks of predefined size
 *
 * @param {Array} arr the list to chunk
 * @param {number} size the size of each chunk
 * @returns a list of lists
 */
const chunk = (arr, size) =>
  arr
    .reduce((acc, _, i) =>
      (i % size)
        ? acc
        : [...acc, arr.slice(i, i + size)]
    , [])

/**
 * This method executes the actual asset mass transfer transaction
 * when each promise is resolved the info about the individual transfers in each batch will be logged
 * every promise succeeds as errors are being caught and logged
 *
 * @param {Array} transfers the list of transfers, there is no limit on the lenght of the list, they will be submitted in batches of 100
 * @param {string} assetId the assetId to pay, might be "Waves"
 * @returns a list of Promise
 */
const assetsMassTransfer = function (payout, assetId) {
  const url = `${config.node}/assets/masstransfer`
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api_key': config.apiKey }
  const transferChunks = chunk(payout.filter(transfer => transfer.amount > 0), 100)
  return transferChunks.map(transfers => {
    const massTransfer = {
      version: 1,
      assetId,
      sender: config.address,
      fee: (10 + transfers.length * 5 % 10 === 0 ? 10 + transfers.length * 5 : 10 + transfers.length * 5 + 5) * 10000,
      transfers
    }
    if (assetId === 'Waves') {
      delete massTransfer.assetId
    }
    return axios.post(url, massTransfer, { headers })
      .then(value => value.data.transfers.map(transfer => console.log(`Sent ${transfer.amount} of ${value.data.assetId} to ${transfer.recipient}!`)))
      .catch(error => console.error(error.response ? `Got error status ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`))
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

const config = getConfig()
submitTransfers()
