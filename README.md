This project is inspired by Marc Jansen's WavesLPoSDistributer and follows the same conventions as much as possible. The objective is being able to verify the correctness of each script's output

Use modern JavaScript idioms

Instead of using global variables (var) the code mostly uses constants (const), and in a couple of instances local variables (let). This makes code more maintainable and also guarantees better memory use
Use functional programming patterns and promises to squeeze to be able to asyncrhonously handle requests and improve performance
Use axios to perform REST requests
Code simplification, make each utility as small as possible, but not smaller
Improved logging, print more details about operations, print error conditions to stderr
Have a centralized configuration, it's only necessary to edit one file for all of the scripts to work


updateDatabase.js
* lê os blocos
* INSERT block {
    height,
    generator,
    fees = txs.filter(txtype = 4).reduce(sum)
}
height é a chave primária
verificar nova versão com sponfored asset fees
* INSERT lease {
    address,
    start,
    end,
    amount
}
start e end são chaver externas, block.height



SELECT 
FROM blocks b
INNER JOIN leases l ON b.height >= l.start + 1000 AND b.height < l.end

# WavesLPoSDistributer
A revenue distribution tool for Waves nodes

## Installation
First of all, you need to install Node.js (https://nodejs.org/en/) and NPM. Afterwards the installation of the dependencies could be done via:
```sh
mkdir node_modules
npm install
```
Once the dependencies are installed, the script that generates the payouts need to be configured. In order to do so, change the settings of the configuration section:
```sh
/*
    Put your settings here:
        - address: the address of your node that you want to distribute from
        - startBlockHeight: the block from which you want to start distribution for
        - endBlock: the block until you want to distribute the earnings
        - distributableMRTPerBlock: amount of MRT distributed per forged block
        - filename: file to which the payments for the mass payment tool are written
        - node: address of your node in the form http://<ip>:<port
        - percentageOfFeesToDistribute: the percentage of Waves fees that you want to distribute
 */
var config = {
    address: '',
    startBlockHeight: 462000,
    endBlock: 465000,
    distributableMrtPerBlock: 20,
    filename: 'test.json',
    node: 'http://<ip>:6869',
    percentageOfFeesToDistribute: 100
}
```
After a successful configuration of the tool, it could be started with:
```sh
node app.js
```
After the script is finished, the payments that should be distributed to the leasers are written to the file configured by the _config.filename_ setting in the configuration section.
## Doing the payments
For the actual payout, the masspayment tool needs to be run. Before it could be started, it also needs to be configured:
```sh
/*
 Put your settings here:
 - filename: file to which the payments for the mass payment tool are written
 - node: address of your node in the form http://<ip>:<port>
 - apiKey: the API key of the node that is used for distribution
 */
var config = {
    filename: 'test.json',
    node: 'http://<ip>:<port>',
    apiKey: 'put the apiKey for the node here'
},
```
After configuration, the script could be started with:
```sh
node massPayment.js
```
## Why two seperate tools?
We decided to use two seperate tools since this allows for additional tests of the payments before the payments are actually executed. On the other hand, it does not provide any drawback since both scripts could also be called directly one after the other with:
```sh
node apps.js && node massPayment.js
```
We strongly recommend to check the payments file before the actual payments are done. In order to foster these checks, we added the _checkPaymentsFile.js_ tool that could need to be configured as follows:
```sh
/**
 * Put your settings here:
 *     - filename: file to check for payments
 *     - node: address of your node in the form http://<ip>:<port
 */
var config = {
    filename: '',
    node: 'http://<ip>:<port>'
};
```
After the configuration the checking tool could be executed with:
```sh
node checkPaymentsFile.js
```
The output of the tool should provide an information about how man tokens of each asset will be paid by the payment script. After checking this information, you should be ready to execute the payments.
## Airdrops
Payments for airdrops could be calculated by using the _airdrop.js_ script. Configuration works pretty much the same way as for the other scripts:
```sh
/**
 * Put your settings here:
 *     - address: the address of your node that you want to distribute from
 *     - block: the block for which you want to calculate your richlist
 *     - total: amount of supply for the reference asset
 *     - amountToDistribute: amount of tokens that you want to distribute (have decimals in mind here...)
 *     - assetId: id of the reference asset
 *     - assetToDistributeId: id of the asset you want to airdrop
 *     - filename: name of the file the payments are written to
 *     - node: address of your node in the form http://<ip>:<port
 *     - excludeList: a list of addresses that should not receive the airdrop, e.g., exchanges...
 */
var config = {
    address: '',
    block: 500859,
    amountToDistribute: 35000000,
    assetId: '',
    assetToDistributeId: '',
    filename: '',
    node: '',
    excludeList: []
};
```
Afterwards, the script could be started with:
```sh
node airdrop.js
```
## Disclaimer
Please always test your resulting payment scripts, e.g., with the _checkPaymentsFile.js_ script!