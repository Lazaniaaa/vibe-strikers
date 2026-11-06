// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// Vibe Strikers season skins (GAME.md 6.11). Robinhood Chain testnet only.
/// Standard ERC-721. The owner mints from a list made by the game server when a player asks for an NFT to be sent to
/// their wallet. Token ids come from the server and are stable, so a batch can be sent again: tokens that exist are
/// skipped. Players never pay to receive a token.
/// Selling: the holder signs a price for free (no transaction, no approval); the buyer calls buy() and pays the price and
/// the gas. Any transfer of the token and cancelSale() make older signatures useless.
contract SeasonSkins is ERC721, EIP712 {
    address public owner;
    uint256 public totalSupply;
    /// tokenId => season, level, rarity, weapon and seed in one word (layout: nftSkinWord in src/gameplay/nft.ts).
    mapping(uint256 => uint256) public skinOf;
    /// tokenId => part of a sale signature; grows with every transfer and cancel.
    mapping(uint256 => uint256) public saleNonce;
    string private baseUri;

    bytes32 private constant SALE_TYPEHASH = keccak256("Sale(uint256 tokenId,uint256 price,uint256 expiry,uint256 nonce)");

    event Skipped(uint256 indexed tokenId, address indexed to);
    event BaseUriChanged(string uri);
    event OwnerChanged(address indexed from, address indexed to);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event SaleCancelled(uint256 indexed tokenId);

    error NotOwner();
    error NotHolder();
    error LengthMismatch();
    error ZeroAddress();
    error SaleExpired();
    error WrongPrice();
    error BadSignature();
    error NoSuchToken();
    error PaymentFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() ERC721("Vibe Strikers Skins", "VSKIN") EIP712("Vibe Strikers Skins", "1") {
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

    /// Buy with the holder's signature. The buyer pays exactly the signed price, and it goes to the holder.
    function buy(uint256 tokenId, uint256 price, uint256 expiry, bytes calldata signature) external payable {
        if (block.timestamp > expiry) revert SaleExpired();
        if (msg.value != price) revert WrongPrice();
        address seller = _ownerOf(tokenId);
        if (seller == address(0)) revert NoSuchToken();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(SALE_TYPEHASH, tokenId, price, expiry, saleNonce[tokenId])));
        if (ECDSA.recover(digest, signature) != seller) revert BadSignature();
        _transfer(seller, msg.sender, tokenId); // raises the nonce before any money moves
        (bool ok, ) = seller.call{value: price}("");
        if (!ok) revert PaymentFailed();
        emit Sold(tokenId, seller, msg.sender, price);
    }

    /// Make the holder's older sale signatures for this token useless.
    function cancelSale(uint256 tokenId) external {
        if (_ownerOf(tokenId) != msg.sender) revert NotHolder();
        ++saleNonce[tokenId];
        emit SaleCancelled(tokenId);
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

    /// Every move of a token ends its open sale signatures.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0)) ++saleNonce[tokenId];
        return from;
    }
}
