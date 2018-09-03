# WavesLPoSTools
A set of tools that handle a [Waves](https://wavesplatform.com) node's accounting and payments.

This project is modelled on Marc Jansen's [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer) and follows the same conventions as much as possible. The objective is being a drop in replacement, with the added bonus of being able to verify the correctness of each script's output.

The code was written from scratch, with the intent of improving several areas:
* providing easier, centralized configuration that is isolated in a separate file;
* lowering memory and disk requirements;
* lowering execution time;
* allowing data analysis and statistics on top of the blockchain information.

The code is written in [Javascript](https://developer.mozilla.org/bm/docs/Web/JavaScript) using modern paradigms like asynchronous and functional programming. It uses [ES6 Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) and [ES7 async/await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) to provide the best performance.

As in [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer) you can use the payment utilities to execute payments for any file that conforms to the ```payout.json``` format. So if you have any homebrew utilities that write their output in this format you can keep on using them as usual.

## Installation
After cloning this repository to your node or another machine, you need to install [node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/). Afterwards the installation of the dependencies is as easy as:
```sh
mkdir node_modules
npm install
```
The configuration has been streamlined and all of the scripts read the necessary parameters from a single file. Once the dependencies are installed, edit the sample configuration file (```config.json.sample```) and set the values for your node. Save the file as ```config.json```.

If you have used [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer) you should be familiar with the meaning of each parameter:
* "address": your node's public address;
* "alias": your node's alias;
* "startBlockHeight": the starting height for the payout calculation;
* "endBlock": the ending height for the payout calculation;
* "distributableMrtPerBlock": the amount of [Miners Reward Token](https://blog.wavesplatform.com/incentivizing-pos-mining-b26f8702032c) to distribute per block;
* "filename": the payout list will be saved and read from this file, the default is ```payout.json```, and the format is the same as [WavesLPoSDistributer's](https://github.com/jansenmarc/WavesLPoSDistributer) so you can compare the output;
* "node": the node to contact to retrieve information and transfer the payout from, you can use ```http://localhost:6869``` if you execute the scripts directly from your node's machine or through a [ssh tunnel](https://www.ssh.com/ssh/tunneling/example);
* "percentageOfFeesToDistribute": a generator node earns fees according to the number of blocks it has forged, this parameter allows you to specify the percentage of those fees you want to distribute;
* "blockStorage": the file where blockchain information will be saved, it defaults to ```blocks.db```;
* "apiKey": the API key for your node, only needed for payments;
* "feeAssetId": if you're using simple asset transfer transactions you can choose the asset that will be used to pay for the transaction fee, it needs to be a [sponsored asset](https://docs.wavesplatform.com/en/proposals/sponsored-transactions.html), mass transfers are paid only in Waves;
* "fee": the fee amount in case of using a [sponsored transaction](https://docs.wavesplatform.com/en/proposals/sponsored-transactions.html).

After saving your configuration you can starting using the scripts.

## Updating the blockchain information

Information about generated blocks and active leases is saved into a database file. A [SQLite](https://www.sqlite.org/index.html) database is used. This engine is very efficient in terms of speed, used disk space and memory consumption.

The update process is started with:
```sh
node blocks.js
```
This will download all the outstanding blocks and save them to the block storage database file. The first run will take a lot of time as all of the blocks since the genesis block will be downloaded. Subsequent runs will be faster as they will only need to download the delta between each run.

Information for all the nodes will be downloaded and parsed. You can open the block storage database file with [SQLiteStudio](https://sqlitestudio.pl) to query the database and extract statistics.
## Check the generated payments
The number of payments and the total amount that will be paid can be verified through the ```checkTransfer.js``` script. The payments will be aggregated per asset.
```sh
node checkTransfer.js
```
Always check your resulting payments and compare them to the node's expected earnings and current balance!
## Paying using the assets/transfer transaction
After verifying the payments you can trigger the payment. The ```assetsTransfer.js``` script uses the traditional assets/transfer transaction to trigger a separate transaction for each payment. You can use an asset that has been [sponsored](https://docs.wavesplatform.com/en/proposals/sponsored-transactions.html). Use the following command to process the payments stored in ```payout.json```.
```sh
node assetsTransfer.js
```
## Paying using the assets/massTransfer transaction
The [mass transfer transaction](https://medium.com/@wavesgo/the-new-mass-transfer-transaction-in-action-852b60d64d01) was introduced to maximize network throughput and minimize transactions costs. You can use ```assetsMassTransfer.js``` to aggregate the payments per asset and execute those payments in the minimum amount of transactions possible. Use the following command to process the payments stored in ```payout.json```.
```sh
node assetsMassTransfer.js
```
It is only worthwhile to use this payment form if you have a lot of payments in the same asset, if you are doing isolated payments it is better to use assets/transfer.
## Acknowledgements
I would like to thank [Mark Jansen](https://github.com/jansenmarc) for his outstanding work in the Waves community and for making available tools, examples and documentation for the [Waves platform](https://wavesplatform.com).
## Disclaimer
This software is provided "as is" and any express or implied warranties, including, but not limited to, the implied warranties of merchantability and fitness for a particular purpose are disclaimed. In no event shall the authors be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, procurement of substitute goods or services; loss of use, data, or profits; or business interruption) however caused and on any theory of liability, whether in contract, strict liability, or tort (including negligence or otherwise) arising in any way out of the use of this software, even if advised of the possibility of such damage.