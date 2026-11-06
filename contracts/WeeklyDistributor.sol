// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// Minimal ERC-20 surface used here.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// Vibe Strikers weekly rewards (GAME.md 6.9). Robinhood Chain testnet only.
/// The owner funds this contract with STRIKE and, after each week, pays the players from a list made off-chain
/// from the game's weekly points. Each (week, player) is paid at most once, so a week can be paid in several
/// batches and a failed batch can simply be sent again. Players never call this contract.
contract WeeklyDistributor {
    IERC20 public immutable token;
    address public owner;

    /// week => player => paid amount (0 = not paid yet)
    mapping(uint256 => mapping(address => uint256)) public paidOf;
    /// week => total paid that week
    mapping(uint256 => uint256) public weekTotal;

    event Paid(uint256 indexed week, address indexed player, uint256 amount);
    event Skipped(uint256 indexed week, address indexed player);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error LengthMismatch();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 token_) {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);
    }

    /// Pay one batch of a week. Players already paid for this week (or with a zero amount / zero address) are
    /// skipped, not reverted. Reverts as a whole if the contract holds too few tokens.
    function distribute(uint256 week, address[] calldata players, uint256[] calldata amounts) external onlyOwner {
        if (players.length != amounts.length) revert LengthMismatch();
        uint256 total;
        for (uint256 i; i < players.length; ++i) {
            address p = players[i];
            uint256 a = amounts[i];
            if (p == address(0) || a == 0 || paidOf[week][p] != 0) {
                emit Skipped(week, p);
                continue;
            }
            paidOf[week][p] = a;
            total += a;
            _send(p, a);
            emit Paid(week, p, a);
        }
        weekTotal[week] += total;
    }

    /// Take tokens back (for example what the per-wallet cap left over).
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _send(to, amount);
        emit Withdrawn(to, amount);
    }

    function setOwner(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, next);
        owner = next;
    }

    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// transfer() that also accepts tokens returning nothing (non-standard ERC-20s).
    function _send(address to, uint256 amount) private {
        (bool ok, bytes memory ret) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
