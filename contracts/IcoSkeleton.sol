pragma solidity ^0.4.11;

import "./IcoToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/** @title Basic customizable ICO implementation */
contract IcoSkeleton is Ownable {
    using SafeMath for uint256;

    event BenefeciaryChange(address indexed newBenefeciary);
    event Start();
    event Purchase(address indexed purchasedBy, uint256 amount);
    event Fail();
    event Success();
    event Withdrawal();
    event Refund(address indexed by, uint256 amount);
    event Abort();

    /// The token contract used for this ICO
    IcoToken public token;
    /// The address of emergency account. This account should be kept safe and used to stop ICO if the owner's account is compromised
    address public emergencyAccount;
    /// Wei per token
    uint256 public tokenBasePrice;
    /// Maximal amount of tokens to be sold
    uint256 public tokensForSale;
    /// Minimal ICO cap
    uint256 public minCap;
    /// The start time of ICO
    uint public startsAt;
    /// The end time of ICO
    uint public endsAt;
    /// The account to which money will be transferred after the successful ICO
    address public benefeciary;

    /// The amount of tokens sold
    uint256 public sold;
    /// The amount of Ether paid from each address
    mapping (address => uint256) public paidBy;
    /// The amount of Ether raised at the current moment
    uint256 public currentCap;

    enum Status { New, Started, Finished, Refund, Aborted }
    /// The state of the ICO process
    Status public status;

    /**
     * @dev Initialize the ICO contract
     *
     * @param _token The address of the token contract used for this ICO
     * @param _emergencyAccount The address of emergency account
     * @param _tokenBasePrice The amount of wei per token
     * @param _tokensForSale The amount of tokens to be sold
     * @param _minCap Minimal ICO cap
     * @param _startsAt The start time of ICO
     * @param _endsAt The end time of ICO
     */
    function IcoSkeleton(address _token,
                         address _emergencyAccount,
                         uint256 _tokenBasePrice,
                         uint256 _tokensForSale,
                         uint256 _minCap,
                         uint _startsAt,
                         uint _endsAt)
        Ownable()
    {
        token = IcoToken(_token);
        emergencyAccount = _emergencyAccount;
        tokenBasePrice = _tokenBasePrice;
        tokensForSale = _tokensForSale;
        minCap = _minCap;
        startsAt = _startsAt;
        endsAt = _endsAt;
        status = Status.New;
        benefeciary = msg.sender;
    }

    /**
     * @dev Change the benefeciary account address
     *
     * @param _benefeciary New benefeciary address
     */
    function setBenefeciary(address _benefeciary) onlyOwner {
        benefeciary = _benefeciary;
        BenefeciaryChange(_benefeciary);
    }

    /** @dev Start the ICO */
    function start() onlyOwner {
        require(now >= startsAt && now <= endsAt);
        require(status == Status.New);
        require(token.balanceOf(this) == token.totalSupply());
        if (!token.locked()) {
            token.lock();
        }
        require(token.locked());
        status = Status.Started;
        Start();
    }

    /**
     * @dev Get an amount of bonus tokens for this transaction
     *
     * @param _amount The initial amount of tokens
     */
    function getBonus(uint256 _amount) internal constant returns (uint256) {
        return 0;
    }

    /** @dev Called before the tokens are transferred */
    function hookPreBuy() internal { }
    
    /** @dev Called after the tokens are transferred */
    function hookPostBuy() internal { }

    /**
     * @dev Transfer tokens to a specified address for a given amount of ether.
     * @dev Returns the amount of tokens and the amount of ether that was actually sent
     *
     * @param _forAddress The address to transfer tokens to
     * @param _etherAmount The amount of ether (in wei) for the internal calculations
     */
    function buy(address _forAddress, uint256 _etherAmount) internal returns (uint256, uint256) {
        require(status == Status.Started);
        require(now >= startsAt && now <= endsAt);
        hookPreBuy();
        uint256 amount = _etherAmount.div(tokenBasePrice);
        uint256 amountToSend = amount.add(getBonus(amount));
        sold = sold.add(amountToSend);
        require(sold <= tokensForSale);
        uint256 capIncrease = amount.mul(tokenBasePrice);
        currentCap = currentCap.add(capIncrease);
        require(token.transfer(_forAddress, amountToSend));
        hookPostBuy();
        return (amountToSend, capIncrease);
    }

    /** @dev Buy tokens for the amount of ether sent to this contract */
    function () payable {
        uint256 tokensBought;
        uint256 etherSpent;
        (tokensBought, etherSpent) = buy(msg.sender, msg.value);
        paidBy[msg.sender] = paidBy[msg.sender].add(etherSpent);
        Purchase(msg.sender, tokensBought);
        msg.sender.transfer(msg.value.sub(etherSpent));
    }

    /** @dev Custom finalization logic (on success) */
    function hookFinish() internal {
        token.burn(token.balanceOf(this));
        token.unlock();
    }

    /** @dev ICO finalization */
    function finish() onlyOwner {
        require(status == Status.Started);
        require(now > endsAt);
        if (currentCap < minCap) {
            status = Status.Refund;
            Fail();
        } else {
            status = Status.Finished;
            hookFinish();
            Success();
        }
    }

    /** @dev Abort the ICO in case of any emergency and return all the money */
    function abort() {
        require(msg.sender == emergencyAccount);
        Abort();
        status = Status.Aborted;
    }

    /** @dev The function for the benefeciary to withdraw money (in case of success) */
    function withdraw() {
        require(status == Status.Finished);
        require(msg.sender == benefeciary);
        Withdrawal();
        benefeciary.transfer(currentCap);
    }

    /** @dev The function for investors to return their money in case of failure */
    function refund() {
        require(status == Status.Refund || status == Status.Aborted);
        uint256 refundAmount = paidBy[msg.sender];
        require(refundAmount > 0);
        paidBy[msg.sender] = 0;
        Refund(msg.sender, refundAmount);
        msg.sender.transfer(refundAmount);
    }
}