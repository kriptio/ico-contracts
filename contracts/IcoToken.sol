pragma solidity ^0.4.11;

import "zeppelin-solidity/contracts/token/StandardToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Token implementation with some function required for a successful ICO
 *
 * @dev Built on top of StandardToken and Ownable implementations from OpenZeppelin.
 * @dev Can lock transfers of tokens for everyone but owner and burn tokens from owner's account.
 */
contract IcoToken is StandardToken, Ownable {
    using SafeMath for uint256;

    // ERC22 compliance
    /// Token name
    string public name;
    /// Token symbol
    string public symbol;
    /// The number of digits after the decimal point
    uint8 public decimals;

    /// If set to `true` token is in the locked stage, and in the unlocked state otherwise
    bool public locked;

    event Locked();
    event Unlocked();
    event Burn(uint256 amount);

    /**
     * @dev Initialize a new token smart contract. The contract is initially locked and owned by the creator.
     *
     * @param _totalSupply The initial supply of tokens which will appear on the owner's address.
     * @param _name The name of the token.
     * @param _symbol The 3-letter symbol of the token.
     * @param _decimals The number of decimals to be displayed on a user's wallet.
     */
    function IcoToken(uint256 _totalSupply,
                      string _name,
                      string _symbol,
                      uint8 _decimals)
        Ownable()
    {
        totalSupply = _totalSupply;
        balances[msg.sender] = totalSupply;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        locked = true;
    }

    /** @dev If the contract is in locked state only owner can transfer tokens */
    modifier tokenUnlocked() {
        require(!locked || msg.sender == owner);
        _;
    }

    /** @dev Set the contract in the locked state */
    function lock() onlyOwner tokenUnlocked {
        locked = true;
        Locked();
    }

    /** @dev Set the contract in the unlocked state */
    function unlock() onlyOwner {
        require(locked);
        locked = false;
        Unlocked();
    }

    /** @dev Relies on StandardToken implementation and have the same interface */
    function transfer(address _to, uint256 _value) tokenUnlocked returns (bool) {
        return super.transfer(_to, _value);
    }

    /** @dev Relies on StandardToken implementation and have the same interface */
    function transferFrom(address _from, address _to, uint256 _value) tokenUnlocked returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    /**
     * @dev Burn tokens from owner's address
     * 
     * @param _amount The anount of tokens to be burnt
     */
    function burn(uint256 _amount) onlyOwner {
        totalSupply = totalSupply.sub(_amount);
        balances[msg.sender] = balances[msg.sender].sub(_amount);
        Burn(_amount);
    }
}