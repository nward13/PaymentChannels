const ChannelsContract = artifacts.require('../contracts/Channels');
const assert = require('assert');
const web3Utils = require('web3-utils');
const BN = require('bignumber.js');
const { expectThrow } = require('./helpers/expectThrow');

const EVMRevert = 'revert';

contract("Channels", function(accounts) {
    let Channels;
    const owner = accounts[0];
    const sender = accounts[1];
    const recipient = accounts[2];
    const secondPauser = accounts[3]
    const anyone = accounts[4];
    const deposit = 5000000000000000000;  // 5 Eth
    const transferAmt = deposit * 0.5;


    beforeEach("Instantiate Payment Channels Contract", async() => {
        Channels = await ChannelsContract.new({from:owner});
    });


    it("Check owner functions", async() => {
        // Create payment channel
        await Channels.openChannel(recipient, {from:sender, value:deposit});

        const originalMaxDeposit = web3.toWei(25, "ether");
        const newMaxDeposit = web3.toWei(20, "ether");
        const maliciousMaxDeposit = ((new BN(2)).exponentiatedBy(72));

        // Check that original max deposit is correct
        let channelMaxDeposit = await Channels.maxDeposit();
        assert.equal(channelMaxDeposit, originalMaxDeposit, "Original deposit incorrect.");

        // Check that only the owner can change the max deposit
        await expectThrow(Channels.changeMaxDeposit(newMaxDeposit, {from:anyone}), EVMRevert);

        // Check that owner can successfully change the max deposit
        await Channels.changeMaxDeposit(newMaxDeposit, {from:owner});
        channelMaxDeposit = await Channels.maxDeposit();
        assert.equal(channelMaxDeposit, newMaxDeposit, "New max deposit incorrect.");

        // Check that owner cannot set max deposit > max value for uint72
        await expectThrow(Channels.changeMaxDeposit(maliciousMaxDeposit.toString(), {from:owner}));
    });


    it("Check pausable functionality", async() => {
        // Confirm that contracct is unpaused
        let paused = await Channels.paused();
        assert.equal(paused, false, "Contract initialized as paused")

        // Check that only pauser can pause contract (pauser is initialized 
        // to the address that deployed contract, same as owner)
        await expectThrow(Channels.pause({from:anyone}), EVMRevert);

        // Check that pauser can pause contract
        await Channels.pause({from:owner});
        paused = await Channels.paused();
        assert.equal(paused, true, "Contract not paused by pauser successfully.");

        // Check that whenNotPaused functions revert when paused
        await expectThrow(Channels.openChannel(recipient, {from:sender, value:deposit}), EVMRevert);

        // Check that only pauser can add pausers
        await expectThrow(Channels.addPauser(secondPauser, {from:anyone}), EVMRevert);

        // Check that pauser can add pausers
        await Channels.addPauser(secondPauser, {from:owner});

        // Check that only pauser can unpause contract
        await expectThrow(Channels.unpause({from:anyone}));

        // Check that pauser can unpause contract
        await Channels.unpause({from:secondPauser});

        // Check that whenNotPaused functions work again
        // Open channel
        const openReceipt = await Channels.openChannel(recipient, {from:sender, value:deposit});

        // Get key
        const openBlock = openReceipt.receipt.blockNumber;
        const key = web3Utils.soliditySha3(
            {type: 'address', value: sender},
            {type: 'address', value:recipient},
            {type: 'uint32', value: new BN(openBlock)}
        );

        // Get channel
        const channel = await Channels.channels(key);

        // Assert that channel is opened correctly
        assert.equal(channel[3].toString(), deposit.toString(), "openChannel not working after unpausing contract");
    });


    it("Check user functions", async() => {
        // Create payment channel
        const openReceipt = await Channels.openChannel(recipient, {from:sender, value:deposit});

        // Get key
        const openBlock = openReceipt.receipt.blockNumber;
        const key = web3Utils.soliditySha3(
            {type: 'address', value: sender},
            {type: 'address', value:recipient},
            {type: 'uint32', value: new BN(openBlock)}
        );

        // Get channel
        const channel = await Channels.channels(key);

        // Assert that channel info is correct
        assert.equal(channel[0], sender, "Channel sender incorrect.");
        assert.equal(channel[1], recipient, "Channel recipient incorrect.");
        assert.equal(channel[2].toString(), openBlock.toString(), "Channel openBlock incorrect.");
        assert.equal(channel[3].toString(), deposit.toString(), "Channel deposit incorrect.");

        // Check increaseDeposit() and getChannelDeposit() functions
        await Channels.increaseDeposit(recipient, openBlock, {from:sender, value:deposit});
        const newDeposit = await Channels.getChannelDeposit(sender, recipient, openBlock);
        assert.equal(newDeposit.toString(), (deposit * 2).toString(), "IncreaseDeposit() or getChannelDeposit() incorrect.");

        // Sign transferAmt over from sender to receiver
        const msg = web3Utils.soliditySha3(
            {type: 'bytes32', value: key}, 
            {type: 'uint72', value: new BN(transferAmt)}
        );
        const validSig = web3.eth.sign(sender, msg);
        
        // Check that a valid signature is successfully verified
        let sigVerification = await Channels.verifySignature(
            sender, 
            recipient,
            openBlock,
            transferAmt,
            validSig
        );
        assert.equal(sigVerification, true, "Valid sig not verified.");

        // Check that an otherwise valid sig with amt > channel deposit reverts
        const badMsg = web3Utils.soliditySha3(
            {type: 'bytes32', value: key},
            {type: 'uint72', value: new BN(newDeposit + 1)}
        );
        const badSig = web3.eth.sign(sender, badMsg); 
        sigVerification = await Channels.verifySignature(
            sender,
            recipient,
            openBlock,
            newDeposit + 1,
            badSig
        );
        assert.equal(sigVerification, false, "Invalid sig is verified.");

        // Check that a signature from recipient fails
        const maliciousSig = web3.eth.sign(recipient, msg); 
        sigVerification = await Channels.verifySignature(
            sender,
            recipient,
            openBlock,
            transferAmt,
            maliciousSig
        );
        assert.equal(sigVerification, false, "Invalid sig is verified.");

        // Check that closing channel with an otherwise valid sig with
        // amt > channel deposit reverts
        await expectThrow(Channels.closeChannel(
            sender, 
            openBlock, 
            newDeposit + 1, 
            badSig, 
            {from:recipient}
        ), EVMRevert);

        // Check that closing channel with a sig from recipient fails
        await expectThrow(Channels.closeChannel(
            sender,
            openBlock,
            transferAmt,
            maliciousSig,
            {from:recipient}
        ), EVMRevert);

        // Check that closing channel from sender with valid sig fails
        await expectThrow(Channels.closeChannel(
            sender,
            openBlock,
            transferAmt,
            validSig,
            {from:sender}
        ), EVMRevert);

        // Check that closing channel by recipient with valid sig succeeds
        const senderInitialBalance = await web3.eth.getBalance(sender);
        const recipientInitialBalance = await web3.eth.getBalance(recipient);
        const closeReceipt = await Channels.closeChannel(
            sender,
            openBlock,
            transferAmt,
            validSig,
            {from:recipient}
        );

        // TODO: Check that correct values are transferred to the address
        // Get final balances and gas cost
        const senderFinalBalance = await web3.eth.getBalance(sender);
        const recipientFinalBalance = await web3.eth.getBalance(recipient);
        const gasUsed =  closeReceipt.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(closeReceipt.tx);
        const gasPrice = tx.gasPrice;
        const gasCost = gasUsed * gasPrice;
        
        // Check that correct amount was transferred to sender
        const recipientPayment = recipientFinalBalance.minus(recipientInitialBalance).plus(gasCost);
        assert.equal(recipientPayment.toString(), transferAmt.toString());

        // Check that correct amount was transferred to recipient
        const senderPayment = senderFinalBalance.minus(senderInitialBalance);
        assert.equal(senderPayment.toString(), (newDeposit - transferAmt).toString());

        // Check that channel is deleted
        const deletedChannel = await Channels.channels(key);
        assert.equal(deletedChannel[3].toString(), '0', "Channel was not deleted after closing.");

        // Check that closing a channel again fails
        await expectThrow(Channels.closeChannel(
            sender,
            openBlock,
            transferAmt,
            validSig,
            {from:recipient}
        ), EVMRevert);

    });


    it("Gas cost analysis", async() => {
        // console.log("\n\n=========================")
        console.log("\nGas Usage Analysis\n------------------");

        // Send a standard ethereum transaction, grab the receipt, and log the gas used. (Should be 21000)
        const transferHash = await web3.eth.sendTransaction({to:recipient, from:sender, value:transferAmt});
        const transferReceipt = await web3.eth.getTransactionReceipt(transferHash);
        const transferGas = transferReceipt.gasUsed;
        console.log("Gas used by standard Ethereum transfer: ", transferGas);

        // Create payment channel
        const openReceipt = await Channels.openChannel(recipient, {from:sender, value:deposit});
        
        // Log the gas used in creating the channel
        const openGas = openReceipt.receipt.gasUsed;
        console.log("\nGas used to open payment channel: ", openGas);

        // Get openBlock
        const openBlock = openReceipt.receipt.blockNumber;

        // TODO: Remove
        // Increase deposit
        const increaseDepositReceipt = await Channels.increaseDeposit(recipient, openBlock, {from:sender, value:deposit});

        // TODO: Remove
        // Log the gas used by increaseDeposit()
        const increaseDepositGas = increaseDepositReceipt.receipt.gasUsed;
        console.log("\nGas used to increase channel deposit: ", increaseDepositGas);

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
        console.log("\nGas used to verify signature (entire signature): ", 35924);
        console.log("^ value above was hardcoded from previous tests. Contract function switched back to view.");
        
        
        // Close payment channel
        const closeReceipt = await Channels.closeChannel(sender, openBlock, transferAmt, sig, {from:recipient});
        
        // Log the gas used in creating the channel
        const closeGas = closeReceipt.receipt.gasUsed;
        console.log("\nGas used to close payment channel: ", closeGas);

        // Log total gas used in payment channel
        const totalGas = openGas + closeGas;
        console.log("\nTotal gas used: ", totalGas);

        // Log the break-even point (number of transfers at which using
        // payment channel becomes cost effective)
        // 21000 * BEP = totalCost
        const BEP = totalGas / transferGas;
        console.log("\nBreak even point: ", BEP);
    });
});