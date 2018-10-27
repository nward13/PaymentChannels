pragma solidity ^0.4.24;

import "./openZeppelin/Ownable.sol";
import "./openZeppelin/Pausable.sol";
import "./openZeppelin/SafeMath.sol";


/**
 * @title Channels
 * @author Nick Ward
 * @dev Uni-directional payment channels contract
 */
contract Channels is Ownable, Pausable {

    // TODO: Explain Ownable and Paudable contracts, and how their
    // inheritance effects this contract

    // Libraries -- SafeMath used to perform math operations with integer
    // overflow checks
    using SafeMath256 for uint;
    using SafeMath72 for uint72;

    // ===============
    // State Variables:
    // ===============

    // Limit max deposit to 25 ETH
    uint public maxDeposit = 10 ** 18 * 25;

    // TODO: explain issue with opening 2 channels w/ same sender and recipient in same block
    // (the second one will revert)

    


    // TODO:
    // Current blocks/day hovers around 6k
    // 6588202 blocks mined as of 10/26/18
    // 4294967295 is max value for uint32
    // 6588202 + 6000(num_days) = 4294967295
    // num_days = (4294967295 - 6588202) / 6000
    // num_days = 714730 = 1958 years
    // uint32 will overflow in the year 3976

    // This struct stores the data for each payment channel. uint32 and uint72
    // are used to take advantage of struct packing, lowering gas costs of
    // payment channels
    struct Channel {
        address sender;
        address recipient;
        // The block number in which the channel was opened. At current 
        // mining rate of ~6000 blocks/day, uint32 will overflow in the 
        // year 3976
        uint32 openBlock;   
        // Sender deposit. Using uint72 limits max possible deposit to ~4722 ETH
        uint72 deposit; 
    }

    // channel key => Channel
    // channel key is keccak256(sender, recipient, openBlock). This is
    // used to prevent various types of signature replay attacks
    mapping (bytes32 => Channel) public channels;


    // ===============
    // Events:
    // ===============

    event ChannelCreated(
        address indexed _sender,
        address indexed _recipient,
        uint72 deposit
    );
    event ChannelDepositIncreased(
        address indexed _sender,
        address indexed _recipient,
        uint32 indexed _openBlock,
        uint72 _newDeposit
    );
    event ChannelClosed(
        address indexed _sender,
        address indexed _recipient,
        uint32 indexed _openBlock,
        uint72 _payout
    );
    event MaxDepositChanged(
        uint _newMaxDeposit
    );


    // ===============
    // State Transition Functions:
    // ===============

    /**
    * @dev Opens a payment channel between msg.sender and _recipient. 
    * msg.value becomes the channel deposit. Deposit must be > 0, but can
    * be increased at a later time using increaseDeposit()
    * @param _recipient The address of the channel recipient 
    */
    function openChannel(address _recipient) external whenNotPaused payable {

        // Revert if no deposit is staked. NOTE: It's not currently possible
        // to access revert strings in web3 or the latest stable version 
        // of truffle, but they are included throughout the contract for 
        // future uses
        require(msg.value > 0, "Deposit must be greater than zero.");
        // Revert if deposit is greater than the max deposit
        require(msg.value <= maxDeposit, "Deposit cannot be greater than maxDeposit.");
        // Revert if recipient is 0 address
        require(_recipient != address(0), "Recipient cannot be 0x address.");
        // Revert if recipient is also sender
        require(_recipient != msg.sender, "Recipient cannot be sender.");
        
        // Store deposit as uint72
        uint72 _deposit = uint72(msg.value);

        // Revert if deposit amount overflowed (statement should always be 
        // true if maxDeposit is set correctly, so use assert() for check)
        assert(uint(_deposit) == msg.value);

        // set openBlock to current block number
        uint32 openBlock = uint32(block.number);

        // Create channel key. Key is keccak256(sender, recipient, openBlock)
        bytes32 key = getKey(msg.sender, _recipient, openBlock);

        // Revert if channel already exists
        require(channels[key].deposit == 0, "Cannot overwrite an existing channel");

        // Initialize the channel
        Channel memory _channel;
        _channel.sender = msg.sender;
        _channel.recipient = _recipient;
        _channel.openBlock = openBlock;
        _channel.deposit = _deposit;
        
        // Add to channels mapping
        channels[key] = _channel;

        emit ChannelCreated(msg.sender, _recipient, _deposit);
    }


    function increaseDeposit(address _recipient, uint32 _openBlock) 
        external 
        whenNotPaused
        payable 
    {
        // Revert if deposit increase amount is zero
        require(msg.value > 0, "Must provide payment to increase deposit.");

        // Revert if deposit increase amount overflows deposit data type
        uint72 depositIncrease = uint72(msg.value);
        require(uint(depositIncrease) == msg.value, "Message value must fit in uint72 data type.");

        // Get channel key. Key is keccak256(sender, recipient, openBlock)
        bytes32 key = getKey(msg.sender, _recipient, _openBlock);
        
        // Get current channel deposit
        uint72 _deposit = channels[key].deposit;

        // Revert if channel has not been opened
        require(_deposit > 0, "Cannot increase deposit on a channel that has not been created.");
        
        // The following check is made by the use of the key, based on the assumption
        // that keccak256 is a sufficiently collision resistant hash function.
        // The explicit require() statement is excluded as a gas optimization.
        // Only the channel sender can increase the deposit. 
        // require(msg.sender == channels[key].sender);
        
        // Increase the deposit
        uint72 newDeposit = _deposit.add(depositIncrease);

        // Revert if maxDeposit is exceeded
        require(newDeposit <= maxDeposit, "Total deposit cannot excede maxDeposit.");

        channels[key].deposit = newDeposit;

        emit ChannelDepositIncreased(msg.sender, _recipient, _openBlock, newDeposit);
    }


    function closeChannel(address _sender, uint32 _openBlock, uint72 _amt, bytes _sig) external whenNotPaused {
        // Note that this function can only be called by the recipient of the channel

        // The following check is made by the use of the key, based on the assumption
        // that keccak256 is a sufficiently collision resistant hash function.
        // The explicit require() statement is excluded as a gas optimization.
        // Only the channel recipient can close the channel
        // require(msg.sender == channels[key].recipient);

        bytes32 key = getKey(_sender, msg.sender, _openBlock); 

        uint _deposit = channels[key].deposit;

        // Revert if requested transfer amount exceeds the channel deposit
        require(_deposit >= _amt, "_amt exceeds channel deposit.");

        // Signature must be valid
        require(validSig(key, _amt, _sig), "Invalid signature.");

        // put in remaining checks

        // Delete the channel before making transfers to protect against
        // reentrancy. If transfer() fails, entire transaction will revert
        // and the channel information will not be deleted
        delete channels[key];

        msg.sender.transfer(_amt);

        if (_deposit > _amt) {
            uint senderRefund = uint((_deposit).sub(_amt));
            _sender.transfer(senderRefund);
        }
        
        emit ChannelClosed(_sender, msg.sender, _openBlock, _amt);
    }


    

    // ===============
    // Constant Functions:
    // ===============


    // TODO: Clearly document what the expected message to sign is
    // Note that it is not currently possible to sign type-structured data,
    // which makes for a very dangerous UI because MetaMask requires you to
    // sign a hash and most user's wont verify that hash. EIP-712 aims to fix this

    // Same as closeChannel(), but no state changes
    // public bc called by closeChannel(), but doubles as a check for users
    // to confirm the validity of a recieved signature or calibrate their
    // off-chain signature verification function

    function validSig(bytes32 _key, uint72 _amt, bytes _sig) internal view returns (bool) {
        
        // Note: verifySignature can be called by anyone to check if a message is valid,
        // although in most circumstances you would want to build your own method
        // of checking off-chain, or else defeat the purpose of the payment channel
    
        // require(channels[_key].deposit >= _amt);

        bytes32 message = prefix(keccak256(abi.encodePacked(_key, _amt)));

        if (recover(message, _sig) == channels[_key].sender) {
            return true;
        } else {
            return false;
        }
    } 

    function verifySignature(address _sender, address _recipient, uint32 _openBlock, uint72 _amt, bytes _sig) public view returns (bool) {
        
        // Note: verifySignature can be called by anyone to check if a message is valid,
        // although in most circumstances you would want to build your own method
        // of checking off-chain, or else defeat the purpose of the payment channel
    
        // require(channels[_key].deposit >= _amt);

        bytes32 key = getKey(_sender, _recipient, _openBlock); 

        // uint _deposit = channels[key].deposit;

        // Revert if requested transfer amount exceeds the channel deposit
        // require(_deposit >= _amt, "_amt exceeds channel deposit.");

        bytes32 message = prefix(keccak256(abi.encodePacked(key, _amt)));

        if (recover(message, _sig) == channels[key].sender && channels[key].deposit >= _amt) {
            return true;
        } else {
            return false;
        }
    } 


    /**
    * @dev Prefixes a given message hash with the header required by the
    * ecrecover() function
    * @param _hash The message that was signed
    * @return The hash of the 'header' and the original message (this is
    * the value expected by ecrecover())
    */
    // TODO: explain reasoning behind prefixing message
    function prefix(bytes32 _hash) internal pure returns (bytes32) {
        bytes memory header = "\x19Ethereum Signed Message:\n32";
        return keccak256(abi.encodePacked(header, _hash));
    }

    /**
    * @dev Returns the public key of the signer given a message hash and an 
    * elliptic curve signature (the entire signature)
    * @param _hash The message that was signed. **NOTE: message hash must 
    * be 'prefixed' with the string "\x19Ethereum Signed Message:\n32"
    * (see prefix() function)
    * @param _sig The signature 
    * @return The address of the signer
    */
    function recover(bytes32 _hash, bytes _sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        require(_sig.length == 65, "Invalid signature length.");

        // 544 gas extra to split sig on-chain vs. accepting v, s, and r as
        // function parameters. ~$0.00037 at current gas prices.
        // Significantly simpler API for users justifies extra gas costs
        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }

        // ecrecover expects version to be 27 or 28, but could also be 0 or 1
        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature version.");

        return ecrecover(_hash, v, r, s);
    }




    /**
    * @dev Returns the unique channel key used in the channels mapping
    * @param _sender Address that is sending the channel payout
    * @param _recipient Address that is receiving the channel payout
    * @param _openBlock The block number at which the channel was created
    * @return The unique channel key
    */
    function getKey(address _sender, address _recipient, uint32 _openBlock) 
        public 
        pure 
        returns (bytes32) 
    {
        // Note that openBlock is hashed as a uint32
        return keccak256(abi.encodePacked(_sender, _recipient, _openBlock));
    }



    // can already call channels(key) to get entire channel struct
    function getChannelDeposit(
        address _sender, 
        address _recipient, 
        uint32 _openBlock
    ) public view returns(uint72) {

        bytes32 key = getKey(_sender, _recipient, _openBlock);

        return channels[key].deposit;
    }
 



    // ===============
    // Owner Functions:
    // ===============

    /**
    * @dev Allows the contract owner to change the maximum deposit amount
    * @param _newMaxDeposit New max deposit amount. Must be > 0 and < the 
    * max value for the uint type used to store the deposit amount
    * in the Channel struct
    */
    function changeMaxDeposit(uint _newMaxDeposit) public onlyOwner {
        require(_newMaxDeposit > 0, "Cannot set max deposit to zero.");

        // Max deposit must remain <= the max storage value for uint72 
        // to prevent integer overflow in Channel struct
        require(_newMaxDeposit <= uint(uint72(-1)), "Max deposit must be less than the max storage value for the deposit data type.");

        // Change the max deposit
        maxDeposit = _newMaxDeposit;

        emit MaxDepositChanged(_newMaxDeposit);
    }


}