// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// Vibe Strikers season skins (GAME.md 6.11). Robinhood Chain testnet only.
/// Standard ERC-721. The owner mints from a list made by the game server when a player asks for an NFT to be sent to
/// their wallet. Token ids come from the server and are stable, so a batch can be sent again: tokens that exist are
/// skipped. Players never call this contract to receive a token and never pay for one.
contract SeasonSkins is ERC721 {
    address public owner;
    uint256 public totalSupply;
    /// tokenId => season, level, rarity, weapon and seed in one word (layout: nftSkinWord in src/gameplay/nft.ts).
    mapping(uint256 => uint256) public skinOf;
    string private baseUri;

    event Skipped(uint256 indexed tokenId, address indexed to);
    event BaseUriChanged(string uri);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error LengthMismatch();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() ERC721("Vibe Strikers Skins", "VSKIN") {
        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);
    }

    /// Mint one batch. Existing tokens and zero addresses are skipped, not reverted. _mint makes no call to the
    /// receiver, so no receiver can block a batch or run code during it.
    function mintBatch(address[] calldata to, uint256[] calldata tokenIds, uint256[] calldata skins) external onlyOwner {
        if (to.length != tokenIds.length || to.length != skins.length) revert LengthMismatch();
        for (uint256 i; i < to.length; ++i) {
            if (to[i] == address(0) || _ownerOf(tokenIds[i]) != address(0)) {
                emit Skipped(tokenIds[i], to[i]);
                continue;
            }
            _mint(to[i], tokenIds[i]);
            skinOf[tokenIds[i]] = skins[i];
            ++totalSupply;
        }
    }

    /// Where the metadata lives: tokenURI = baseUri + tokenId.
    function setBaseUri(string calldata uri) external onlyOwner {
        baseUri = uri;
        emit BaseUriChanged(uri);
    }

    function setOwner(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, next);
        owner = next;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }
}
