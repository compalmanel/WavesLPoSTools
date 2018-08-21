const fs = require('fs')
const axios = require('axios')

/**
 * Read the list of transfers from a file and aggregate them per asset
 */
const checkTransfers = function() {
    const payments = JSON.parse(fs.readFileSync(config.filename));
    console.log(`${payments.length} payments found!`);
    const totals = payments.reduce(sumPerAsset, {});
    Promise.all(Object.keys(totals).map(getAssetInfo))
        .then( assets => {
            assets.map( asset => console.log(`${totals[asset.data.assetId].number} payments of ${asset.data.name} will be processed, a total of ${(totals[asset.data.assetId].amount / Math.pow(10, asset.data.decimals))} will be paid!`));
        })
        .catch(error => {
            console.error(error.response ? `Got error ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`);
        });
};

/**
 * Aggregate the total amount to transfer for each asset
 *
 * @param accumulator
 * @param currentValue
 */
const sumPerAsset = function(accumulator, currentValue) {
    const assetId = currentValue.assetId ? currentValue.assetId : 'Waves';
    if(!accumulator[assetId]) {
        accumulator[assetId] = {
            amount: currentValue.amount,
            number: 1
        };
    } else {
        accumulator[assetId].amount += currentValue.amount;
        accumulator[assetId].number++;
    };
    return accumulator;
};

/**
 * Invoke the node to retrieve the information about an asset, returns a promise
 *
 * @param asset The asset id
 */
const getAssetInfo = function(assetId) {
    if(assetId === 'Waves') {
        return Promise.resolve( {
                    "data": {
                        "assetId": "Waves",
                        "decimals": 8,
                        "name": 'Waves'
                    }
               });
    } else {
        return axios.get(`${config.node}/transactions/info/${assetId}`);
    };
};

const config = JSON.parse(fs.readFileSync("config.json"))
checkTransfers();

