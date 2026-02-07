// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PredictionCustody {
    address public oracle;
    
    mapping(bytes32 => mapping(address => BetRecord)) public bets;
    mapping(bytes32 => bool) public marketIsSettled;
    mapping(bytes32 => bool) public marketOutcomeYes;
    mapping(address => uint256) public balances;
    
    struct BetRecord {
        bool side;
        uint256 amount;
        bool claimed;
    }
    
    event Deposited(address indexed user, uint256 amount);
    event BetPlaced(bytes32 indexed marketId, address indexed user, bool side, uint256 amount);
    event MarketSettled(bytes32 indexed marketId, bool resolvedYes);
    event Claimed(bytes32 indexed marketId, address indexed user, uint256 payout);
    event Withdrawn(address indexed user, uint256 amount);
    
    constructor(address _oracle) {
        oracle = _oracle;
    }
    
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
    
    function placeBet(bytes32 marketId, bool side, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(!marketIsSettled[marketId], "Market closed");
        
        balances[msg.sender] -= amount;
        bets[marketId][msg.sender] = BetRecord(side, amount, false);
        emit BetPlaced(marketId, msg.sender, side, amount);
    }
    
    function settleMarket(bytes32 marketId, bool resolvedYes) external {
        require(msg.sender == oracle, "Only oracle");
        require(!marketIsSettled[marketId], "Already settled");
        
        marketIsSettled[marketId] = true;
        marketOutcomeYes[marketId] = resolvedYes;
        emit MarketSettled(marketId, resolvedYes);
    }
    
    function claim(bytes32 marketId) external {
        require(marketIsSettled[marketId], "Not settled");
        
        BetRecord storage bet = bets[marketId][msg.sender];
        require(!bet.claimed, "Already claimed");
        
        bool resolvedYes = marketOutcomeYes[marketId];
        uint256 payout = bet.side == resolvedYes ? bet.amount * 2 : 0;
        
        bet.claimed = true;
        if (payout > 0) {
            balances[msg.sender] += payout;
        }
        emit Claimed(marketId, msg.sender, payout);
    }
    
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }
    
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
    
    function getBet(bytes32 marketId, address user) external view returns (BetRecord memory) {
        return bets[marketId][user];
    }
}
