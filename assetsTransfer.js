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
 */
const submitTransfers = function () {
  const transfers = getTransfers(config.filename)
  Promise.all(transfers.map(assetsTransfer))
    .then(values => {
      console.log(`${values.length} transfer transactions were submitted!`)
      console.log(`${values.filter(value => value != null).length} transfer transactions were accepted!`)
    })
    .catch(error => {
      console.error(error.response ? `Got error status ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`)
    })
}

/**
 * Obtain the list of transfers to process
 * if the configuration supplies an assetId it will override the input
 *
 * @param {string} filename the filename containing the transfer list
 * @returns the list of transfers to process
 */
const getTransfers = function (filename) {
  if (config.feeAssetId) {
    const transfers = JSON.parse(fs.readFileSync(filename)).map(transfer => ({
      'amount': transfer.amount,
      'fee': config.fee,
      'sender': transfer.sender,
      'attachment': transfer.attachment,
      'recipient': transfer.recipient,
      'feeAssetId': config.feeAssetId
    }))
    console.log(`${transfers.length} transfers were found, feeAssetId was overriden with '${config.feeAssetId}' and fee is: ${config.fee}...`)
    return transfers
  } else {
    const transfers = JSON.parse(fs.readFileSync(filename))
    console.log(`${transfers.length} transfers were found...`)
    return transfers
  }
}

/**
 * Invoke the node to submit the transfer transaction
 * when the promise is resolved the info about the individual transfer will be logged
 * the promise always succeeds as errors are being caught and logged
 *
 * @param {Object} transfer the object defining the transfer
 * @returns a Promise
 */
const assetsTransfer = function (transfer) {
  const url = `${config.node}/assets/transfer`
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api_key': config.apiKey }
  return axios.post(url, transfer, { headers })
    .then(value => console.log(`Sent ${value.data.amount} of ${value.data.assetId} to ${value.data.recipient}!`))
    .catch(error => console.error(error.response ? `Got error status ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`))
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
