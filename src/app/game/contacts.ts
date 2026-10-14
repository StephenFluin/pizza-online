import { Accessory, FacialHair, HairStyle, Look } from './characters';
import { FIRST_NAMES, INGREDIENTS, LAST_NAMES } from './data';
import { Rng, hashString } from './rng';

export type ContactKind = 'realtor' | 'bank' | 'supplier' | 'agency' | 'mayor' | 'insurance';

export interface Contact {
  id: string;
  kind: ContactKind;
  cityId: string;
  name: string;
  company: string;
  look: Look;
  color: number;
  /** 0 (pushover) .. 1 (hard bargainer). */
  toughness: number;
}

export const REALTORS_PER_CITY = 3;

const SKINS = [0xf6d5b8, 0xe9b98f, 0xc68a5c, 0x9a6440, 0x6e4528, 0xf1c9a5];
const HAIRS = [0x1f1a17, 0x5a3a22, 0xe1c16e, 0xa8432a, 0xa7a7a7, 0xeeeeee];
const STYLES: HairStyle[] = ['short', 'long', 'bun', 'curly', 'bald', 'side', 'bob'];
const ACCESSORIES: Accessory[] = ['none', 'none', 'glasses', 'earrings', 'hat', 'none'];
const FACIAL: FacialHair[] = ['none', 'none', 'moustache', 'beard', 'stubble'];
const SHIRTS = [0x1d3557, 0x6d597a, 0x2a9d8f, 0x8d99ae, 0x264653, 0x9d0208, 0x3a5a40];
const REALTOR_SUFFIXES = ['Estates', 'Property Group', 'Realty', '& Partners', 'Lettings'];

export function randomLook(rng: Rng): Look {
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    hairStyle: rng.pick(STYLES),
    eyes: rng.pick([0x2b1a10, 0x3d6b8c, 0x4f7a3a, 0x5b4636]),
    shirt: rng.pick(SHIRTS),
    accessory: rng.pick(ACCESSORIES),
    facialHair: rng.pick(FACIAL),
    faceShape: rng.int(0, 2),
    age: rng.pick(['young', 'middle', 'old'] as const),
  };
}

function person(rng: Rng): { first: string; last: string } {
  return { first: rng.pick(FIRST_NAMES), last: rng.pick(LAST_NAMES) };
}

/** Everyone you can phone in a city. Deterministic per game seed so names stay stable across saves. */
export function cityContacts(cityId: string, gameSeed: number): Contact[] {
  const rng = new Rng(hashString(`contacts:${cityId}`) ^ gameSeed);
  const contacts: Contact[] = [];
  for (let i = 0; i < REALTORS_PER_CITY; i++) {
    const p = person(rng);
    contacts.push({
      id: `${cityId}:realtor:${i}`,
      kind: 'realtor',
      cityId,
      name: `${p.first} ${p.last}`,
      company: `${p.last} ${rng.pick(REALTOR_SUFFIXES)}`,
      look: randomLook(rng),
      color: rng.pick([0x457b9d, 0x6a994e, 0xbc6c25, 0x7b2cbf]),
      toughness: rng.range(0.1, 0.9),
    });
  }
  const bank = person(rng);
  contacts.push({ id: `${cityId}:bank`, kind: 'bank', cityId, name: `${bank.first} ${bank.last}`, company: 'City Savings Bank', look: { ...randomLook(rng), shirt: 0x1d3557 }, color: 0x264653, toughness: 0.5 });
  const sup = person(rng);
  contacts.push({ id: `${cityId}:supplier`, kind: 'supplier', cityId, name: `${sup.first} ${sup.last}`, company: 'Fresh Fields Wholesale', look: randomLook(rng), color: 0x6a994e, toughness: rng.range(0.2, 0.8) });
  const broker = person(rng);
  contacts.push({ id: `${cityId}:insurance`, kind: 'insurance', cityId, name: `${broker.first} ${broker.last}`, company: 'Safe Harbour Insurance', look: randomLook(rng), color: 0x2a9d8f, toughness: 0.5 });
  const mayor = person(rng);
  contacts.push({ id: `${cityId}:mayor`, kind: 'mayor', cityId, name: `${mayor.first} ${mayor.last}`, company: 'Office of the Mayor', look: { ...randomLook(rng), shirt: 0x2b2d42 }, color: 0x9d0208, toughness: 0.5 });
  const ag = person(rng);
  contacts.push({ id: `${cityId}:agency`, kind: 'agency', cityId, name: `${ag.first} ${ag.last}`, company: 'Top Staff Agency', look: randomLook(rng), color: 0xe9c46a, toughness: 0.5 });
  return contacts;
}

/** The realtor agency that handles a particular lot. */
export function realtorFor(cityId: string, gameSeed: number, lotId: number): Contact {
  return cityContacts(cityId, gameSeed)[lotId % REALTORS_PER_CITY];
}

/** This week's discounted ingredient at a city's wholesaler. */
export function weeklySpecial(cityId: string, day: number): { ingredientId: string; discount: number } {
  const week = Math.floor(day / 7);
  const rng = new Rng(hashString(`special:${cityId}:${week}`));
  return { ingredientId: rng.pick(INGREDIENTS).id, discount: rng.pick([0.15, 0.2, 0.25, 0.3]) };
}
