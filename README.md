# WavesLPoSTools
A set of tools that handle a [Waves](https://wavesplatform.com) node's accounting and payments. Currently this is beta quality software and it's not advisable to use it on Mainnet. The code is being released to gather feedback from the community and get it into a production-ready state.

This project is modelled on Marc Jansen's [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer) and follows the same conventions as much as possible. The objective is being a drop in replacement. Following the same structure has the added bonus of being able to verify the correctness of each script's output.

The code was written from scratch, with the intent of improving several areas:
* providing easier, centralized configuration that is isolated in a separate file;
* lowering memory and disk requirements;
* lowering execution time;
* allowing data analysis and statistics on top of the blockchain information.

There is some overlap with functionality provided by [Waves data service API](https://github.com/wavesplatform/data-service) and [Waves blockchain — PostgreSQL sync scripts](https://github.com/wavesplatform/blockchain-postgres-sync), but these projects currently don't provide all the information required to calculate a node payout (namely the lease information).

The code is written in [Javascript](https://developer.mozilla.org/bm/docs/Web/JavaScript) using modern paradigms like [asynchronous I/O](https://nodejs.org/en/docs/guides/blocking-vs-non-blocking/) and functional programming. It uses [ES6 Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) and [ES7 async/await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) to provide the best performance.

As in [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer) you can use the payment utilities to execute payments for any file that conforms to the ```payout.json``` format. So if you have any homebrew utilities that write their output in this format you can keep on using them as usual.

## Installation
You can install these utilities to your node or another machine. Uou need to install [node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/), then clone the git repository and install the the dependencies:
```sh
git clone https://github.com/compalmanel/WavesLPoSTools
mkdir node_modules
npm install
```
The configuration has been streamlined and all of the scripts read the necessary parameters from a single file. Once the dependencies are installed, edit the sample configuration file (```config.json.sample```) and set the values for your node. Save the file as ```config.json```.

If you have used [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer) you should be familiar with the meaning of each parameter. They are:
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
This will download all the outstanding blocks and save them to the block storage database file. The first run will take a lot of time as all of the blocks since the genesis block will be downloaded. Subsequent runs will be faster as they will only need to download the delta between each run.  The output of a typical run will look this:
```
Connected to the blocks database.
Schema is ok...
Will try to download blocks from 1155222 to 1157410
Stored blocks 1155222 to 1155321
Stored blocks 1155322 to 1155421
Stored blocks 1155422 to 1155521
Stored blocks 1155522 to 1155621
Stored blocks 1155622 to 1155721
Stored blocks 1155722 to 1155821
Stored blocks 1155822 to 1155921
Stored blocks 1155922 to 1156021
Stored blocks 1156022 to 1156121
Stored blocks 1156122 to 1156221
Stored blocks 1156222 to 1156321
Stored blocks 1156322 to 1156421
Stored blocks 1156422 to 1156521
Stored blocks 1156522 to 1156621
Stored blocks 1156622 to 1156721
Stored blocks 1156722 to 1156821
Stored blocks 1156822 to 1156921
Stored blocks 1156922 to 1157021
Stored blocks 1157022 to 1157121
Stored blocks 1157122 to 1157221
Stored blocks 1157222 to 1157321
Stored blocks 1157322 to 1157421
Closed connection to the blocks database.
```
Information for all the nodes will be downloaded and parsed. The database for the current blockchain state takes 90 Mb of disk space. You can open the block storage database file with [SQLiteStudio](https://sqlitestudio.pl) to execute SQL queries and extract statistics.
## Calculating a payout
Unlike [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer) this toolset separates the process of updating the blocks information and calculating the payout. This adds more flexibility, you might update the block information at regular intervals and execute the payout calculation only when you want to distribute your pool's profits among your leasers.
```sh
node payout.js
```
This will generate a payout file which has the same format as the one generated by [WavesLPoSDistributer](https://github.com/jansenmarc/WavesLPoSDistributer). A couple of differences will exist though:
* it's almost certain that the payment items will not be ordered in the same way
* sometimes amounts differ by a very small amount due to rounding differences

So it's not possible to [diff](https://en.wikipedia.org/wiki/Diff) the files directly.  The output of a typical run will look this:
```
Connected to the blocks database.
Calculating payout...
Dumped 96 payments!
```
## Check the generated payments
The number of payments and the total amount that will be paid can be verified through the ```checkTransfer.js``` script. The payments will be aggregated per asset.
```sh
node checkTransfer.js
```
Always check your resulting payments and compare them to the node's expected earnings and current balance! You might need to tweak the "distributableMrtPerBlock" parameter and rerun the payout calculation for instance as the amount is not stable lately.  The output of a typical run will look this:
```
XX payments found!
XX payments of Waves will be processed, a total of XX.XXXXXXXX will be paid!
XX payments of MinersReward will be processed, a total of XXX.XX will be paid!
```
## Paying using the assets/transfer transaction
After verifying the payments you can trigger the payment. The ```assetsTransfer.js``` script uses the traditional assets/transfer transaction to trigger a separate transaction for each payment. You can use an asset that has been [sponsored](https://docs.wavesplatform.com/en/proposals/sponsored-transactions.html). Use the following command to process the payments stored in ```payout.json```.
```sh
node assetsTransfer.js
```
If there's any error it will be reported, otherwise you will be informed of the amount of payments that were processed.  The output of a typical run will look this:
```
XX transfers were found, feeAssedId was overriden with '5BK9HPKmSkxoMdqvDzneb2UaW2NzDRjoMpMvQWfB4NcK' and fee is: XXXX...
XX transfer transactions were submitted!
XX transfer transactions were accepted!
```
## Paying using the assets/massTransfer transaction
The [mass transfer transaction](https://medium.com/@wavesgo/the-new-mass-transfer-transaction-in-action-852b60d64d01) was introduced to maximize network throughput and minimize transaction costs. You can use ```assetsMassTransfer.js``` to aggregate the payments per asset and execute those payments in the minimum amount of transactions possible. Use the following command to process the payments stored in ```payout.json```.
```sh
node assetsMassTransfer.js
```
It is only worthwhile to use this payment form if you have a lot of payments in the same asset, if you are doing isolated payments it is better to use assets/transfer. The output of a typical run will look this:
```
XXX total transfers were found:
XXX transfers of Waves
XXX transfers of 4uK8i4ThRGbehENwa6MxyLtxAjAo1Rj9fduborGExarC
2 massTransfer transactions were submitted!
2 massTransfer transactions were accepted!
```
## Acknowledgements
I would like to thank [Mark Jansen](https://github.com/jansenmarc) for his outstanding work in the Waves community and for making available tools, examples and documentation for the [Waves platform](https://wavesplatform.com).
## Disclaimer
This software is provided "as is" and any express or implied warranties, including, but not limited to, the implied warranties of merchantability and fitness for a particular purpose are disclaimed. In no event shall the authors be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, procurement of substitute goods or services; loss of use, data, or profits; or business interruption) however caused and on any theory of liability, whether in contract, strict liability, or tort (including negligence or otherwise) arising in any way out of the use of this software, even if advised of the possibility of such damage.
