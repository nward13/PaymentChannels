var Channels = artifacts.require("./Channels.sol");
var GasTesterChannels = artifacts.require("./GasTesterChannels.sol");

module.exports = function(deployer) {
    deployer.deploy(Channels);
    deployer.deploy(GasTesterChannels);
};