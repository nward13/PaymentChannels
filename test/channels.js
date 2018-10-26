const ChannelsContract = artifacts.require('../contracts/Channels');
const assert = require('assert');
const web3Utils = require('web3-utils');
const BN = require('bignumber.js');
const { advanceToBlock } = require('./helpers/advanceToBlock');

contract("Channels", function(accounts) {
    let Channels;
    const owner = accounts[0];
    const sender = accounts[1];
    const recipient = accounts[2];
    const deposit = 5000000000000000000;  // 5 Eth
    const transferAmt = deposit * 0.5;

    beforeEach("Instantiate Payment Channels Contract", async() => {
        Channels = await ChannelsContract.new({from:owner});
    });

    // it("Check owner and pausable functions", async() => {

    // });

    // it("Gas costs", async() => {
    //     // Create payment channel
    //     const openReceipt = await Channels.openChannel(recipient, {from:sender, value:deposit});

    //     // Get key
    //     const openBlock = openReceipt.receipt.blockNumber;
    //     const key = web3Utils.soliditySha3(
    //         {type: 'address', value: sender},
    //         {type: 'address', value:recipient},
    //         {type: 'uint32', value: new BN(openBlock)}
    //     );

    //     // Get channel
    //     const channel = await Channels.channels(key);

    //     // Assert that channel info is correct
    //     assert.equal(channel[0], sender);
    //     assert.equal(channel[1], recipient);
    //     assert.equal(channel[2].toString(), openBlock.toString());
    //     assert.equal(channel[3].toString(), deposit.toString());

    //     // Verify Signature
    //     // const sigVerification = await Channels.verifySignature(key, transferAmt, sig);
    //     // console.log("sigVerification: ", sigVerification);

    //     // {t: 'uint', v: new BN('234')}
    //     // {type: 'uint32', value: new BN(deposit)}
    //     // const onChainKey = await Channels.getKey(sender, recipient, openBlock);
    //     // console.log("onChainKey: ", onChainKey);
    //     // console.log("Key: ", key);

    //     // channel = await Channels.channels();
    // });

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

        // TODO: Remove
        // Increase deposit
        const increaseDepositReceipt = await Channels.increaseDeposit(recipient, openBlock, {from:sender, value:deposit});

        // TODO: Remove
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

        // TODO: Remove
        // Log the gas used by verifySig
        console.log("Gas used to verify signature (entire signature): ", 35924);
        console.log("^ value above was hardcoded from previous tests. Contract function was switched back to view.");
        
        
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
        





        // Close channel
        // Get gas for channel close
        // Add up total gas cost
        // Log total cost and BEP
    });
});