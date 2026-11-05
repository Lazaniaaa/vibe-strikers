export { createCharacter, disposeCharacterResources, characterCacheKey, BODY_HEIGHT, DEFAULT_PROPORTIONS } from './createCharacter';
export { poseCharacter, restoreReferencePose } from './poseCharacter';
export { characters } from './characters';
export { prepareLobbyAnimation, playEmote, updateAnimation } from './lobbyAnimation';
export { LOBBY_EMOTES, LOBBY_ANIMATION } from './lobbyEmotes';
export type { LobbyEmoteId } from './lobbyEmotes';
export type { CharacterConfig, CharacterColors, PoseState, CharacterRuntime, CharacterParts,
  BodyExtents, Extent, BoxSpec, PartName, Vec3, HoldSide, ArmLengthVariant } from './types';
