/** The cast of playable characters (rival chains are run by the ones you don't pick). */

export type PerkId = 'negotiator' | 'chef' | 'heir' | 'charmer' | 'thrifty' | 'boss' | 'showman' | 'banker';

export const PERKS: Record<PerkId, { label: string; description: string }> = {
  negotiator: { label: 'Silver tongue', description: 'Realtors and suppliers are easier to haggle with.' },
  chef: { label: 'Trained chef', description: 'Every pizza you serve tastes 6% better to guests.' },
  heir: { label: 'Family money', description: 'Starts with an extra $25,000.' },
  charmer: { label: 'Local celebrity', description: 'New restaurants open with a head start on reputation.' },
  thrifty: { label: 'Penny pincher', description: 'Ingredients cost 10% less.' },
  boss: { label: 'Born manager', description: 'Job applicants are noticeably more skilled.' },
  showman: { label: 'Showman', description: 'Advertising campaigns are 25% more effective.' },
  banker: { label: 'Banker’s friend', description: 'Loan interest is halved.' },
};

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'bald' | 'mohawk' | 'side' | 'bob';
export type Accessory = 'none' | 'glasses' | 'sunglasses' | 'earrings' | 'hat' | 'chef-hat' | 'bow' | 'headband';
export type FacialHair = 'none' | 'moustache' | 'beard' | 'stubble';

export interface Look {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  eyes: number;
  shirt: number;
  accessory: Accessory;
  facialHair: FacialHair;
  /** 0 = round, 1 = long, 2 = square. */
  faceShape: number;
  age: 'young' | 'middle' | 'old';
}

export interface Character {
  id: string;
  name: string;
  hometown: string;
  bio: string;
  perk: PerkId;
  color: number;
  look: Look;
}

const SKIN = [0xf6d5b8, 0xe9b98f, 0xc68a5c, 0x9a6440, 0x6e4528, 0xf1c9a5];
const HAIR = { black: 0x1f1a17, brown: 0x5a3a22, blonde: 0xe1c16e, red: 0xa8432a, grey: 0xa7a7a7, white: 0xeeeeee, blue: 0x3a6ea5, pink: 0xd96aa1 };

