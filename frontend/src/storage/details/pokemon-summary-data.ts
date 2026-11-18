import type { PkmBaseDTO } from '../../data/sdk/model';

export type PokemonSummaryData = Pick<PkmBaseDTO,
    'id' | 'species' | 'form' | 'context' | 'version' | 'nickname' | 'gender' | 'isEgg' | 'isShiny'
    | 'isEnabled' | 'types' | 'originTrainerName' | 'originTrainerGender' | 'tid' | 'pid' | 'languageID'
> & Partial<Pick<PkmBaseDTO,
    'generation' | 'contextVersion' | 'level' | 'ball' | 'heldItem' | 'nature' | 'ability' | 'isAbilityHidden'
    | 'iVs' | 'eVs' | 'stats' | 'moves' | 'relearnMoves' | 'alphaMove' | 'markings' | 'contest' | 'ribbons'
    | 'friendship' | 'eggHatchCount' | 'originMetLocation' | 'originMetLevel' | 'originMetDate'
    | 'handlingTrainerName' | 'handlingTrainerGender' | 'sid' | 'fatefulEncounter'
    | 'isAlpha' | 'canGigantamax' | 'nSparkle' | 'isShadow' | 'teraType' | 'pokerusDays' | 'isPokerusCured'
    | 'canEvolve' | 'isDuplicate'
>> & {
    homeTracker?: number | string;
};
