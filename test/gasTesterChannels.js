const GasTesterChannelsContract = artifacts.require('../contracts/GasTesterChannels');
const assert = require('assert');
const web3Utils = require('web3-utils');
const BN = require('bignumber.js');

///////////////
// Tests of temporary contract to evaluate the benefits of some gas optimizations
///////////////

contract("Gas Tester Channels", function(accounts) {
    let Channels;
    const owner = accounts[0];
    const sender = accounts[1];
    const recipient = accounts[2];
    const deposit = 5000000000000000000;  // 5 Eth
    const transferAmt = deposit * 0.5;

    beforeEach("Instantiate Payment Channels Contract", async() => {
        Channels = await GasTesterChannelsContract.new({from:owner});
    });

    it("Gas cost analysis", async() => {
        console.log("\n\n=========================")
        console.log("\n\nGas Usage Analysis:\n");

        // Send a standard ethereum transaction, grab the receipt, and log the gas used. (Should be 21000)
        const transferHash = await web3.eth.sendTransaction({to:recipient, from:sender, value:transferAmt});
        const transferReceipt = await web3.eth.getTransactionReceipt(transferHash);
        const transferGas = transferReceipt.gasUsed;
        console.log("Gas used by standard Ethereum transfer: ", transferGas);

        // Create payment channel
        const openReceipt = await Channels.openChannel(recipient, {from:sender, value:deposit});
        
        // Log the gas used in creating the channel
        const openGas = openReceipt.receipt.gasUsed;
        console.log("Gas used to open payment channel: ", openGas);

        // Get openBlock
        const openBlock = openReceipt.receipt.blockNumber;

        // Increase deposit
        const increaseDepositReceipt = await Channels.increaseDeposit(recipient, openBlock, {from:sender, value:deposit});

        // Log the gas used by increaseDeposit()
        const increaseDepositGas = increaseDepositReceipt.receipt.gasUsed;
        console.log("Gas used to increase channel deposit: ", increaseDepositGas);

        // Get key
        const key = web3Utils.soliditySha3(
            {type: 'address', value: sender},
            {type: 'address', value:recipient},
            {type: 'uint32', value: new BN(openBlock)}
        );


        // Sign transferAmt over from sender to receiver
        const msg = web3Utils.soliditySha3(
            {type: 'bytes32', value: key}, 
            {type: 'uint72', value: new BN(transferAmt)}
        );
        const sig = web3.eth.sign(sender, msg);

        // remove 0x
        const signature1 = sig.substr(2); 
        const r = "0x" + signature1.slice(0, 64);
        const s = "0x" + signature1.slice(64, 128);
        let v = "0x" + signature1.slice(128, 130); 
        v = web3.toDecimal(v);
        v = v + 27;

        // Log the gas used by verifySig
        const verifyReceipt = await Channels.verifySignature(key, transferAmt, r, s, v);
        const verifyGas = verifyReceipt.receipt.gasUsed;
        console.log("Gas used to verify signature (split signature): ", verifyGas);
      
         // Close payment channel
         const closeReceipt = await Channels.closeChannel(sender, openBlock, transferAmt, sig, {from:recipient});
        
         // Log the gas used in creating the channel
         const closeGas = closeReceipt.receipt.gasUsed;
         console.log("Gas used to close payment channel: ", closeGas);
 
         // Log total gas used in payment channel
         const totalGas = openGas + closeGas;
         console.log("Total gas used: ", totalGas);

        // Log the break-even point (number of transfers at which using
        // payment channel becomes cost effective)
        // 21000 * BEP = totalCost
        const BEP = totalGas / transferGas;
        console.log("Break even point: ", BEP);
        
    });
});