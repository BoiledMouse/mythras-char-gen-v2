/*
  Mythras Character Generator (Simplified)

  This script provides a self‑contained alternative to the original
  generator hosted at https://boiledmouse.github.io/mythras-char-gen-v2/.  The
  original script is extremely long (~1 900 lines) and registers its
  navigation handlers at the very end of an enormous `init()` function.  If
  anything goes wrong during initialisation the remainder of the function
  aborts, leaving the navigation buttons inert and preventing the age
  category from updating the bonus skill pool.  Rather than patching
  thousands of lines of minified code, this script rebuilds the key
  functionality from the published Mythras rules using embedded data
  tables derived from the JSON files in the project's `data/` folder.

  The implementation emphasises clarity and completeness over sheer
  feature count.  All standard and professional skills are defined with
  base formulae, every culture and career from the Mythras SRD is
  included, and both roll and point‑buy methods for characteristics are
  supported.  Derived statistics such as damage modifier, healing rate,
  luck points and hit points per location are calculated using the same
  formulas as the printed rulebook.  A simple equipment list and
  starting silver roll based on culture and social class are provided.

  This script uses vanilla JavaScript and requires no external
  dependencies.  It should be placed alongside `index.html` and
  `style.css` in the root of your project.
*/

(function() {
  'use strict';

  /* ----------------------------------------------------------------------
   * Data definitions
   *
   * The following objects are distilled from the JSON files in the
   * mythras‑char‑gen‑v2 repository (`data/skills.json`,
   * `data/careers.json`, `data/cultures.json`) as well as the System
   * Reference Document.  They are embedded here to avoid cross‑origin
   * requests and to ensure the generator works offline.  If you wish to
   * extend these tables with your own entries simply follow the same
   * structure.
   */

  // Age categories with bonus pools and per‑skill caps.  The random age
  // ranges are provided for flavour only.
  const ageCategories = {
    Young:  { bonus: 100, max: 10, age: '10+1d6' },
    Adult:  { bonus: 150, max: 15, age: '15+2d6' },
    Middle: { bonus: 200, max: 20, age: '25+3d6' },
    Senior: { bonus: 250, max: 25, age: '40+4d6' },
    Old:    { bonus: 300, max: 30, age: '60+5d6' }
  };

  // Standard skill definitions.  Each entry defines a base formula in
  // terms of the seven attributes STR, CON, SIZ, DEX, INT, POW and CHA.
  const standardSkills = {
    'Athletics':     { formula: a => a.STR + a.DEX },
    'Boating':       { formula: a => a.STR + a.CON },
    'Brawn':         { formula: a => a.STR + a.SIZ },
    'Conceal':       { formula: a => a.DEX + a.POW },
    'Customs':       { formula: a => a.INT * 2 + 40 },
    'Dance':         { formula: a => a.DEX + a.CHA },
    'Deceit':        { formula: a => a.INT + a.CHA },
    'Drive':         { formula: a => a.DEX + a.POW },
    'Endurance':     { formula: a => a.CON * 2 },
    'Evade':         { formula: a => a.DEX * 2 },
    'First Aid':     { formula: a => a.INT + a.DEX },
    'Influence':     { formula: a => a.CHA * 2 },
    'Insight':       { formula: a => a.INT + a.POW },
    'Locale':        { formula: a => a.INT * 2 },
    'Native Tongue': { formula: a => a.INT + a.CHA + 40 },
    'Perception':    { formula: a => a.INT + a.POW },
    'Ride':          { formula: a => a.DEX + a.POW },
    'Sing':          { formula: a => a.CHA + a.POW },
    'Stealth':       { formula: a => a.DEX + a.INT },
    'Swim':          { formula: a => a.STR + a.CON },
    'Unarmed':       { formula: a => a.STR + a.DEX },
    'Willpower':     { formula: a => a.POW * 2 }
  };

  // Human‑readable formula strings for each skill.  These are used to
  // display how a base percentage is derived.  Entries not listed
  // default to an empty string.
  const skillFormulaStrings = {
    // Standard skills
    'Athletics': 'STR+DEX',
    'Boating': 'STR+CON',
    'Brawn': 'STR+SIZ',
    'Conceal': 'DEX+POW',
    'Customs': 'INT*2 +40',
    'Dance': 'DEX+CHA',
    'Deceit': 'INT+CHA',
    'Drive': 'DEX+POW',
    'Endurance': 'CON*2',
    'Evade': 'DEX*2',
    'First Aid': 'INT+DEX',
    'Influence': 'CHA*2',
    'Insight': 'INT+POW',
    'Locale': 'INT*2',
    'Native Tongue': 'INT+CHA +40',
    'Perception': 'INT+POW',
    'Ride': 'DEX+POW',
    'Sing': 'CHA+POW',
    'Stealth': 'DEX+INT',
    'Swim': 'STR+CON',
    'Unarmed': 'STR+DEX',
    'Willpower': 'POW*2',
    // Professional skills
    'Acting': 'CHA*2',
    'Acrobatics': 'STR+DEX',
    'Art': 'POW+CHA',
    'Bureaucracy': 'INT*2',
    'Commerce': 'INT+CHA',
    'Courtesy': 'INT+CHA',
    'Craft': 'DEX+INT',
    'Culture': 'INT*2',
    'Disguise': 'INT+CHA',
    'Engineering': 'INT*2',
    'Gambling': 'INT+POW',
    'Healing': 'INT+POW',
    'Language': 'INT+CHA',
    'Literacy': 'INT*2',
    'Lockpicking': 'DEX*2',
    'Lore': 'INT*2',
    'Mechanisms': 'DEX+INT',
    'Musicianship': 'DEX+CHA',
    'Navigation': 'INT+POW',
    'Oratory': 'POW+CHA',
    'Seamanship': 'INT+CON',
    'Seduction': 'INT+CHA',
    'Sleight': 'DEX+CHA',
    'Streetwise': 'POW+CHA',
    'Survival': 'CON+POW',
    'Teach': 'INT+CHA',
    'Track': 'INT+CON'
  };

  // Professional skill definitions.  Unknown professional skills default
  // to a base of 0.  Feel free to add or override entries here.
  const professionalSkills = {
    'Acting':        { formula: a => a.CHA * 2 },
    'Acrobatics':    { formula: a => a.STR + a.DEX },
    'Art':           { formula: a => a.POW + a.CHA },
    'Bureaucracy':   { formula: a => a.INT * 2 },
    'Commerce':      { formula: a => a.INT + a.CHA },
    'Courtesy':      { formula: a => a.INT + a.CHA },
    'Craft':         { formula: a => a.DEX + a.INT },
    'Culture':       { formula: a => a.INT * 2 },
    'Disguise':      { formula: a => a.INT + a.CHA },
    'Engineering':   { formula: a => a.INT * 2 },
    'Gambling':      { formula: a => a.INT + a.POW },
    'Healing':       { formula: a => a.INT + a.POW },
    'Language':      { formula: a => a.INT + a.CHA },
    'Literacy':      { formula: a => a.INT * 2 },
    'Lockpicking':   { formula: a => a.DEX * 2 },
    'Lore':          { formula: a => a.INT * 2 },
    'Mechanisms':    { formula: a => a.DEX + a.INT },
    'Musicianship':  { formula: a => a.DEX + a.CHA },
    'Navigation':    { formula: a => a.INT + a.POW },
    'Oratory':       { formula: a => a.POW + a.CHA },
    'Seamanship':    { formula: a => a.INT + a.CON },
    'Seduction':     { formula: a => a.INT + a.CHA },
    'Sleight':       { formula: a => a.DEX + a.CHA },
    'Streetwise':    { formula: a => a.POW + a.CHA },
    'Survival':      { formula: a => a.CON + a.POW },
    'Teach':         { formula: a => a.INT + a.CHA },
    'Track':         { formula: a => a.INT + a.CON }
  };

  // Careers from the SRD.  Each career has a human‑readable name,
  // standard skills and professional skills drawn from the rulebook.  The
  // keys correspond to the JSON keys in careers.json.
  const careers = {
    agent:        { name: 'Agent',        standard: ['Conceal','Deceit','Evade','Insight','Perception','Stealth'], professional: ['Culture (any)','Disguise','Language (any)','Sleight','Streetwise','Survival','Track'] },
    alchemist:    { name: 'Alchemist',    standard: ['Customs','Endurance','First Aid','Insight','Locale','Perception','Willpower'], professional: ['Commerce','Craft (Alchemy)','Healing','Language (any)','Literacy','Lore (Specific Alchemical Speciality)','Streetwise'] },
    beastHandler: { name: 'Beast Handler',standard: ['Drive','Endurance','First Aid','Influence','Locale','Ride','Willpower'], professional: ['Commerce','Craft (Animal Husbandry)','Healing (Specific Species)','Lore (Specific Species)','Survival','Teach (Specific Species)','Track'] },
    courtesan:    { name: 'Courtesan',    standard: ['Customs','Dance','Deceit','Influence','Insight','Perception','Sing'], professional: ['Art (any)','Courtesy','Culture (any)','Gambling','Language (any)','Musicianship','Seduction'] },
    courtier:     { name: 'Courtier',     standard: ['Customs','Dance','Deceit','Influence','Insight','Locale','Perception'], professional: ['Art (any)','Bureaucracy','Courtesy','Culture (any)','Language (any)','Lore (any)','Oratory'] },
    crafter:      { name: 'Crafter',      standard: ['Brawn','Drive','Influence','Insight','Locale','Perception','Willpower'], professional: ['Art (any)','Commerce','Craft (Primary)','Craft (Secondary)','Engineering','Mechanisms','Streetwise'] },
    entertainer:  { name: 'Entertainer',  standard: ['Athletics','Brawn','Dance','Deceit','Influence','Insight','Sing'], professional: ['Acrobatics','Acting','Oratory','Musicianship','Seduction','Sleight','Streetwise'] },
    farmer:       { name: 'Farmer',       standard: ['Athletics','Brawn','Drive','Endurance','Locale','Perception','Ride'], professional: ['Commerce','Craft (any)','Lore (Agriculture)','Lore (Animal Husbandry)','Navigation','Survival','Track'] },
    fisher:       { name: 'Fisher',       standard: ['Athletics','Boating','Endurance','Locale','Perception','Stealth','Swim'], professional: ['Commerce','Craft (any)','Lore (Primary Catch)','Lore (Secondary Catch)','Navigation','Seamanship','Survival'] },
    herder:       { name: 'Herder',       standard: ['Endurance','First Aid','Insight','Locale','Perception','Ride'], professional: ['Commerce','Craft (Animal Husbandry)','Healing (Specific Species)','Navigation','Musicianship','Survival','Track'] },
    hunter:       { name: 'Hunter',       standard: ['Athletics','Endurance','Locale','Perception','Ride','Stealth'], professional: ['Commerce','Craft (Hunting Related)','Lore (Regional or Specific Species)','Mechanisms','Navigation','Survival','Track'] },
    merchant:     { name: 'Merchant',     standard: ['Boating','Drive','Deceit','Insight','Influence','Locale','Ride'], professional: ['Courtesy','Culture (any)','Language (any)','Navigation','Seamanship','Streetwise'] },
    miner:        { name: 'Miner',        standard: ['Athletics','Brawn','Endurance','Locale','Perception','Sing','Willpower'], professional: ['Commerce','Craft (Mining)','Engineering','Lore (Minerals)','Mechanisms','Navigation (Underground)','Survival'] },
    mystic:       { name: 'Mystic',       standard: ['Athletics','Endurance','Evade','Insight','Perception','Willpower'], professional: ['Art (any)','Folk Magic','Literacy','Lore (any)','Meditation','Musicianship','Mysticism'] },
    official:     { name: 'Official',     standard: ['Customs','Deceit','Influence','Insight','Locale','Perception','Willpower'], professional: ['Bureaucracy','Commerce','Courtesy','Language (any)','Literacy','Lore (any)','Oratory'] },
    physician:    { name: 'Physician',    standard: ['Dance','First Aid','Influence','Insight','Locale','Sing','Willpower'], professional: ['Commerce','Craft (Specific Physiological Speciality)','Healing','Language (any)','Literacy','Lore (Specific Alchemical Speciality)','Streetwise'] },
    priest:       { name: 'Priest',       standard: ['Customs','Dance','Deceit','Influence','Insight','Locale','Willpower'], professional: ['Bureaucracy','Devotion (Pantheon, Cult or God)','Exhort','Folk Magic','Literacy','Lore (any)','Oratory'] },
    sailor:       { name: 'Sailor',       standard: ['Athletics','Boating','Brawn','Endurance','Locale','Swim'], professional: ['Craft (Specific Shipboard Speciality)','Culture (any)','Language (any)','Lore (any)','Navigation','Seamanship','Survival'] },
    scholar:      { name: 'Scholar',      standard: ['Customs','Influence','Insight','Locale','Native Tongue','Perception','Willpower'], professional: ['Culture (any)','Language (any)','Literacy','Lore (Primary)','Lore (Secondary)','Oratory','Teach'] },
    scout:        { name: 'Scout',        standard: ['Athletics','Endurance','First Aid','Perception','Stealth','Swim'], professional: ['Culture (any)','Healing','Language (any)','Lore (any)','Navigation','Survival','Track'] },
    shaman:       { name: 'Shaman',       standard: ['Customs','Dance','Deceit','Influence','Insight','Locale','Willpower'], professional: ['Binding (Cult, Totem or Tradition)','Folk Magic','Healing','Lore (any)','Oratory','Sleight','Trance'] },
    sorcerer:     { name: 'Sorcerer',     standard: ['Customs','Deceit','Influence','Insight','Locale','Perception','Willpower'], professional: ['Folk Magic','Invocation (Cult, School or Grimoire)','Language (any)','Literacy','Lore (any)','Shaping','Sleight'] },
    thief:        { name: 'Thief',        standard: ['Athletics','Deceit','Evade','Insight','Perception','Stealth'], professional: ['Acting','Commerce','Disguise','Lockpicking','Mechanisms','Sleight','Streetwise'] },
    warrior:      { name: 'Warrior',      standard: ['Athletics','Brawn','Endurance','Evade','Unarmed'], professional: ['Craft (any)','Engineering','Gambling','Lore (Military History)','Lore (Strategy and Tactics)','Oratory','Survival'] }
  };

  // Cultures.  Each culture defines its own standard skills, professional
  // skills, combat styles, money dice (for starting silver) and social
  // classes.  A social class determines the multiplier used when rolling
  // starting silver.
  const cultures = {
    Barbarian: {
      name: 'Barbarian',
      standard: ['Athletics','Brawn','Endurance','First Aid','Locale','Perception','Boating','Ride'],
      professional: ['Craft','Healing','Lore','Musicianship','Navigation','Seamanship','Survival','Track'],
      combatStyles: ['Barbarian Fyrdman','Berserker','Horse Eater','Seaborne Reiver','Weapon Thegn','Wolf Hunter'],
      moneyDice: '4d6*50',
      socialClasses: [ { name:'Thrall', min:1, max:20, mult:0.5 }, { name:'Clanfolk', min:21, max:60, mult:1.0 }, { name:'Warrior', min:61, max:90, mult:1.25 }, { name:'Chieftain', min:91, max:100, mult:2.0 } ]
    },
    Civilised: {
      name: 'Civilised',
      standard: ['Conceal','Deceit','Drive','Influence','Insight','Locale','Willpower'],
      professional: ['Art','Commerce','Craft','Courtesy','Language','Lore','Musicianship','Streetwise'],
      combatStyles: ['Citizen Legionary','City‑state Phalangite','Levied Archer','Light Skirmisher','Street Thug','Town Militia'],
      moneyDice: '4d6*75',
      socialClasses: [ { name:'Peasant', min:1, max:30, mult:0.75 }, { name:'Yeoman', min:31, max:60, mult:1.0 }, { name:'Townsman', min:61, max:80, mult:1.25 }, { name:'Patrician', min:81, max:95, mult:1.5 }, { name:'Senator', min:96, max:100, mult:2.0 } ]
    },
    Nomadic: {
      name: 'Nomadic',
      standard: ['Endurance','First Aid','Locale','Perception','Stealth','Athletics','Boating','Swim','Drive','Ride'],
      professional: ['Craft','Culture','Language','Lore','Musicianship','Navigation','Survival','Track'],
      combatStyles: ['Camel Cavalry','Feathered Death Flinger','Horse Lord','Whale Hunter','Wheeled Warrior','Wolf Runner'],
      moneyDice: '4d6*25',
      socialClasses: [ { name:'Rider', min:1, max:25, mult:0.75 }, { name:'Nomad', min:26, max:60, mult:1.0 }, { name:'Clan Leader', min:61, max:85, mult:1.5 }, { name:'Khan', min:86, max:100, mult:2.0 } ]
    },
    Primitive: {
      name: 'Primitive',
      standard: ['Brawn','Endurance','Evade','Locale','Perception','Stealth','Athletics','Boating','Swim'],
      professional: ['Craft','Healing','Lore','Musicianship','Navigation','Survival','Track'],
      combatStyles: ['Flint Death Dealer','Ghost Warrior','Head Hunter','Jaguar Brother','Jungle Savage','Savannah Hunter'],
      moneyDice: '4d6*10',
      socialClasses: [ { name:'Gatherer', min:1, max:40, mult:0.5 }, { name:'Hunter', min:41, max:70, mult:1.0 }, { name:'Shaman', min:71, max:90, mult:1.5 }, { name:'Chief', min:91, max:100, mult:2.0 } ]
    }
  };

  // Equipment categories.  Due to space constraints we include a
  // representative subset from the SRD.  Feel free to expand this
  // dictionary with additional entries from equipment.json.
  const equipment = {
    Armour: [
      { name: 'Natural/Cured Furs', cost: 20 },
      { name: 'Padded/Quilted Aketon', cost: 80 },
      { name: 'Scaled Brigandine', cost: 320 },
      { name: 'Mail', cost: 900 },
      { name: 'Articulated Plate', cost: 2400 }
    ],
    Shields: [
      { name: 'Buckler', cost: 50 },
      { name: 'Heater', cost: 150 },
      { name: 'Scutum', cost: 450 }
    ],
    Weapons: [
      { name: 'Dagger', cost: 30 },
      { name: 'Short Sword', cost: 100 },
      { name: 'Long Sword', cost: 250 },
      { name: 'Axe', cost: 40 },
      { name: 'Bow and 20 Arrows', cost: 200 }
    ],
    Ranged: [
      { name: 'Javelin', cost: 20 },
      { name: 'Short bow', cost: 75 },
      { name: 'Long bow', cost: 200 },
      { name: 'Heavy crossbow', cost: 350 }
    ],
    Misc: [
      { name: 'Backpack', cost: 10 },
      { name: 'Bedroll', cost: 5 },
      { name: 'Lantern', cost: 15 },
      { name: 'Rope (50 ft)', cost: 10 },
      { name: 'Flint & Steel', cost: 2 }
    ]
  };

  /* ----------------------------------------------------------------------
   * Character state
   *
   * A single object stores all mutable state for the currently edited
   * character.  This approach makes it easy to recompute derived
   * statistics whenever a value changes and simplifies the update logic.
   */
  const character = {
    name: '',
    culture: 'Barbarian',
    career: 'warrior',
    age: 'Adult',
    socialClass: null,
    combatStyle: null,
    attributes: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
    pools: { culture: 0, career: 0, bonus: 0 },
    skillAlloc: {},
    money: 0,
    equipment: []
  };

  // Point buy settings
  // When using the point‑buy method for Characteristics the player has a
  // fixed pool of points to distribute across all seven attributes.  Each
  // attribute must meet its Mythras minimum: SIZ and INT must be at least
  // 8 (generated by 2d6+6), whilst STR, CON, DEX, POW and CHA must be at
  // least 3.  The entire cost of raising an attribute from its minimum
  // value comes out of the pool – there is no free baseline of 10.  For
  // example, increasing SIZ from 8 to 13 costs 5 points.  The value of
  // pointPoolTotal is read from the HTML via a data attribute on
  // #pointPool and defaults to 75.
  character.pointPoolTotal = 75;
  character.pointPoolRemaining = 75;

  // Selected professional skills for culture and career.  Users
  // may choose up to three professional skills from their culture and
  // career lists to allocate Culture or Career points.  These sets
  // contain the skill names chosen via the checkboxes rendered by
  // renderProfessionalSelectors().
  let selectedCultureProfs = new Set();
  let selectedCareerProfs = new Set();

  // Selected bonus skill.  A player may choose a single bonus skill as
  // allowed by the optional rules.  This skill automatically gains a
  // predefined number of bonus points (see BONUS_SKILL_POINTS).  Changing
  // the bonus skill will refund points from the previous selection before
  // applying them to the new selection.
  let selectedBonusSkill = null;

  // Number of bonus points automatically allocated to the bonus skill.  If
  // the player has enough bonus pool remaining this amount will be
  // deducted from character.pools.bonus and added to the chosen skill.  If
  // the pool does not contain enough points the allocation will be as
  // high as possible.  You can adjust this constant to match your
  // preferred interpretation of the rules; 20 points reflects the common
  // suggestion for a hobby skill.
  const BONUS_SKILL_POINTS = 20;

  /* ----------------------------------------------------------------------
   * Utility functions
   */

  // Roll NdM dice and return the sum.  Not cryptographically secure but
  // sufficient for a game generator.
  function rollDice(count, sides) {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
  }

  // Evaluate a dice expression of the form '4d6*50'.
  function rollMoney(expr) {
    const [dicePart, multPart] = expr.split('*');
    const [count, sidesPart] = dicePart.toLowerCase().split('d');
    const sides = parseInt(sidesPart, 10);
    const n = parseInt(count, 10);
    const multiplier = parseInt(multPart, 10);
    return rollDice(n, sides) * multiplier;
  }

  // Damage modifier table from the Mythras SRD.  Returns a string such
  // as '+1d4' based on total STR+SIZ.
  function damageModifier(total) {
    if (total <= 5) return '-1d8';
    if (total <= 10) return '-1d6';
    if (total <= 15) return '-1d4';
    if (total <= 20) return '-1d2';
    if (total <= 25) return '0';
    if (total <= 30) return '+1d2';
    if (total <= 35) return '+1d4';
    if (total <= 40) return '+1d6';
    if (total <= 45) return '+1d8';
    if (total <= 50) return '+1d10';
    if (total <= 60) return '+1d12';
    if (total <= 70) return '+2d6';
    if (total <= 80) return '+1d8+1d6';
    if (total <= 90) return '+2d8';
    if (total <= 100) return '+1d10+1d8';
    if (total <= 110) return '+2d10';
    if (total <= 120) return '+2d10+1d2';
    const extra = Math.floor((total - 120) / 10);
    return `+2d10+${extra}d2`;
  }

  // Experience modifier based on CHA.
  function experienceModifier(cha) {
    if (cha <= 6) return -1;
    if (cha <= 12) return 0;
    if (cha <= 18) return 1;
    return 1 + Math.floor((cha - 13) / 6);
  }

  // Healing rate based on CON.
  function healingRate(con) {
    if (con <= 6) return 1;
    if (con <= 12) return 2;
    if (con <= 18) return 3;
    return 3 + Math.floor((con - 13) / 6);
  }

  // Luck points based on POW.
  function luckPoints(pow) {
    if (pow <= 6) return 1;
    if (pow <= 12) return 2;
    if (pow <= 18) return 3;
    return 3 + Math.floor((pow - 13) / 6);
  }

  // Hit points per location table based on CON+SIZ.
  function hitPointsPerLocation(total) {
    const idx = Math.min(Math.floor((total - 1) / 5), 7);
    const base = [
      { head:1, chest:3, abdomen:2, arm:1, leg:1 },
      { head:2, chest:4, abdomen:3, arm:1, leg:2 },
      { head:3, chest:5, abdomen:4, arm:2, leg:3 },
      { head:4, chest:6, abdomen:5, arm:3, leg:4 },
      { head:5, chest:7, abdomen:6, arm:4, leg:5 },
      { head:6, chest:8, abdomen:7, arm:5, leg:6 },
      { head:7, chest:9, abdomen:8, arm:6, leg:7 },
      { head:8, chest:10, abdomen:9, arm:7, leg:8 }
    ][idx];
    const extra = Math.max(0, Math.floor((total - 40) / 5));
    return {
      head: base.head + extra,
      chest: base.chest + extra,
      abdomen: base.abdomen + extra,
      arm: base.arm + extra,
      leg: base.leg + extra
    };
  }

  // Compute the base value of a skill.  Looks up in standardSkills
  // first, then professionalSkills, defaulting to 0 if unknown.
  function computeSkillBase(skillName, attrs) {
    // Normalise to remove parentheses e.g. 'Lore (any)' -> 'Lore'
    const key = skillName.split('(')[0].trim();
    let val = 0;
    if (standardSkills[key]) {
      val = standardSkills[key].formula(attrs);
    } else if (professionalSkills[key]) {
      val = professionalSkills[key].formula(attrs);
    } else {
      val = 0;
    }
    // Mythras rule: any skill has at least 5%.  Customs and Native Tongue
    // already include their bonuses via the formula definition.
    return Math.max(5, val);
  }

  // Format a percentage value with two digits of padding.  E.g. 5 -> '05%'
  function pct(value) {
    return `${value.toString().padStart(2, '0')}%`;
  }

  /* ----------------------------------------------------------------------
   * Point‑buy helper functions
   */

  // Compute and update the remaining points when using the point‑buy
  // method.  The baseline total for attributes is 70 (10 points per
  // attribute).  Remaining = poolTotal + baselineSum − sum(attributes).
  function updatePointPoolDisplay() {
    // Compute the remaining points.  The player spends from the pool to
    // raise attributes above their minimum values.  First compute the sum
    // of minimum values across all seven attributes: INT and SIZ have a
    // minimum of 8; the remainder have a minimum of 3.  The remaining
    // points equal pointPoolTotal minus the total cost paid so far.
    const minSum = (3 * 5) + (8 * 2); // = 31
    const sumVals = Object.values(character.attributes).reduce((a, b) => a + b, 0);
    const costSoFar = sumVals - minSum;
    const remaining = character.pointPoolTotal - costSoFar;
    character.pointPoolRemaining = remaining;
    const poolElem = $('pointPool');
    poolElem.textContent = `Point Pool: ${remaining}`;
    if (remaining < 0) {
      poolElem.style.color = 'red';
    } else {
      poolElem.style.color = '';
    }
  }

  // Render checkboxes for selecting up to three professional skills for
  // both culture and career.  This function populates the
  // #cultureProfs and #careerProfs containers with checkboxes and
  // attaches change listeners to enforce the selection limit.
  function renderProfessionalSelectors() {
    const cul = cultures[character.culture];
    const car = careers[character.career];
    const culContainer = $('cultureProfs');
    const carContainer = $('careerProfs');
    // Clear existing
    culContainer.innerHTML = '';
    carContainer.innerHTML = '';
    // Helper to create checkboxes
    function createCheckbox(skill, type) {
      const id = `${type}-${skill.replace(/\s+/g, '_').replace(/[^\w]/g, '')}`;
      const label = document.createElement('label');
      label.style.display = 'inline-block';
      label.style.marginRight = '0.5rem';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.value = skill;
      // Set checked state based on selection set
      if (type === 'culture') {
        cb.checked = selectedCultureProfs.has(skill);
      } else {
        cb.checked = selectedCareerProfs.has(skill);
      }
      cb.addEventListener('change', () => {
        if (type === 'culture') {
          if (cb.checked) {
            // add
            if (selectedCultureProfs.size >= 3) {
              // limit reached: revert
              cb.checked = false;
              alert('You may select up to 3 culture professional skills');
              return;
            }
            selectedCultureProfs.add(skill);
          } else {
            selectedCultureProfs.delete(skill);
            // Reset any allocations for this skill to culture pool
            if (character.skillAlloc[skill]) {
              character.pools.culture += character.skillAlloc[skill].culture;
              character.skillAlloc[skill].culture = 0;
            }
          }
        } else {
          if (cb.checked) {
            if (selectedCareerProfs.size >= 3) {
              cb.checked = false;
              alert('You may select up to 3 career professional skills');
              return;
            }
            selectedCareerProfs.add(skill);
          } else {
            selectedCareerProfs.delete(skill);
            if (character.skillAlloc[skill]) {
              character.pools.career += character.skillAlloc[skill].career;
              character.skillAlloc[skill].career = 0;
            }
          }
        }
        updatePoolsDisplay();
        updateSkillTable();
        updateSummary();
      });
      label.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = ` ${skill}`;
      label.appendChild(span);
      return label;
    }
    // Culture professional skills
    cul.professional.forEach(skill => {
      culContainer.appendChild(createCheckbox(skill, 'culture'));
    });
    // Career professional skills
    car.professional.forEach(skill => {
      carContainer.appendChild(createCheckbox(skill, 'career'));
    });
  }

  // Handle change of generation method (roll vs point buy).  Show
  // appropriate controls and initialise point pool when necessary.
  function methodChanged() {
    const methodSel = $('method');
    const selected = methodSel.value;
    if (selected === 'roll') {
      $('rollBtnContainer').style.display = 'block';
      $('pointPool').style.display = 'none';
    } else {
      // point buy
      $('rollBtnContainer').style.display = 'none';
      $('pointPool').style.display = 'block';
      // Initialise pool from data attribute if provided, else keep existing
      const defaultPool = parseInt($('pointPool').dataset.pool, 10) || 75;
      character.pointPoolTotal = defaultPool;
      // Reset attributes to their minimum values (3 for most, 8 for SIZ and INT)
      ['STR','CON','DEX','POW','CHA'].forEach(key => {
        character.attributes[key] = 3;
        $(key).value = 3;
      });
      ['SIZ','INT'].forEach(key => {
        character.attributes[key] = 8;
        $(key).value = 8;
      });
      updatePointPoolDisplay();
      updateDerivedDisplay();
      updateSkillTable();
      updatePoolsDisplay();
      updateSummary();
    }
  }

  /* ----------------------------------------------------------------------
   * DOM helpers
   */

  function $(id) { return document.getElementById(id); }

  // Populate a select element with options.  Accepts an array of
  // objects with `value` and `label` properties.
  function populateSelect(selectElem, options) {
    selectElem.innerHTML = '';
    options.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      selectElem.appendChild(el);
    });
  }

  // Populate the Bonus Skill dropdown with all known skills.  This list
  // includes every Standard skill and every Professional skill from
  // every culture and career.  The select is sorted alphabetically and
  // provides an empty option.  When the selection changes the previous
  // bonus allocation is refunded and the new skill receives an
  // automatic allocation from the bonus pool (up to BONUS_SKILL_POINTS).
  function populateBonusSkillSelect() {
    const sel = $('bonusSkill');
    if (!sel) return;
    const skills = new Set(Object.keys(standardSkills));
    Object.values(cultures).forEach(c => {
      c.standard.forEach(s => skills.add(s));
      c.professional.forEach(s => skills.add(s));
    });
    Object.values(careers).forEach(c => {
      c.standard.forEach(s => skills.add(s));
      c.professional.forEach(s => skills.add(s));
    });
    const sorted = Array.from(skills).sort();
    sel.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— Select —';
    sel.appendChild(empty);
    sorted.forEach(skill => {
      const opt = document.createElement('option');
      opt.value = skill;
      opt.textContent = skill;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      const newSkill = sel.value || null;
      // Refund previous allocation
      if (selectedBonusSkill && character.skillAlloc[selectedBonusSkill]) {
        const alloc = character.skillAlloc[selectedBonusSkill];
        const spent = alloc.bonus;
        character.pools.bonus += spent;
        alloc.bonus = 0;
      }
      selectedBonusSkill = newSkill;
      if (newSkill) {
        if (!character.skillAlloc[newSkill]) {
          character.skillAlloc[newSkill] = { culture: 0, career: 0, bonus: 0 };
        }
        const alloc = character.skillAlloc[newSkill];
        const available = character.pools.bonus;
        const allocation = Math.min(BONUS_SKILL_POINTS, available);
        alloc.bonus += allocation;
        character.pools.bonus -= allocation;
      }
      updatePoolsDisplay();
      updateSkillTable();
      updateSummary();
    });
  }

  // Update the Age Info display and pools when the age category changes.
  function updateAgeInfo() {
    const ageSel = $('ageCat');
    const cat = ageSel.value;
    const data = ageCategories[cat];
    const info = `${data.bonus} bonus points, max increase ${data.max}% (typical age ${data.age})`;
    $('ageInfo').textContent = info;
    character.age = cat;
    // Reset bonus pool and allocations when age changes
    character.pools.bonus = data.bonus;
    updatePoolsDisplay();
    updateSkillTable();
  }

  // Update the social class and combat style options when culture changes.
  function updateCultureOptions() {
    const cultureSel = $('culture');
    const cultureKey = cultureSel.value;
    character.culture = cultureKey;
    const def = cultures[cultureKey];
    // Populate social class select based on random 1d100 result
    const roll = Math.floor(Math.random() * 100) + 1;
    let chosen = def.socialClasses[0];
    for (const cls of def.socialClasses) {
      if (roll >= cls.min && roll <= cls.max) {
        chosen = cls;
        break;
      }
    }
    character.socialClass = chosen.name;
    // Populate combat style select
    populateSelect($('combatStyle'), def.combatStyles.map(s => ({ value: s, label: s })));
    $('combatStyle').value = def.combatStyles[0];
    character.combatStyle = def.combatStyles[0];
    // Update culture pool: characters receive 100 points to distribute among
    // cultural standard skills and up to three selected professional skills.
    character.pools.culture = 100;
    updatePoolsDisplay();
    updateSkillTable();
    updateSummary();
    // Reset selected culture professional skills and render selectors
    selectedCultureProfs.clear();
    renderProfessionalSelectors();
  }

  // Update the career options when a career is selected.
  function updateCareerOptions() {
    const careerSel = $('career');
    const key = careerSel.value;
    character.career = key;
    const def = careers[key];
    // Set career pool to 100 points as per Mythras rules
    character.pools.career = 100;
    updatePoolsDisplay();
    updateSkillTable();
    updateSummary();
    // Reset selected career professional skills and render selectors
    selectedCareerProfs.clear();
    renderProfessionalSelectors();
  }

  // Normalize a skill name by stripping any parenthetical qualifier.
  // For example, "Craft (any)" and "Craft (Alchemy)" both normalise
  // to "Craft".  This allows the allocation logic to treat all
  // variations of a base skill as the same for the purposes of
  // determining whether culture or career points may be spent on it.
  function normalizeSkillName(name) {
    return name.replace(/\s*\(.*\)/, '').trim();
  }

  // Build the skills table based on selected culture, career and any
  // allocations.  Each skill shows its base value and editable fields
  // for culture, career and bonus allocations.  Remaining pool
  // counters are updated accordingly.
  function updateSkillTable() {
    const tableBody = $('skillsTableBody');
    tableBody.innerHTML = '';
    // Determine which skills should appear: all standard skills plus
    // selected culture and career skills.  We'll also include any
    // skills that the user has allocated points to already.
    const skillSet = new Set(Object.keys(standardSkills));
    const cul = cultures[character.culture];
    const car = careers[character.career];
    cul.standard.forEach(s => skillSet.add(s));
    cul.professional.forEach(s => skillSet.add(s));
    car.standard.forEach(s => skillSet.add(s));
    car.professional.forEach(s => skillSet.add(s));
    Object.keys(character.skillAlloc).forEach(s => skillSet.add(s));
    // Convert to sorted array
    const skills = Array.from(skillSet).sort();
    // Precompute allowed sets for culture and career pools.  Culture
    // points may be spent on culture standard skills and on the
    // user‑selected culture professional skills; career points may be
    // spent on career standard skills and on the selected career
    // professional skills.
    // Determine which base skills may receive culture or career points.  We
    // normalise all entries to their base name to match professional
    // selections such as "Craft (any)" against table rows like
    // "Craft (Primary)".  selectedCultureProfs and selectedCareerProfs
    // may contain fully qualified names such as "Craft (any)";
    // normalising both sides ensures consistent membership tests.
    const cultureAllowed = new Set([
      ...cul.standard.map(normalizeSkillName),
      ...Array.from(selectedCultureProfs).map(normalizeSkillName)
    ]);
    const careerAllowed = new Set([
      ...car.standard.map(normalizeSkillName),
      ...Array.from(selectedCareerProfs).map(normalizeSkillName)
    ]);
    skills.forEach(skill => {
      const tr = document.createElement('tr');
      // Determine if this skill is relevant to culture, career or bonus
      // Normalise the row skill name for membership tests
      const baseName = normalizeSkillName(skill);
      const isCultureSkill = cultureAllowed.has(baseName);
      const isCareerSkill = careerAllowed.has(baseName);
      const isBonusSelected = selectedBonusSkill && normalizeSkillName(selectedBonusSkill) === baseName;
      if (isCultureSkill || isCareerSkill || isBonusSelected) {
        tr.classList.add('skill-allowed');
      }
      // Name cell
      const nameTd = document.createElement('td');
      nameTd.textContent = skill;
      tr.appendChild(nameTd);
      // Base value cell with formula display
      const baseTd = document.createElement('td');
      const base = computeSkillBase(skill, character.attributes);
      const formula = skillFormulaStrings[skill] || '';
      baseTd.innerHTML = `<span>${pct(base)}</span>${formula ? `<br><small class="formula">${formula}</small>` : ''}`;
      tr.appendChild(baseTd);
      // Culture allocation
      const culTd = document.createElement('td');
      const culInput = document.createElement('input');
      culInput.type = 'number';
      culInput.min = 0;
      culInput.max = ageCategories[character.age].max;
      culInput.value = character.skillAlloc[skill]?.culture || 0;
      if (!isCultureSkill) {
        culInput.disabled = true;
        culInput.classList.add('disabled');
      }
      culInput.oninput = () => {
        let v = parseInt(culInput.value, 10) || 0;
        const maxAlloc = ageCategories[character.age].max;
        // Clamp to maximum but continue processing
        if (v > maxAlloc) {
          v = maxAlloc;
          culInput.value = maxAlloc;
        }
        if (!character.skillAlloc[skill]) character.skillAlloc[skill] = { culture: 0, career: 0, bonus: 0 };
        const diff = v - character.skillAlloc[skill].culture;
        if (character.pools.culture - diff < 0) {
          // Not enough points, revert input
          culInput.value = character.skillAlloc[skill].culture;
          return;
        }
        character.skillAlloc[skill].culture = v;
        character.pools.culture -= diff;
        updatePoolsDisplay();
        updateSummary();
        const total = base + v + (character.skillAlloc[skill].career) + (character.skillAlloc[skill].bonus);
        totalTd.textContent = pct(total);
      };
      culTd.appendChild(culInput);
      tr.appendChild(culTd);
      // Career allocation
      const carTd = document.createElement('td');
      const carInput = document.createElement('input');
      carInput.type = 'number';
      carInput.min = 0;
      carInput.max = ageCategories[character.age].max;
      carInput.value = character.skillAlloc[skill]?.career || 0;
      if (!isCareerSkill) {
        carInput.disabled = true;
        carInput.classList.add('disabled');
      }
      carInput.oninput = () => {
        let v = parseInt(carInput.value, 10) || 0;
        const maxAlloc = ageCategories[character.age].max;
        if (v > maxAlloc) {
          v = maxAlloc;
          carInput.value = maxAlloc;
        }
        if (!character.skillAlloc[skill]) character.skillAlloc[skill] = { culture: 0, career: 0, bonus: 0 };
        const diff = v - character.skillAlloc[skill].career;
        if (character.pools.career - diff < 0) {
          carInput.value = character.skillAlloc[skill].career;
          return;
        }
        character.skillAlloc[skill].career = v;
        character.pools.career -= diff;
        updatePoolsDisplay();
        updateSummary();
        const total = base + (character.skillAlloc[skill].culture) + v + (character.skillAlloc[skill].bonus);
        totalTd.textContent = pct(total);
      };
      carTd.appendChild(carInput);
      tr.appendChild(carTd);
      // Bonus allocation
      const bonusTd = document.createElement('td');
      const bonusInput = document.createElement('input');
      bonusInput.type = 'number';
      bonusInput.min = 0;
      bonusInput.max = ageCategories[character.age].max;
      bonusInput.value = character.skillAlloc[skill]?.bonus || 0;
      bonusInput.oninput = () => {
        let v = parseInt(bonusInput.value, 10) || 0;
        const maxAlloc = ageCategories[character.age].max;
        if (v > maxAlloc) {
          v = maxAlloc;
          bonusInput.value = maxAlloc;
        }
        if (!character.skillAlloc[skill]) character.skillAlloc[skill] = { culture: 0, career: 0, bonus: 0 };
        const diff = v - character.skillAlloc[skill].bonus;
        if (character.pools.bonus - diff < 0) {
          bonusInput.value = character.skillAlloc[skill].bonus;
          return;
        }
        character.skillAlloc[skill].bonus = v;
        character.pools.bonus -= diff;
        updatePoolsDisplay();
        updateSummary();
        const total = base + (character.skillAlloc[skill].culture) + (character.skillAlloc[skill].career) + v;
        totalTd.textContent = pct(total);
      };
      bonusTd.appendChild(bonusInput);
      tr.appendChild(bonusTd);
      // Total cell
      const totalTd = document.createElement('td');
      const total = base + (character.skillAlloc[skill]?.culture || 0) + (character.skillAlloc[skill]?.career || 0) + (character.skillAlloc[skill]?.bonus || 0);
      totalTd.textContent = pct(total);
      tr.appendChild(totalTd);
      tableBody.appendChild(tr);
    });
  }

  // Update the display of remaining pools.
  function updatePoolsDisplay() {
    $('culturePool').textContent = character.pools.culture;
    $('careerPool').textContent = character.pools.career;
    $('bonusPool').textContent = character.pools.bonus;
  }

  // Roll attributes using 3d6 for each attribute.  Updates the
  // character's attribute object and derived stats.
  function rollAttributes() {
    // Roll attributes following Mythras rules: roll 3d6 for STR, CON, DEX, POW,
    // CHA; roll 2d6+6 for SIZ and INT.  Results replace existing values.
    character.attributes.STR = rollDice(3, 6);
    character.attributes.CON = rollDice(3, 6);
    character.attributes.DEX = rollDice(3, 6);
    character.attributes.POW = rollDice(3, 6);
    character.attributes.CHA = rollDice(3, 6);
    character.attributes.SIZ = rollDice(2, 6) + 6;
    character.attributes.INT = rollDice(2, 6) + 6;
    updateAttributeInputs();
    updateDerivedDisplay();
    updateSkillTable();
    updateSummary();
  }

  // Update attribute input boxes to reflect current values.
  function updateAttributeInputs() {
    for (const key of Object.keys(character.attributes)) {
      const input = $(key);
      input.value = character.attributes[key];
    }
  }

  // When an attribute input changes, update state and recompute
  // dependent values.
  function attributeInputChanged(evt) {
    const key = evt.target.id;
    let newVal = parseInt(evt.target.value, 10) || 0;
    // Minimum and maximum values based on Mythras rules: most attributes
    // range from 3–18 but INT and SIZ have a minimum of 8 because
    // they are normally generated by 2d6+6.  Cap all values at 18.
    const min = (key === 'SIZ' || key === 'INT') ? 8 : 3;
    if (newVal < min) newVal = min;
    if (newVal > 18) newVal = 18;
    // If using point buy, enforce pool restrictions
    if ($('method').value === 'point') {
      // Compute tentative remaining after this change
      const oldVal = character.attributes[key];
      character.attributes[key] = newVal;
      updatePointPoolDisplay();
      if (character.pointPoolRemaining < 0) {
        // Not enough points: revert to old value
        character.attributes[key] = oldVal;
        evt.target.value = oldVal;
        updatePointPoolDisplay();
        return;
      } else {
        // Accept change
        evt.target.value = newVal;
      }
    } else {
      // Roll or manual method: accept new value
      character.attributes[key] = newVal;
      evt.target.value = newVal;
    }
    updateDerivedDisplay();
    updateSkillTable();
    updateSummary();
  }

  // Update the derived statistics display.
  function updateDerivedDisplay() {
    const a = character.attributes;
    const dm = damageModifier(a.STR + a.SIZ);
    const exp = experienceModifier(a.CHA);
    const heal = healingRate(a.CON);
    const luck = luckPoints(a.POW);
    const hp = hitPointsPerLocation(a.CON + a.SIZ);
    const init = Math.floor((a.DEX + a.INT) / 2);
    $('derived').innerHTML = `
      <div><strong>Damage Modifier:</strong> ${dm}</div>
      <div><strong>Experience Modifier:</strong> ${exp >= 0 ? '+' + exp : exp}</div>
      <div><strong>Healing Rate:</strong> ${heal}</div>
      <div><strong>Luck Points:</strong> ${luck}</div>
      <div><strong>Initiative:</strong> ${init}</div>
      <div><strong>Hit Points (per location):</strong> Head ${hp.head}, Chest ${hp.chest}, Abdomen ${hp.abdomen}, Arms ${hp.arm}, Legs ${hp.leg}</div>
    `;
  }

  // Roll starting silver based on culture and social class.  This
  // function looks up the culture's moneyDice and applies the social
  // class multiplier.  The result is displayed and stored on the
  // character.
  function rollStartingSilver() {
    const def = cultures[character.culture];
    const roll = rollMoney(def.moneyDice);
    const cls = def.socialClasses.find(c => c.name === character.socialClass) || def.socialClasses[0];
    const total = Math.floor(roll * cls.mult);
    character.money = total;
    $('silverDisplay').textContent = `${total} sp`;
    updateSummary();
  }

  // Update the summary section.  Displays basic character details and
  // lists the top 10 skills by total percentage.
  function updateSummary() {
    const sum = $('summaryContent');
    // Gather skill totals and filter those with any allocated points
    const allSkills = new Set(Object.keys(standardSkills));
    Object.values(cultures).forEach(c => {
      c.standard.forEach(s => allSkills.add(s));
      c.professional.forEach(s => allSkills.add(s));
    });
    Object.values(careers).forEach(c => {
      c.standard.forEach(s => allSkills.add(s));
      c.professional.forEach(s => allSkills.add(s));
    });
    const rows = [];
    allSkills.forEach(skill => {
      const base = computeSkillBase(skill, character.attributes);
      const alloc = character.skillAlloc[skill] || { culture:0, career:0, bonus:0 };
      const total = base + alloc.culture + alloc.career + alloc.bonus;
      if (alloc.culture + alloc.career + alloc.bonus > 0) {
        rows.push({ skill, total });
      }
    });
    rows.sort((a,b) => b.total - a.total);
    const skillListHtml = rows.map(r => `<li>${r.skill}: ${pct(r.total)}</li>`).join('');
    // Build summary sections
    const identity = `
      <h3>Identity</h3>
      <p><strong>Name:</strong> ${character.name || '(Unnamed)'}<br>
      <strong>Culture:</strong> ${cultures[character.culture].name}<br>
      <strong>Career:</strong> ${careers[character.career].name}<br>
      <strong>Age:</strong> ${character.age}<br>
      <strong>Social Class:</strong> ${character.socialClass || '-'}<br>
      <strong>Combat Style:</strong> ${character.combatStyle || '-'}<br>
      <strong>Silver:</strong> ${character.money} sp</p>`;
    const attribs = `
      <h3>Attributes</h3>
      <p>STR ${character.attributes.STR}, CON ${character.attributes.CON}, SIZ ${character.attributes.SIZ}, DEX ${character.attributes.DEX}, INT ${character.attributes.INT}, POW ${character.attributes.POW}, CHA ${character.attributes.CHA}</p>`;
    // Derived stats
    const a = character.attributes;
    const derivedHtml = `
      <h3>Derived</h3>
      <p>Damage Modifier: ${damageModifier(a.STR + a.SIZ)}<br>
      Experience Modifier: ${experienceModifier(a.CHA) >= 0 ? '+' + experienceModifier(a.CHA) : experienceModifier(a.CHA)}<br>
      Healing Rate: ${healingRate(a.CON)}<br>
      Luck Points: ${luckPoints(a.POW)}<br>
      Initiative: ${Math.floor((a.DEX + a.INT) / 2)}<br>
      Hit Points: Head ${hitPointsPerLocation(a.CON + a.SIZ).head}, Chest ${hitPointsPerLocation(a.CON + a.SIZ).chest}, Abdomen ${hitPointsPerLocation(a.CON + a.SIZ).abdomen}, Arms ${hitPointsPerLocation(a.CON + a.SIZ).arm}, Legs ${hitPointsPerLocation(a.CON + a.SIZ).leg}</p>`;
    const skillsHtml = `
      <h3>Notable Skills</h3>
      <ul>${skillListHtml || '<li>(no allocations yet)</li>'}</ul>`;
    const equipHtml = `
      <h3>Equipment</h3>
      <p>${character.equipment.length > 0 ? character.equipment.join(', ') : '(none)'}</p>`;
    sum.innerHTML = identity + attribs + derivedHtml + skillsHtml + equipHtml;
  }

  /* ----------------------------------------------------------------------
   * Initialisation
   */
  function init() {
    // Populate selects for age, culture, career
    populateSelect($('ageCat'), Object.entries(ageCategories).map(([k,v]) => ({ value: k, label: k })));
    populateSelect($('culture'), Object.keys(cultures).map(k => ({ value: k, label: cultures[k].name })));
    populateSelect($('career'), Object.keys(careers).map(k => ({ value: k, label: careers[k].name })));
    // Attach event listeners
    $('ageCat').addEventListener('change', updateAgeInfo);
    $('culture').addEventListener('change', updateCultureOptions);
    $('career').addEventListener('change', updateCareerOptions);
    $('nameInput').addEventListener('input', e => { character.name = e.target.value; updateSummary(); });
    $('combatStyle').addEventListener('change', e => { character.combatStyle = e.target.value; updateSummary(); });
    $('rollAttrBtn').addEventListener('click', rollAttributes);
    $('rollSilverBtn').addEventListener('click', rollStartingSilver);
    // Attribute inputs
    ['STR','CON','SIZ','DEX','INT','POW','CHA'].forEach(key => {
      $(key).addEventListener('input', attributeInputChanged);
    });

    // Generation method selector
    $('method').addEventListener('change', methodChanged);
    // Populate the bonus skill select and attach its handler
    populateBonusSkillSelect();
    // Navigation buttons
    document.querySelectorAll('.navbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.navbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('section').forEach(sec => sec.classList.remove('active'));
        $(btn.dataset.target).classList.add('active');
      });
    });
    // Initialise default selections
    $('ageCat').value = character.age;
    $('culture').value = character.culture;
    $('career').value = character.career;
    updateCultureOptions();
    updateCareerOptions();
    updateAgeInfo();
    updateAttributeInputs();
    updateDerivedDisplay();
    updateSkillTable();
    updatePoolsDisplay();
    updateSummary();

    // Apply initial method settings (roll vs point buy)
    methodChanged();

    // Populate equipment list once with purchase buttons
    const eqList = $('equipmentList');
    eqList.innerHTML = '';
    Object.keys(equipment).forEach(cat => {
      const wrapper = document.createElement('div');
      wrapper.className = 'equipment-category';
      const header = document.createElement('h3');
      header.textContent = cat;
      wrapper.appendChild(header);
      const ul = document.createElement('ul');
      equipment[cat].forEach(item => {
        const li = document.createElement('li');
        // Display item name and cost
        const label = document.createElement('span');
        label.textContent = `${item.name} — ${item.cost} sp`;
        li.appendChild(label);
        // Purchase button
        const btn = document.createElement('button');
        btn.textContent = 'Buy';
        btn.style.marginLeft = '0.5rem';
        btn.addEventListener('click', () => {
          if (character.money < item.cost) {
            alert('Not enough silver to purchase this item.');
            return;
          }
          character.money -= item.cost;
          $('silverDisplay').textContent = `${character.money} sp`;
          character.equipment.push(item.name);
          // Append to purchased items list
          const li2 = document.createElement('li');
          li2.textContent = item.name;
          $('purchasedList').appendChild(li2);
          updateSummary();
        });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      wrapper.appendChild(ul);
      eqList.appendChild(wrapper);
    });
  }

  // Start when DOM is ready
  document.addEventListener('DOMContentLoaded', init);
})();