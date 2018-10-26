var Channels = artifacts.require("./Channels.sol");

module.exports = function(deployer) {
    deployer.deploy(Channels);
};