export const CHARACTERS: readonly Character[] = [
  { id: 'gianna', name: 'Gianna Ferro', hometown: 'Naples', bio: 'Grew up above her aunt’s bakery and has opinions about every crust in the world.', perk: 'chef', color: 0xe63946, look: { skin: SKIN[1], hair: HAIR.black, hairStyle: 'bun', eyes: 0x4a3222, shirt: 0xffffff, accessory: 'chef-hat', facialHair: 'none', faceShape: 0, age: 'middle' } },
  { id: 'otto', name: 'Otto Brandt', hometown: 'Hamburg', bio: 'A retired shipping clerk who counts every cent twice and then once more for luck.', perk: 'thrifty', color: 0x2a9d8f, look: { skin: SKIN[0], hair: HAIR.grey, hairStyle: 'side', eyes: 0x3d6b8c, shirt: 0x34495e, accessory: 'glasses', facialHair: 'moustache', faceShape: 1, age: 'old' } },
  { id: 'amara', name: 'Amara Okafor', hometown: 'Lagos', bio: 'Former radio host who can sell ice to a penguin and pizza to a pizzaiolo.', perk: 'showman', color: 0xf4a261, look: { skin: SKIN[4], hair: HAIR.black, hairStyle: 'curly', eyes: 0x2b1a10, shirt: 0xf4a261, accessory: 'earrings', facialHair: 'none', faceShape: 0, age: 'young' } },
  { id: 'kenji', name: 'Kenji Mori', hometown: 'Osaka', bio: 'Ran a noodle stand at sixteen and a team of forty by twenty-five.', perk: 'boss', color: 0x8e5bd6, look: { skin: SKIN[5], hair: HAIR.black, hairStyle: 'short', eyes: 0x2b1a10, shirt: 0x1d3557, accessory: 'none', facialHair: 'none', faceShape: 2, age: 'young' } },
  { id: 'rosalind', name: 'Rosalind Hale', hometown: 'Bath', bio: 'Old money, new ideas. Her grandmother’s trust fund is about to meet mozzarella.', perk: 'heir', color: 0x6a4c93, look: { skin: SKIN[0], hair: HAIR.blonde, hairStyle: 'bob', eyes: 0x4f7a3a, shirt: 0x6a4c93, accessory: 'bow', facialHair: 'none', faceShape: 1, age: 'young' } },
  { id: 'diego', name: 'Diego Salazar', hometown: 'Guadalajara', bio: 'Haggled his first car down to half price. The car did not run, but still.', perk: 'negotiator', color: 0xe76f51, look: { skin: SKIN[2], hair: HAIR.brown, hairStyle: 'side', eyes: 0x3b2414, shirt: 0xe76f51, accessory: 'sunglasses', facialHair: 'stubble', faceShape: 2, age: 'middle' } },
  { id: 'freya', name: 'Freya Lund', hometown: 'Bergen', bio: 'A TV cooking-show contestant who came second and has been plotting ever since.', perk: 'charmer', color: 0x48cae4, look: { skin: SKIN[0], hair: HAIR.red, hairStyle: 'long', eyes: 0x3d6b8c, shirt: 0x48cae4, accessory: 'headband', facialHair: 'none', faceShape: 0, age: 'young' } },
  { id: 'walter', name: 'Walter Pike', hometown: 'Chicago', bio: 'Thirty years in banking taught him one thing: always know who to call.', perk: 'banker', color: 0x264653, look: { skin: SKIN[1], hair: HAIR.white, hairStyle: 'bald', eyes: 0x5b4636, shirt: 0x264653, accessory: 'glasses', facialHair: 'beard', faceShape: 2, age: 'old' } },
  { id: 'priya', name: 'Priya Raman', hometown: 'Chennai', bio: 'Engineer turned entrepreneur who optimises ovens like other people optimise code.', perk: 'boss', color: 0xffb703, look: { skin: SKIN[3], hair: HAIR.black, hairStyle: 'long', eyes: 0x2b1a10, shirt: 0xffb703, accessory: 'earrings', facialHair: 'none', faceShape: 1, age: 'middle' } },
  { id: 'marcel', name: 'Marcel Dubois', hometown: 'Lyon', bio: 'Claims to have invented three sauces. Can prove at least one of them.', perk: 'chef', color: 0x9d0208, look: { skin: SKIN[0], hair: HAIR.brown, hairStyle: 'short', eyes: 0x4a3222, shirt: 0x9d0208, accessory: 'hat', facialHair: 'moustache', faceShape: 1, age: 'middle' } },
  { id: 'tasha', name: 'Tasha Greene', hometown: 'Atlanta', bio: 'Started with a food truck and a dream. The truck has since retired; the dream has not.', perk: 'charmer', color: 0x06d6a0, look: { skin: SKIN[4], hair: HAIR.pink, hairStyle: 'mohawk', eyes: 0x2b1a10, shirt: 0x06d6a0, accessory: 'earrings', facialHair: 'none', faceShape: 0, age: 'young' } },
  { id: 'ivan', name: 'Ivan Petrov', hometown: 'Odessa', bio: 'A chess club champion who treats every rent negotiation like an endgame.', perk: 'negotiator', color: 0x588157, look: { skin: SKIN[0], hair: HAIR.blonde, hairStyle: 'short', eyes: 0x3d6b8c, shirt: 0x588157, accessory: 'none', facialHair: 'beard', faceShape: 2, age: 'middle' } },
  { id: 'lucia', name: 'Lucía Ortega', hometown: 'Valencia', bio: 'Runs her family’s market stall and knows exactly what a tomato should cost.', perk: 'thrifty', color: 0xbc4749, look: { skin: SKIN[2], hair: HAIR.black, hairStyle: 'curly', eyes: 0x3b2414, shirt: 0xbc4749, accessory: 'headband', facialHair: 'none', faceShape: 0, age: 'old' } },
  { id: 'bao', name: 'Bao Nguyen', hometown: 'Hanoi', bio: 'Grew a single takeaway into a neighbourhood institution with nothing but flyers.', perk: 'showman', color: 0x3a86ff, look: { skin: SKIN[5], hair: HAIR.blue, hairStyle: 'side', eyes: 0x2b1a10, shirt: 0x3a86ff, accessory: 'sunglasses', facialHair: 'none', faceShape: 1, age: 'young' } },
  { id: 'harriet', name: 'Harriet Quill', hometown: 'Boston', bio: 'Inherited a fortune and a cat named Pepperoni. Only one of them has a business plan.', perk: 'heir', color: 0xcdb4db, look: { skin: SKIN[0], hair: HAIR.grey, hairStyle: 'bun', eyes: 0x4f7a3a, shirt: 0xcdb4db, accessory: 'glasses', facialHair: 'none', faceShape: 1, age: 'old' } },
  { id: 'samir', name: 'Samir Haddad', hometown: 'Beirut', bio: 'Former loan officer who knows every trick in the bank’s book because he wrote some.', perk: 'banker', color: 0xfb8500, look: { skin: SKIN[2], hair: HAIR.black, hairStyle: 'short', eyes: 0x3b2414, shirt: 0xfb8500, accessory: 'none', facialHair: 'beard', faceShape: 2, age: 'middle' } },
];

export function character(id: string | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function firstName(name: string): string {
  return name.split(' ')[0];
}
