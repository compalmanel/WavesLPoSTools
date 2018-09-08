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
 * Read the list of transfers from a file and aggregate them per asset
 */
const checkTransfers = function () {
  const payments = JSON.parse(fs.readFileSync(config.filename))
  console.log(`${payments.length} payments found!`)
  const totals = payments.reduce(sumPerAsset, {})
  Promise.all(Object.keys(totals).map(getAssetInfo))
    .then(assets => {
      assets.map(asset => console.log(`${totals[asset.data.assetId].number} payments of ${asset.data.name} will be processed, a total of ${(totals[asset.data.assetId].amount / Math.pow(10, asset.data.decimals))} will be paid!`))
    })
    .catch(error => {
      console.error(error.response ? `Got error ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`)
    })
}

/**
 * Aggregate the total amount to transfer for each asset
 *
 * @param accumulator
 * @param currentValue
 */
const sumPerAsset = function (accumulator, currentValue) {
  const assetId = currentValue.assetId ? currentValue.assetId : 'Waves'
  if (!accumulator[assetId]) {
    accumulator[assetId] = {
      amount: currentValue.amount,
      number: 1
    }
  } else {
    accumulator[assetId].amount += currentValue.amount
    accumulator[assetId].number++
  };
  return accumulator
}

/**
 * Invoke the node to retrieve the information about an asset, returns a promise
 *
 * @param asset The asset id
 */
const getAssetInfo = function (assetId) {
  if (assetId === 'Waves') {
    return Promise.resolve({
      'data': {
        'assetId': 'Waves',
        'decimals': 8,
        'name': 'Waves'
      }
    })
  } else {
    return axios.get(`${config.node}/transactions/info/${assetId}`)
  }
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
checkTransfers()
