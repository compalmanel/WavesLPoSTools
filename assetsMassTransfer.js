const fs = require('fs');
const axios = require('axios');

/**
 * Read the list of transfers from a file, and submit them to the node we are using
 * before submission transfers need to be grouped by their assetId
 */
const submitTransfers = function() {
    const transfers = JSON.parse(fs.readFileSync(config.filename));
    console.log(`${transfers.length} total transfers were found:`);
    const assets = transfers.reduce(transfersPerAsset, {});
    Object.keys(assets).map( asset => console.log(`${assets[asset].length} transfers of ${asset}`)) ;
    let requests = [];
    for( const assetId in assets ) {
        requests = requests.concat(assetsMassTransfer(assets[assetId], assetId));
    };
    Promise.all(requests)
        .then(values => {
            console.log(`${values.length} massTransfer transactions were submitted!`)
        })
        .catch(error => {
            console.error(error.response ? `Got error status ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`);
        });
};

/**
 * Function that groups transfers by their assetId
 * returns a dictionary of lists
 *
 * @param accumulator
 * @param currentValue
 */
const transfersPerAsset = function(accumulator, currentValue) {
    const assetId = currentValue.assetId ? currentValue.assetId : 'Waves';
    const transfer = {"recipient": currentValue.recipient, "amount": currentValue.amount};
    if(!accumulator[assetId]) {
        accumulator[assetId] = [transfer];
    } else {
        accumulator[assetId].push(transfer);
    };
    return accumulator;
};

/**
 * This method executes the actual asset mass transfer transaction
 * 
 * @param transfers the list of transfers, there is no limit on the lenght of the list, they will be submitted in batches of 100
 * @param assetId the assetId to pay, might be "Waves"
 */
const assetsMassTransfer = function(transfers, assetId) {
    const payableTransfers = transfers.filter( transfer => transfer.amount > 0);
    let batch = [];
    const url = `${config.node}/assets/masstransfer`;
    const headers = { "Accept": "application/json", "Content-Type": "application/json", "api_key": config.apiKey };
    const batchSize = 100;
    for( let i = 0; i < payableTransfers.length ; i+= batchSize) {
        const transfers = payableTransfers.slice(i, i + batchSize);
        let massTransfer = { version: 1,
                             assetId,
                             sender: config.address,
                             fee: ( 10 + transfers.length * 5 % 10 === 0 ? 10 + transfers.length * 50 : 10 + transfers.length * 5 + 5 ) * 10000,
                             transfers
                           };
        if( assetId === "Waves") {
            delete massTransfer.assetId;
        }
//        console.log(JSON.stringify(massTransfer));
        batch.push(axios.post(url, massTransfer, {headers})
                       .then(value => value.data.transfers.map(tranfer => console.log(`Sent ${tranfer.amount} of ${value.data.assetId} to ${transfer.recipient}!`)))
        );
    };
    return batch;
};

const config = JSON.parse(fs.readFileSync("config.json"));
submitTransfers();
