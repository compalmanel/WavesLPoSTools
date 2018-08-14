const fs = require('fs');
const axios = require('axios');

/**
 * Read the list of transfers from a file, and submit them to the node we are using
 */
const submitTransfers = function() {
    const transfers = getTransfers(config.filename);
    Promise.all(transfers.map(assetsTransfer))
        .then(values => {
            console.log(`${values.length} transfers were submitted!`)
        })
        .catch(error => {
            console.error(error.response ? `Got error status ${error.response.status} during transfer: ${error.response.data.message}` : `${error.message}`);
        });
};

/**
 * Obtain the list of transfers to process
 * if the configuration supplies an assetId it will override the input 
 *
 * @param filename the filename containing the transfer list
 */
const getTransfers = function(filename) {
    if(config.feeAssetId !== null) {
        const transfers = JSON.parse(fs.readFileSync(filename)).map(transfer => ({
            "amount": transfer.amount,
            "fee": config.fee,
            "sender": transfer.sender,
            "attachment": transfer.attachment,
            "recipient": transfer.recipient,
            "feeAssetId": config.feeAssetId
        }));
        console.log(`${transfers.length} transfers were found, feeAssedId was overriden with '${config.feeAssetId}' and fee is: ${config.fee}...`);
        return transfers;
    } else {
        const transfers = JSON.parse(fs.readFileSync(filename));
        console.log(`${transfers.length} transfers were found...`);
        return transfers;
    };
}

/**
 * Invoke the node to submit the transfer transaction, return a promise
 * when the promise is resolved the info about the individual transfer will be logged
 *
 * @param transfer the object defining the transfer
 */
const assetsTransfer = function(transfer) {
    const url = `${config.node}/assets/transfer`;
    const headers = { "Accept": "application/json", "Content-Type": "application/json", "api_key": config.apiKey };
    return axios.post(url, transfer, {headers})
        .then( value => console.log(`Sent ${value.data.amount} of ${value.data.assetId} to ${value.data.recipient}!`));
}

const config = JSON.parse(fs.readFileSync("config.json"));
submitTransfers();
