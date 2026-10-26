import archaeologist from 'madness-engine/characters/archaeologist';
import cabbie from 'madness-engine/characters/cabbie';
import { CAT_DEFS } from 'madness-engine/characters/cat';
import corgi from 'madness-engine/characters/corgi';
import dancer from 'madness-engine/characters/dancer';
import gent from 'madness-engine/characters/gent';
import hotdog from 'madness-engine/characters/hotdog';
import nonna from 'madness-engine/characters/nonna';
import pigeon from 'madness-engine/characters/pigeon';
import poodle from 'madness-engine/characters/poodle';
import rat from 'madness-engine/characters/rat';
import robot from 'madness-engine/characters/robot';
import security from 'madness-engine/characters/security';
import skier from 'madness-engine/characters/skier';
import superfan from 'madness-engine/characters/superfan';
import tourist from 'madness-engine/characters/tourist';
import yodeler from 'madness-engine/characters/yodeler';

/**
 * The townsfolk, and the animals about town: rigged and sculpted, borrowed
 * from the family — the people and the pigeons, the corgi, the rat and the
 * poodle from Rock 'n' Roller III, the cats (`cat-ginger` and the rest)
 * from Catroller.
 */
export const CAST = {
  archaeologist, cabbie, corgi, dancer, gent, hotdog, nonna, pigeon, poodle, rat, robot, security, skier, superfan, tourist, yodeler,
  ...CAT_DEFS,
};

/** How finely the townsfolk are meshed: a little coarser than a close-up. */
export const DETAIL = 0.6;
