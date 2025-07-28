/*
  Mythras character generator logic

  This script drives the behaviour of the Mythras character creation form.
  It defines all of the rules necessary to create a compliant character
  including characteristic generation (dice or point buy), skill
  allocation with pools constrained by culture, career and age, derivation
  of secondary statistics, generation of starting money based on
  culture and social class, and export functions for a variety of
  formats.  Wherever possible the rules have been drawn from the
  Mythras System Reference Document【394499632944594†L895-L910】 and the age table【394499632944594†L895-L904】.
*/

(function() {
  'use strict';

  // Age categories with bonus skill pools and per‑skill caps.  The
  // random age ranges are recorded for completeness but are not used in
  // calculations.
  const ageCategories = {
    Young:  { bonus: 100, max: 10, age: '10+1d6' },
    Adult:  { bonus: 150, max: 15, age: '15+2d6' },
    Middle: { bonus: 200, max: 20, age: '25+3d6' },
    Senior: { bonus: 250, max: 25, age: '40+4d6' },
    Old:    { bonus: 300, max: 30, age: '60+5d6' }
  };

  // Social class definitions per culture.  Each culture has its own
  // hierarchy of social classes drawn from the Mythras rulebook.  The
  // multiplier influences the amount of starting silver a character
  // receives when rolling equipment.  These lists were distilled
  // from the Culture & Community chapter: barbarian societies tend to
  // differentiate between slaves, freemen, warriors and nobles; civilised
  // cultures include slaves, peasants, townsfolk, merchants and nobles;
  // nomadic tribes distinguish slaves, herdsmen, horsemen and chieftains;
  // primitive societies recognise outcasts, hunters, shamans and chiefs.
  const socialClassesByCulture = {
    Barbarian: [
      { name: 'Slave', multiplier: 0.5 },
      { name: 'Freeman', multiplier: 1 },
      { name: 'Warrior', multiplier: 1.5 },
      { name: 'Noble', multiplier: 2 }
    ],
    Civilized: [
      { name: 'Slave', multiplier: 0.5 },
      { name: 'Peasant', multiplier: 1 },
      { name: 'Townsman', multiplier: 1.5 },
      { name: 'Merchant', multiplier: 2 },
      { name: 'Noble', multiplier: 3 }
    ],
    Nomadic: [
      { name: 'Slave', multiplier: 0.5 },
      { name: 'Herdsman', multiplier: 1 },
      { name: 'Horseman', multiplier: 1.5 },
      { name: 'Chieftain', multiplier: 2 }
    ],
    Primitive: [
      { name: 'Outcast', multiplier: 0.5 },
      { name: 'Hunter', multiplier: 1 },
      { name: 'Shaman', multiplier: 1.5 },
      { name: 'Chief', multiplier: 2 }
    ]
  };

  // Available combat styles.  Mythras allows combat styles to be
  // defined by the setting; here is a representative list of
  // fighting styles drawn from common medieval weapon sets.  The
  // selected style is purely descriptive but may be exported.
  const combatStyles = [
    'Sword & Shield',
    'Two‑Handed Weapon',
    'Spear & Shield',
    'Bow & Spear',
    'Dual Wield',
    'Unarmed',
    'Mounted Combat',
    'Crossbow & Dagger',
    'Great Axe',
    'Staff & Sling'
  ];

  // Equipment definitions grouped by category.  Costs are in
  // silver pieces (sp) and are drawn from typical medieval gear.
  const equipmentCategories = {
    Weapons: [
      { name: 'Dagger', cost: 20 },
      { name: 'Short Sword', cost: 50 },
      { name: 'Long Sword', cost: 60 },
      { name: 'Axe', cost: 40 },
      { name: 'Spear', cost: 30 },
      { name: 'Bow and 20 Arrows', cost: 80 },
      { name: 'Crossbow and 20 Bolts', cost: 100 }
    ],
    Armour: [
      { name: 'Leather Armour', cost: 100 },
      { name: 'Studded Leather', cost: 150 },
      { name: 'Chain Shirt', cost: 300 },
      { name: 'Chain Mail', cost: 500 },
      { name: 'Shield', cost: 40 }
    ],
    Tools: [
      { name: 'Backpack', cost: 10 },
      { name: 'Bedroll', cost: 5 },
      { name: 'Lantern', cost: 15 },
      { name: 'Rope (50 ft)', cost: 10 },
      { name: 'Waterskin', cost: 5 }
    ],
    Provisions: [
      { name: 'Rations (1 week)', cost: 10 },
      { name: 'Wine (jug)', cost: 8 },
      { name: 'Ale (jug)', cost: 6 },
      { name: 'Spices', cost: 4 }
    ],
    Misc: [
      { name: 'Flint & Steel', cost: 2 },
      { name: 'Blank Parchment (10 sheets)', cost: 3 },
      { name: 'Ink & Quill', cost: 5 },
      { name: 'Small Mirror', cost: 12 },
      { name: 'Holy Symbol', cost: 15 }
    ]
  };

  // Base formulae for all standard skills【394499632944594†L613-L641】.  Each function
  // accepts the character's attribute set and returns the base
  // percentage for that skill.  Customs and Native Tongue receive
  // automatic bonuses of +40% as per the rules【394499632944594†L639-L640】.
  const standardSkillFormulas = {
    'Athletics':     a => a.STR + a.DEX,
    'Boating':       a => a.STR + a.CON,
    'Brawn':         a => a.STR + a.SIZ,
    'Conceal':       a => a.DEX + a.POW,
    'Customs':       a => a.INT * 2 + 40,
    'Dance':         a => a.DEX + a.CHA,
    'Deceit':        a => a.INT + a.CHA,
    'Drive':         a => a.DEX + a.POW,
    'Endurance':     a => a.CON * 2,
    'Evade':         a => a.DEX * 2,
    'First Aid':     a => a.INT + a.DEX,
    'Influence':     a => a.CHA * 2,
    'Insight':       a => a.INT + a.POW,
    'Locale':        a => a.INT * 2,
    'Native Tongue': a => a.INT + a.CHA + 40,
    'Perception':    a => a.INT + a.POW,
    'Ride':          a => a.DEX + a.POW,
    'Sing':          a => a.CHA + a.POW,
    'Stealth':       a => a.DEX + a.INT,
    'Swim':          a => a.STR + a.CON,
    'Unarmed':       a => a.STR + a.DEX,
    'Willpower':     a => a.POW * 2,
    // Treat Combat Style as a standard skill with base STR+DEX【394499632944594†L607-L612】.
    'Combat Style': a => a.STR + a.DEX
  };

  // Professional skills.  Any skill listed here that does not exist in
  // standardSkillFormulas will receive a base of 0.  The list is
  // compiled from the cultures and careers defined below.
  const professionalSkills = [
    'Art', 'Commerce', 'Craft', 'Courtesy', 'Language', 'Lore',
    'Musicianship', 'Streetwise', 'Culture', 'Disguise', 'Sleight',
    'Survival', 'Track', 'Healing', 'Teach', 'Bureaucracy',
    'Linguistics', 'Gambling', 'Seduction', 'Engineering',
    'Mechanisms', 'Research', 'Acrobatics', 'Acting', 'Oratory',
    'Navigation', 'Seamanship', 'Electronics', 'Magic', 'Literacy',
    'Pilot', 'Sensors', 'Politics', 'Customs', 'Animal Husbandry'
  ];

  // Cultural definitions taken from the SRD【394499632944594†L660-L679】【394499632944594†L695-L699】【394499632944594†L714-L719】【394499632944594†L735-L741】.  Each culture
  // lists the standard skills available to it and the professional
  // skills from which the player may select up to three.
  const cultures = {
    Barbarian: {
      standard: ['Athletics','Brawn','Endurance','First Aid','Locale','Perception','Boating','Ride','Combat Style'],
      professional: ['Craft','Healing','Lore','Musicianship','Navigation','Seamanship','Survival','Track']
    },
    Civilized: {
      standard: ['Conceal','Deceit','Drive','Influence','Insight','Locale','Willpower','Combat Style'],
      professional: ['Art','Commerce','Craft','Courtesy','Language','Lore','Musicianship','Streetwise']
    },
    Nomadic: {
      standard: ['Endurance','First Aid','Locale','Perception','Stealth','Athletics','Boating','Swim','Drive','Ride','Combat Style'],
      professional: ['Craft','Culture','Language','Lore','Musicianship','Navigation','Survival','Track']
    },
    Primitive: {
      standard: ['Brawn','Endurance','Evade','Locale','Perception','Stealth','Athletics','Boating','Swim','Combat Style'],
      professional: ['Craft','Healing','Lore','Musicianship','Navigation','Survival','Track']
    }
  };

  // Career definitions drawn from the SRD careers table【394499632944594†L761-L835】.
  // Each career lists its standard skills and professional skills.  Only
  // a representative sample of the available careers has been
  // implemented here; additional careers may be added by extending
  // this object.
  const careers = {
    Agent: {
      standard: ['Conceal','Deceit','Evade','Insight','Perception','Stealth','Combat Style'],
      professional: ['Culture','Disguise','Language','Sleight','Streetwise','Survival','Track']
    },
    'Beast Handler': {
      standard: ['Drive','Endurance','First Aid','Influence','Locale','Ride','Willpower'],
      professional: ['Craft','Commerce','Healing','Lore','Survival','Teach','Track']
    },
    'Bounty Hunter': {
      standard: ['Athletics','Endurance','Evade','Insight','Perception','Stealth','Combat Style'],
      professional: ['Bureaucracy','Commerce','Culture','Linguistics','Streetwise','Survival','Track']
    },
    Courtesan: {
      standard: ['Customs','Dance','Deceit','Influence','Insight','Perception','Sing'],
      professional: ['Art','Courtesy','Culture','Gambling','Language','Musicianship','Seduction']
    },
    Crafter: {
      standard: ['Brawn','Drive','Influence','Insight','Locale','Perception','Willpower'],
      professional: ['Art','Commerce','Craft','Engineering','Mechanisms','Streetwise']
    },
    Detective: {
      standard: ['Customs','Evade','Influence','Insight','Perception','Stealth','Combat Style'],
      professional: ['Bureaucracy','Culture','Disguise','Linguistics','Lore','Research','Sleight','Streetwise']
    },
    Entertainer: {
      standard: ['Athletics','Brawn','Dance','Deceit','Influence','Insight','Sing'],
      professional: ['Acrobatics','Acting','Oratory','Musicianship','Seduction','Sleight','Streetwise']
    },
    Farmer: {
      standard: ['Athletics','Brawn','Drive','Endurance','Locale','Perception','Ride'],
      professional: ['Commerce','Craft','Lore','Navigation','Survival','Track']
    },
    Fisher: {
      standard: ['Athletics','Boating','Endurance','Locale','Perception','Stealth','Swim'],
      professional: ['Commerce','Craft','Lore','Navigation','Seamanship','Survival']
    },
    Gambler: {
      standard: ['Athletics','Brawn','Endurance','Locale','Perception','Willpower','Drive','Ride'],
      professional: ['Acting','Bureaucracy','Commerce','Courtesy','Gambling','Research','Sleight','Streetwise']
    },
    Herder: {
      standard: ['Endurance','First Aid','Insight','Locale','Perception','Ride','Combat Style'],
      professional: ['Commerce','Craft','Healing','Navigation','Musicianship','Survival','Track']
    },
    Hunter: {
      standard: ['Athletics','Endurance','Locale','Perception','Ride','Stealth','Combat Style'],
      professional: ['Commerce','Craft','Lore','Mechanisms','Navigation','Survival','Track']
    },
    Journalist: {
      standard: ['Customs','Deceit','Influence','Insight','Locale','Native Tongue','Perception'],
      professional: ['Bureaucracy','Culture','Language','Lore','Oratory','Politics','Streetwise']
    },
    Magician: {
      standard: ['Customs','Deceit','Influence','Insight','Locale','Perception','Willpower'],
      professional: ['Culture','Magic','Literacy','Lore','Oratory','Sleight']
    },
    Mechanic: {
      standard: ['Brawn','Culture','Drive','Endurance','Influence','Locale','Willpower'],
      professional: ['Commerce','Craft','Electronics','Gambling','Mechanisms','Streetwise']
    },
    Merchant: {
      standard: ['Boating','Drive','Deceit','Insight','Influence','Locale','Ride'],
      professional: ['Commerce','Courtesy','Culture','Language','Navigation','Seamanship','Streetwise']
    },
    Miner: {
      standard: ['Athletics','Brawn','Endurance','Locale','Perception','Sing','Willpower'],
      professional: ['Commerce','Craft','Engineering','Lore','Mechanisms','Navigation','Survival']
    },
    Official: {
      standard: ['Customs','Deceit','Influence','Insight','Locale','Perception','Willpower'],
      professional: ['Bureaucracy','Commerce','Courtesy','Language','Literacy','Lore','Oratory']
    },
    Physician: {
      standard: ['Dance','First Aid','Influence','Insight','Locale','Sing','Willpower'],
      professional: ['Commerce','Craft','Healing','Language','Literacy','Lore','Streetwise']
    },
    Pilot: {
      standard: ['Brawn','Drive','Endurance','Evade','Locale','Perception','Willpower'],
      professional: ['Customs','Electronics','Mechanisms','Navigation','Pilot','Sensors','Streetwise']
    },
    Politician: {
      standard: ['Customs','Deceit','Influence','Insight','Locale','Native Tongue','Perception'],
      professional: ['Bureaucracy','Courtesy','Culture','Language','Lore','Oratory','Politics']
    },
    Priest: {
      standard: ['Customs','Dance','Deceit','Influence','Insight','Locale','Willpower'],
      professional: ['Bureaucracy','Courtesy','Customs','Literacy','Lore','Oratory','Politics']
    }
  };

  // A helper to merge the sets of all skill names used across
  // standard and professional lists.  This ensures that every row in
  // the skills table exists regardless of the chosen culture/career.
  function buildSkillList() {
    const names = new Set(Object.keys(standardSkillFormulas));
    professionalSkills.forEach(n => names.add(n));
    // Also include professional skills embedded in culture and career definitions
    Object.values(cultures).forEach(c => {
      c.professional.forEach(p => names.add(p));
    });
    Object.values(careers).forEach(c => {
      c.professional.forEach(p => names.add(p));
    });
    return Array.from(names).sort();
  }

  const allSkills = buildSkillList();

  // The character object stores all decisions made so far.
  const character = {
    name: '',
    ageCat: 'Adult',
    culture: 'Barbarian',
    career: 'Agent',
    socialClass: 'Middle',
    attributes: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
    pool: 75,
    skillPools: { culture: 100, career: 100, bonus: ageCategories['Adult'].bonus },
    skillCaps: { culture: 15, career: 15, bonus: ageCategories['Adult'].max },
    skillAllocations: {}
    ,
    // Selected professional skills for culture and career.  These
    // arrays hold the names of professional skills the player has
    // chosen to specialise in.  Only these will accept allocations
    // from the corresponding pools.
    selectedCulturePro: [],
    selectedCareerPro: [],
    // The chosen combat style.  Defaults to the first entry in
    // combatStyles but can be changed via the UI.
    combatStyle: combatStyles[0]
    ,
    // A single bonus professional skill chosen by the player.  This
    // skill acts as an additional hobby specialisation and may
    // receive bonus points even if it is not part of the culture or
    // career lists.  Empty string when none selected.
    bonusSkill: ''
    ,
    // Equipment selected by the player.  This will be populated
    // when purchasing items in the equipment step.  Each entry is
    // an object with name and cost.
    equipment: []
  };

  // Initialise skill allocations to zeros for all skills.
  allSkills.forEach(s => {
    character.skillAllocations[s] = { culture: 0, career: 0, bonus: 0 };
  });

  // Cache DOM elements for efficiency
  const navButtons = document.querySelectorAll('.navbtn');
  const sections = document.querySelectorAll('section');
  const ageSelect = document.getElementById('ageCat');
  const ageInfo = document.getElementById('ageInfo');
  const cultureSelect = document.getElementById('culture');
  const careerSelect = document.getElementById('career');
  const socialSelect = document.getElementById('socialClass');
  const nameInput = document.getElementById('name');
  const methodSelect = document.getElementById('method');
  const pointPoolInfo = document.getElementById('pointPoolInfo');
  const attributesInputsContainer = document.getElementById('attributesInputs');
  const derivedDiv = document.getElementById('derivedAttributes');
  const skillsTableBody = document.querySelector('#skillsTable tbody');
  const cultureRemainingSpan = document.getElementById('cultureRemaining');
  const careerRemainingSpan = document.getElementById('careerRemaining');
  const bonusRemainingSpan = document.getElementById('bonusRemaining');
  const rollSilverBtn = document.getElementById('rollSilver');
  const silverDisplay = document.getElementById('silverAmount');
  const exportExcelBtn = document.getElementById('exportExcel');
  const exportPDFBtn = document.getElementById('exportPDF');
  const exportMarkdownBtn = document.getElementById('exportMarkdown');
  const exportJSONBtn = document.getElementById('exportJSON');

  // Elements for professional skills and combat style selection
  const cultureProOptionsDiv = document.getElementById('cultureProOptions');
  const careerProOptionsDiv = document.getElementById('careerProOptions');
  const combatStyleSelect = document.getElementById('combatStyleSelect');
  // Input for adjusting point buy pool
  const poolSizeInput = document.getElementById('poolSize');

  // Bonus skill select element
  const bonusSkillSelect = document.getElementById('bonusSkillSelect');

  // Elements for equipment selection
  const equipmentListDiv = document.getElementById('equipmentList');
  const remainingSilverSpan = document.getElementById('remainingSilver');

  /**
   * Populate the dropdown selectors for age, culture and career.
   */
  function populateSelects() {
    // Age categories
    Object.keys(ageCategories).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      if (k === character.ageCat) opt.selected = true;
      ageSelect.appendChild(opt);
    });
    updateAgeInfo();
    // Cultures
    Object.keys(cultures).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      if (k === character.culture) opt.selected = true;
      cultureSelect.appendChild(opt);
    });
    // Careers
    Object.keys(careers).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      if (k === character.career) opt.selected = true;
      careerSelect.appendChild(opt);
    });
    // Social classes are loaded based upon the selected culture; this
    // call initialises the social class select with the default
    // culture's options.  It is refreshed when the culture is
    // changed by the user.
    populateSocialClassSelect();
  }

  /**
   * Populate the social class selector based on the currently
   * selected culture.  Each entry includes the class name and a
   * multiplier used to determine starting silver.  If the previous
   * social class remains valid under the new culture it is
   * preserved; otherwise the first option is selected.
   */
  function populateSocialClassSelect() {
    if (!socialSelect) return;
    const classes = socialClassesByCulture[character.culture] || [];
    const previous = character.socialClass;
    socialSelect.innerHTML = '';
    classes.forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc.name;
      opt.textContent = sc.name;
      socialSelect.appendChild(opt);
    });
    // Retain previous class if still available
    const match = classes.find(sc => sc.name === previous);
    if (match) {
      socialSelect.value = previous;
    } else if (classes.length > 0) {
      socialSelect.value = classes[0].name;
      character.socialClass = classes[0].name;
    }
  }

  /**
   * Update the descriptive text next to the age category selector.
   */
  function updateAgeInfo() {
    const cat = ageCategories[character.ageCat];
    ageInfo.textContent = `Bonus Points: ${cat.bonus}, Max increase: +${cat.max}% (typical age ${cat.age})`;
  }

  /**
   * Populate the combat style select list with predefined styles.  The
   * current selection is preserved if possible.
   */
  function populateCombatStyleSelect() {
    combatStyleSelect.innerHTML = '';
    combatStyles.forEach(style => {
      const opt = document.createElement('option');
      opt.value = style;
      opt.textContent = style;
      if (style === character.combatStyle) opt.selected = true;
      combatStyleSelect.appendChild(opt);
    });
  }

  /**
   * Populate the bonus skill select box.  This presents a list of
   * professional skills not tied to the chosen culture or career and
   * allows the player to choose one as a hobby skill.  Professional
   * skills already selected via culture or career are excluded to
   * avoid duplication.  If the previously selected bonus skill is
   * still valid it remains selected.
   */
  function populateBonusSkillSelect() {
    if (!bonusSkillSelect) return;
    // Determine which professional skills are eligible.  Exclude
    // standard skills and those already selected in culture or
    // career lists.
    const excluded = new Set();
    // Exclude all standard skills
    Object.keys(standardSkillFormulas).forEach(s => excluded.add(s));
    // Exclude culture and career professional skills
    const culturePros = cultures[character.culture].professional;
    const careerPros = careers[character.career].professional;
    culturePros.forEach(s => excluded.add(s));
    careerPros.forEach(s => excluded.add(s));
    // Exclude any currently selected culture/career professional
    character.selectedCulturePro.forEach(s => excluded.add(s));
    character.selectedCareerPro.forEach(s => excluded.add(s));
    // Build list of options from remaining professional skills
    const options = professionalSkills.filter(s => !excluded.has(s));
    bonusSkillSelect.innerHTML = '';
    // Add a blank option for none
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None';
    bonusSkillSelect.appendChild(noneOpt);
    options.forEach(skill => {
      const opt = document.createElement('option');
      opt.value = skill;
      opt.textContent = skill;
      bonusSkillSelect.appendChild(opt);
    });
    // Restore previous selection if still valid
    if (character.bonusSkill && !excluded.has(character.bonusSkill)) {
      bonusSkillSelect.value = character.bonusSkill;
    } else {
      bonusSkillSelect.value = '';
      character.bonusSkill = '';
    }
  }

  /**
   * Populate the professional skill option lists for culture and career.
   * Only the professional skills defined for the selected culture and
   * career are shown.  The character may select up to three from each
   * list.  If fewer than three are currently selected, the first
   * available skills are chosen as defaults.
   */
  function populateProfessionalOptions() {
    if (!cultureProOptionsDiv || !careerProOptionsDiv) return;
    cultureProOptionsDiv.innerHTML = '';
    careerProOptionsDiv.innerHTML = '';
    const cList = cultures[character.culture].professional;
    const crList = careers[character.career].professional;
    // Filter out any selections that are no longer valid
    character.selectedCulturePro = character.selectedCulturePro.filter(s => cList.includes(s));
    character.selectedCareerPro = character.selectedCareerPro.filter(s => crList.includes(s));
    // Auto‑select up to three if none selected
    if (character.selectedCulturePro.length === 0 && cList.length > 0) {
      character.selectedCulturePro = cList.slice(0, Math.min(3, cList.length));
    }
    if (character.selectedCareerPro.length === 0 && crList.length > 0) {
      character.selectedCareerPro = crList.slice(0, Math.min(3, crList.length));
    }
    // Build culture professional checkboxes
    cList.forEach(skill => {
      const id = `cpro_${skill.replace(/\s+/g,'_')}`;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = skill;
      input.id = id;
      if (character.selectedCulturePro.includes(skill)) input.checked = true;
      input.addEventListener('change', () => onProfessionalSelectionChange('culture', skill, input.checked));
      label.appendChild(input);
      label.appendChild(document.createTextNode(skill));
      cultureProOptionsDiv.appendChild(label);
    });
    // Build career professional checkboxes
    crList.forEach(skill => {
      const id = `crpro_${skill.replace(/\s+/g,'_')}`;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = skill;
      input.id = id;
      if (character.selectedCareerPro.includes(skill)) input.checked = true;
      input.addEventListener('change', () => onProfessionalSelectionChange('career', skill, input.checked));
      label.appendChild(input);
      label.appendChild(document.createTextNode(skill));
      careerProOptionsDiv.appendChild(label);
    });
    // After repopulating, update skill inputs enabled state and pools
    updateSkillInputsEnabled();
    updateSkillPoolsDisplay();
    updateSkillTotals();

    // Bonus skill list may have changed as professional selections modify excluded skills
    populateBonusSkillSelect();
  }

  /**
   * Handle selection and deselection of professional skills.  Enforces
   * the maximum of three skills per list and resets allocations for
   * skills that are deselected.  Type indicates which list (culture
   * or career) is being modified.
   */
  function onProfessionalSelectionChange(type, skill, checked) {
    const arr = type === 'culture' ? character.selectedCulturePro : character.selectedCareerPro;
    if (checked) {
      // Only add if not already present and below limit
      if (!arr.includes(skill)) {
        if (arr.length < 3) {
          arr.push(skill);
        } else {
          // Too many selections: revert the checkbox and exit
          const container = type === 'culture' ? cultureProOptionsDiv : careerProOptionsDiv;
          const box = container.querySelector(`input[value="${skill.replace(/"/g,'\\"')}"]`);
          if (box) box.checked = false;
          return;
        }
      }
    } else {
      const idx = arr.indexOf(skill);
      if (idx >= 0) arr.splice(idx,1);
    }
    // Reset allocations for deselected professional skills
    allSkills.forEach(s => {
      if (type === 'culture') {
        if (cultures[character.culture].professional.includes(s) && !character.selectedCulturePro.includes(s)) {
          character.skillAllocations[s].culture = 0;
        }
      } else {
        if (careers[character.career].professional.includes(s) && !character.selectedCareerPro.includes(s)) {
          character.skillAllocations[s].career = 0;
        }
      }
    });
    updateSkillInputsEnabled();
    updateSkillPoolsDisplay();
    updateSkillTotals();
    // After changing professional skills the table and summary need
    // rebuilding to reflect which skills are visible and which are
    // available for allocation.
    buildSkillsTable();
    renderCharacterSummary();
  }

  /**
   * Build attribute inputs based on the current character data.  Each
   * attribute can be rolled or point bought.  Listeners on these
   * inputs update the character and recompute derived attributes and
   * skill bases.
   */
  function buildAttributeInputs() {
    attributesInputsContainer.innerHTML = '';
    const attrs = ['STR','CON','SIZ','DEX','INT','POW','CHA'];
    attrs.forEach(key => {
      const wrapper = document.createElement('div');
      wrapper.className = 'attr';
      const label = document.createElement('label');
      label.textContent = key;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = 3;
      input.max = 21;
      input.step = 1;
      input.value = character.attributes[key];
      input.dataset.attr = key;
      input.addEventListener('input', () => {
        let val = parseInt(input.value, 10);
        if (isNaN(val)) val = 3;
        val = Math.min(Math.max(val, 3), 21);
        character.attributes[key] = val;
        input.value = val;
        updatePointPoolInfo();
        updateDerived();
        updateSkillBases();
      });
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      attributesInputsContainer.appendChild(wrapper);
    });
    updatePointPoolInfo();
  }

  /**
   * Update the remaining attribute pool display when using point buy.
   */
  function updatePointPoolInfo() {
    if (methodSelect.value === 'point') {
      const sum = Object.values(character.attributes).reduce((a,b) => a + b, 0);
      const remaining = character.pool - sum;
      pointPoolInfo.textContent = `Remaining pool: ${remaining}`;
      pointPoolInfo.style.display = 'inline';
    } else {
      pointPoolInfo.style.display = 'none';
    }
  }

  /**
   * Roll 3d6 for each attribute and update the inputs accordingly.
   */
  function rollAttributes() {
    ['STR','CON','SIZ','DEX','INT','POW','CHA'].forEach(key => {
      const total = rollDice(3,6);
      character.attributes[key] = total;
    });
    // Rebuild inputs to reflect new values
    buildAttributeInputs();
    updateDerived();
    updateSkillBases();
  }

  /**
   * Roll n dice with s sides.  Returns the sum.
   */
  function rollDice(n, s) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += Math.floor(Math.random() * s) + 1;
    }
    return total;
  }

  /**
   * Compute derived attributes based on current characteristics and
   * render them in the derived div.
   */
  function updateDerived() {
    const a = character.attributes;
    // Damage modifier
    const dm = damageModifier(a.STR + a.SIZ);
    const exp = experienceModifier(a.CHA);
    const heal = healingRate(a.CON);
    const luck = luckPoints(a.POW);
    const hp = hitPointsPerLocation(a.CON + a.SIZ);
    const init = Math.floor((a.DEX + a.INT) / 2);
    const derivedLines = [
      `<strong>Damage Modifier:</strong> ${dm}`,
      `<strong>Experience Modifier:</strong> ${exp >= 0 ? '+' + exp : exp}`,
      `<strong>Healing Rate:</strong> ${heal}`,
      `<strong>Luck Points:</strong> ${luck}`,
      `<strong>Initiative:</strong> ${init}`,
      `<strong>Hit Points (per location):</strong> Head ${hp.head}, Chest ${hp.chest}, Abdomen ${hp.abdomen}, Arms ${hp.arm}, Legs ${hp.leg}`
    ];
    derivedDiv.innerHTML = derivedLines.map(l => `<div>${l}</div>`).join('');

    // Refresh the character summary whenever derived attributes change
    renderCharacterSummary();
  }

  /**
   * Determine the damage modifier string given the total of STR+SIZ【394499632944594†L428-L448】.
   */
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
    // Above 120 continue adding +1d2 per extra 10
    const extra = Math.floor((total - 120) / 10);
    return `+2d10+${extra}d2`;
  }

  /**
   * Compute the experience modifier based on CHA【394499632944594†L466-L470】.
   */
  function experienceModifier(cha) {
    if (cha <= 6) return -1;
    if (cha <= 12) return 0;
    if (cha <= 18) return 1;
    // Each 6 points beyond 18 adds +1
    return 1 + Math.floor((cha - 13) / 6);
  }

  /**
   * Determine healing rate from CON【394499632944594†L481-L485】.
   */
  function healingRate(con) {
    if (con <= 6) return 1;
    if (con <= 12) return 2;
    if (con <= 18) return 3;
    return 3 + Math.floor((con - 13) / 6);
  }

  /**
   * Determine luck points from POW【394499632944594†L542-L546】.
   */
  function luckPoints(pow) {
    if (pow <= 6) return 1;
    if (pow <= 12) return 2;
    if (pow <= 18) return 3;
    return 3 + Math.floor((pow - 13) / 6);
  }

  /**
   * Compute hit points per location table【394499632944594†L502-L514】.
   */
  function hitPointsPerLocation(total) {
    // Determine the row index: 0 for 1–5, 1 for 6–10, etc.
    const idx = Math.min(Math.floor((total - 1) / 5), 7);
    // Base values per row for head, chest, abdomen, arm, leg
    const base = [
      { head: 1, chest: 3, abdomen: 2, arm: 1, leg: 1 },
      { head: 2, chest: 4, abdomen: 3, arm: 1, leg: 2 },
      { head: 3, chest: 5, abdomen: 4, arm: 2, leg: 3 },
      { head: 4, chest: 6, abdomen: 5, arm: 3, leg: 4 },
      { head: 5, chest: 7, abdomen: 6, arm: 4, leg: 5 },
      { head: 6, chest: 8, abdomen: 7, arm: 5, leg: 6 },
      { head: 7, chest: 9, abdomen: 8, arm: 6, leg: 7 },
      { head: 8, chest: 10, abdomen: 9, arm: 7, leg: 8 }
    ][idx];
    // For totals above 40, add +1 for each extra 5 points
    const extraGroups = Math.max(0, Math.floor((total - 40) / 5));
    return {
      head: base.head + extraGroups,
      chest: base.chest + extraGroups,
      abdomen: base.abdomen + extraGroups,
      arm: base.arm + extraGroups,
      leg: base.leg + extraGroups
    };
  }

  /**
   * Build the skills table.  This constructs rows for every skill in
   * allSkills and stores references to the input elements for later
   * updates.  It also sets whether culture and career inputs are
   * enabled based on the currently selected culture and career.
   */
  function buildSkillsTable() {
    skillsTableBody.innerHTML = '';
    const cultureDef = cultures[character.culture];
    const careerDef = careers[character.career];
    // Determine which skills are available for display.  All standard
    // skills are always shown.  Additionally include selected
    // professional skills, the bonus skill if chosen, and any skill
    // that has allocations.
    const available = new Set(Object.keys(standardSkillFormulas));
    // Selected professional skills
    character.selectedCulturePro.forEach(s => available.add(s));
    character.selectedCareerPro.forEach(s => available.add(s));
    // Bonus skill (if selected)
    if (character.bonusSkill) available.add(character.bonusSkill);
    // Skills with allocations
    Object.entries(character.skillAllocations).forEach(([skill, alloc]) => {
      if ((alloc.culture + alloc.career + alloc.bonus) > 0) {
        available.add(skill);
      }
    });
    // Build rows for each available skill
    allSkills.forEach(skill => {
      if (!available.has(skill)) return;
      const row = document.createElement('tr');
      row.className = 'skill-row';
      const nameCell = document.createElement('td');
      nameCell.textContent = skill;
      row.appendChild(nameCell);
      // Base value cell (rounded to integer, no decimals)
      const baseCell = document.createElement('td');
      baseCell.textContent = Math.round(computeBaseForSkill(skill));
      baseCell.dataset.skill = skill;
      row.appendChild(baseCell);
      // Culture, Career and Bonus inputs
      ['culture','career','bonus'].forEach(poolName => {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.step = 1;
        input.value = character.skillAllocations[skill][poolName];
        input.className = 'skill-input';
        input.dataset.skill = skill;
        input.dataset.pool = poolName;
        // Add a CSS class to visually distinguish enabled inputs; this
        // will be toggled by updateSkillInputsEnabled().
        input.classList.add('skill-input-field');
        cell.appendChild(input);
        row.appendChild(cell);
      });
      // Total cell (rounded to integer)
      const totalCell = document.createElement('td');
      totalCell.textContent = Math.round(computeTotalForSkill(skill));
      totalCell.dataset.skill = skill;
      row.appendChild(totalCell);
      skillsTableBody.appendChild(row);
    });
    // Attach input listeners after construction
    skillsTableBody.querySelectorAll('input.skill-input').forEach(input => {
      input.addEventListener('input', onSkillInputChange);
    });
    updateSkillPoolsDisplay();
    updateSkillInputsEnabled();
  }

  /**
   * Compute the total cost of all equipment currently selected.
   */
  function getEquipmentTotal() {
    return character.equipment.reduce((sum, item) => sum + item.cost, 0);
  }

  /**
   * Build the equipment list UI.  Items are grouped by category with
   * checkboxes allowing the user to purchase them.  Selecting an
   * item deducts its cost from the available silver; deselecting
   * refunds the cost.  If the user attempts to purchase an item
   * they cannot afford, the checkbox is immediately reverted.
   */
  function buildEquipmentList() {
    if (!equipmentListDiv) return;
    equipmentListDiv.innerHTML = '';
    Object.entries(equipmentCategories).forEach(([category, items]) => {
      const catDiv = document.createElement('div');
      catDiv.className = 'equipment-category';
      const heading = document.createElement('h4');
      heading.textContent = category;
      catDiv.appendChild(heading);
      items.forEach(item => {
        const label = document.createElement('label');
        label.className = 'equipment-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.name;
        // Check if the item is currently selected
        if (character.equipment.find(e => e.name === item.name)) {
          checkbox.checked = true;
        }
        checkbox.addEventListener('change', () => {
          onEquipmentToggle(item, checkbox.checked);
        });
        label.appendChild(checkbox);
        const text = document.createTextNode(`${item.name} (${item.cost} sp)`);
        label.appendChild(text);
        catDiv.appendChild(label);
      });
      equipmentListDiv.appendChild(catDiv);
    });
    updateRemainingSilver();
  }

  /**
   * Handle toggling of equipment items.  Adds or removes the item
   * from the character's equipment list and updates remaining
   * silver.  Prevents purchasing items beyond available silver.
   */
  function onEquipmentToggle(item, checked) {
    // Determine the current remaining silver
    const remaining = (character.startingSilver || 0) - getEquipmentTotal();
    if (checked) {
      // Attempt to purchase
      if (item.cost > remaining) {
        // Cannot afford; rebuild list to revert the checkbox
        buildEquipmentList();
        alert('Not enough silver to purchase this item.');
        return;
      }
      // Add if not already selected
      if (!character.equipment.find(e => e.name === item.name)) {
        character.equipment.push(item);
      }
    } else {
      // Remove
      character.equipment = character.equipment.filter(e => e.name !== item.name);
    }
    updateRemainingSilver();
    renderCharacterSummary();
  }

  /**
   * Update the displayed remaining silver based on selected equipment.
   */
  function updateRemainingSilver() {
    if (!remainingSilverSpan) return;
    const totalCost = getEquipmentTotal();
    const remaining = (character.startingSilver || 0) - totalCost;
    remainingSilverSpan.textContent = remaining >= 0 ? remaining : 0;
  }

  /**
   * Ensure that each of the selected culture's standard skills has at
   * least 5 culture points assigned.  This implements the rule that
   * culture points must allocate a minimum of 5% to each listed
   * standard skill.  Any skill that already has 5 or more culture
   * points remains unchanged.  This function should be called when
   * the culture changes and when initializing the skills table.
   */
  function applyCultureMinimums() {
    const cultureDef = cultures[character.culture];
    if (!cultureDef) return;
    cultureDef.standard.forEach(skill => {
      const alloc = character.skillAllocations[skill];
      if (alloc.culture < 5) {
        // Adjust the pool usage for this skill: we simply assign 5
        // points.  The pool remaining will account for this change when
        // updateSkillPoolsDisplay is called.
        alloc.culture = 5;
      }
    });
    // Update remaining points display and totals
    updateSkillPoolsDisplay();
    updateSkillTotals();
  }

  /**
   * Update whether the culture and career inputs are enabled for each
   * skill row.  A skill can only receive culture points if it is in
   * the selected culture's standard or professional list; likewise
   * career points require the skill to be in the chosen career's lists.
   * Bonus points may always be allocated to any skill.
   */
  function updateSkillInputsEnabled() {
    const cultureDef = cultures[character.culture];
    const careerDef = careers[character.career];
    skillsTableBody.querySelectorAll('input.skill-input').forEach(input => {
      const skill = input.dataset.skill;
      const pool = input.dataset.pool;
      if (pool === 'culture') {
        // Enable if the skill is a culture standard skill or a selected
        // professional skill
        const inStandard = cultureDef.standard.includes(skill);
        const inPro = cultureDef.professional.includes(skill) && character.selectedCulturePro.includes(skill);
        input.disabled = !(inStandard || inPro);
        // For culture standard skills enforce a minimum of 5 points
        if (!input.disabled && pool === 'culture' && inStandard) {
          input.min = 5;
        } else {
          input.min = 0;
        }
      } else if (pool === 'career') {
        const inStandard = careerDef.standard.includes(skill);
        const inPro = careerDef.professional.includes(skill) && character.selectedCareerPro.includes(skill);
        input.disabled = !(inStandard || inPro);
      } else {
        // bonus always allowed
        input.disabled = false;
        input.min = 0;
      }
      // Apply a class to distinguish enabled inputs for visual clarity
      if (input.disabled) {
        input.classList.remove('enabled');
      } else {
        input.classList.add('enabled');
      }
    });
  }

  /**
   * Compute the base value for a given skill using either the
   * associated formula or return 0 for professional skills not
   * represented in standardSkillFormulas.  If the skill is a
   * professional skill defined in the cultures table (like Craft or
   * Lore), it starts at 0% by default.
   */
  function computeBaseForSkill(skill) {
    const fn = standardSkillFormulas[skill];
    if (fn) {
      return fn(character.attributes);
    }
    return 0;
  }

  /**
   * Update the base values shown in the skills table when
   * characteristics change.
   */
  function updateSkillBases() {
    skillsTableBody.querySelectorAll('td[data-skill]').forEach(cell => {
      const skill = cell.dataset.skill;
      if (!cell.previousSibling || cell.cellIndex !== 1) return;
      // Only update base cells (2nd column)
    });
    // Actually update base and total values
    skillsTableBody.querySelectorAll('tr').forEach(row => {
      const skill = row.firstElementChild.textContent;
      const baseCell = row.children[1];
      baseCell.textContent = Math.round(computeBaseForSkill(skill));
      const totalCell = row.lastElementChild;
      totalCell.textContent = Math.round(computeTotalForSkill(skill));
    });
  }

  /**
   * Compute the total percentage for a skill by summing base and
   * allocations.  A minimum of 5% is enforced on standard skills【394499632944594†L613-L641】.
   */
  function computeTotalForSkill(skill) {
    const base = computeBaseForSkill(skill);
    const alloc = character.skillAllocations[skill];
    const total = base + alloc.culture + alloc.career + alloc.bonus;
    // Enforce minimum of 5% for standard skills
    if (standardSkillFormulas.hasOwnProperty(skill) && total < 5) {
      return 5;
    }
    return total;
  }

  /**
   * Input event handler for skill allocations.  Ensures that the
   * allocated points do not exceed the remaining pool or per‑skill cap.
   * Afterwards it updates the totals and remaining displays.
   */
  function onSkillInputChange(ev) {
    const input = ev.target;
    const skill = input.dataset.skill;
    const poolName = input.dataset.pool;
    const value = parseInt(input.value, 10);
    if (isNaN(value) || value < 0) {
      input.value = 0;
      character.skillAllocations[skill][poolName] = 0;
    } else {
      // Determine maximum allowed for this skill in this pool
      const cap = character.skillCaps[poolName];
      let v = Math.min(value, cap);
      // Enforce minimum of 5 points on culture standard skills
      if (poolName === 'culture') {
        const isStandard = cultures[character.culture].standard.includes(skill);
        if (isStandard) {
          v = Math.max(v, 5);
        }
      }
      // Compute remaining pool if this value is set
      const poolTotal = character.skillPools[poolName];
      const currentSum = Object.values(character.skillAllocations).reduce((sum, alloc) => sum + alloc[poolName], 0);
      const available = poolTotal - (currentSum - character.skillAllocations[skill][poolName]);
      if (v > available) v = available;
      character.skillAllocations[skill][poolName] = v;
      input.value = v;
    }
    // Update remaining pool labels and totals
    updateSkillPoolsDisplay();
    updateSkillTotals();
  }

  /**
   * Update the total column for each skill row after allocations change.
   */
  function updateSkillTotals() {
    skillsTableBody.querySelectorAll('tr').forEach(row => {
      const skill = row.firstElementChild.textContent;
      const totalCell = row.lastElementChild;
      totalCell.textContent = Math.round(computeTotalForSkill(skill));
    });

    // Refresh summary after totals update
    renderCharacterSummary();
  }

  /**
   * Update the remaining points display for each pool.
   */
  function updateSkillPoolsDisplay() {
    ['culture','career','bonus'].forEach(pool => {
      const remaining = character.skillPools[pool] - Object.values(character.skillAllocations).reduce((sum, alloc) => sum + alloc[pool], 0);
      if (pool === 'culture') cultureRemainingSpan.textContent = remaining;
      else if (pool === 'career') careerRemainingSpan.textContent = remaining;
      else bonusRemainingSpan.textContent = remaining;
    });
  }

  /**
   * Respond to changes in the selected age category.  Updates the
   * bonus pool size and maximum per skill, clears existing bonus
   * allocations if necessary, and refreshes displays.
   */
  function onAgeChange() {
    const cat = ageSelect.value;
    character.ageCat = cat;
    character.skillPools.bonus = ageCategories[cat].bonus;
    character.skillCaps.bonus = ageCategories[cat].max;
    // Reset bonus allocations if they exceed the new pool
    Object.keys(character.skillAllocations).forEach(skill => {
      character.skillAllocations[skill].bonus = 0;
    });
    updateAgeInfo();
    updateSkillPoolsDisplay();
    updateSkillTotals();

    // Age affects bonus pool and summary
    renderCharacterSummary();
  }

  /**
   * Respond to changes in culture or career selection.  Updates the
   * enabled status of skill inputs and resets allocations that are no
   * longer valid.
   */
  function onCultureOrCareerChange() {
    character.culture = cultureSelect.value;
    character.career = careerSelect.value;
    // Reset culture and career allocations for skills that are no longer available
    const cultureDefNew = cultures[character.culture];
    const careerDefNew = careers[character.career];
    allSkills.forEach(skill => {
      // If a skill is not in the new lists, zero out allocations
      if (!(cultureDefNew.standard.includes(skill) || cultureDefNew.professional.includes(skill))) {
        character.skillAllocations[skill].culture = 0;
      }
      if (!(careerDefNew.standard.includes(skill) || careerDefNew.professional.includes(skill))) {
        character.skillAllocations[skill].career = 0;
      }
    });
    // Rebuild the professional skill checkboxes and update enabled inputs
    populateProfessionalOptions();

    // Apply minimum culture allocations of 5% to each standard skill in the selected culture
    applyCultureMinimums();

    // Recompute skill table and summary when culture or career changes
    buildSkillsTable();
    renderCharacterSummary();

    // Refresh the social class options because they depend on the
    // selected culture.  Updating the select may change the
    // character's social class which in turn affects starting money.
    populateSocialClassSelect();

    // Update bonus skill options after culture/career changes
    populateBonusSkillSelect();
  }

  /**
   * Respond to changes in the social class.  Currently this only
   * affects the starting silver calculation.
   */
  function onSocialClassChange() {
    character.socialClass = socialSelect.value;

    // Social class affects starting silver and summary
    renderCharacterSummary();
  }

  /**
   * Respond to changes in the generation method (roll vs point buy).
   */
  function onMethodChange() {
    if (methodSelect.value === 'roll') {
      // Roll random attributes and disable editing
      rollAttributes();
      attributesInputsContainer.querySelectorAll('input').forEach(i => i.disabled = true);
      // Disable the pool size input when rolling
      if (poolSizeInput) poolSizeInput.disabled = true;
    } else {
      // Enable editing
      attributesInputsContainer.querySelectorAll('input').forEach(i => i.disabled = false);
      if (poolSizeInput) poolSizeInput.disabled = false;
    }
    updatePointPoolInfo();
    updateDerived();
    updateSkillBases();

    // Regenerate summary when generation method changes
    renderCharacterSummary();
  }

  /**
   * Generate starting silver based on culture and social class.  The
   * amount is loosely based on rolling dice; different cultures have
   * different base dice.  Social class acts as a multiplier.  The
   * result is displayed in the equipment section.
   */
  function generateStartingSilver() {
    let roll;
    switch (character.culture) {
      case 'Barbarian':
        roll = rollDice(2, 6);
        break;
      case 'Civilized':
        roll = rollDice(3, 6);
        break;
      case 'Nomadic':
        roll = rollDice(1, 6);
        break;
      case 'Primitive':
        roll = rollDice(1, 4);
        break;
      default:
        roll = rollDice(2, 6);
    }
    // Base silver pieces: each die result times 10
    const base = roll * 10;
    // Look up the multiplier for the selected social class within the
    // selected culture; default to 1 if not found
    let multiplier = 1;
    const classes = socialClassesByCulture[character.culture] || [];
    const found = classes.find(cls => cls.name === character.socialClass);
    if (found) multiplier = found.multiplier;
    const total = Math.round(base * multiplier);
    character.startingSilver = total;
    silverDisplay.textContent = `${total} sp`;

    // Reset equipment selections when new silver is generated
    character.equipment = [];
    // Rebuild equipment list to clear any selected items and update remaining silver
    buildEquipmentList();

    // Update summary with new starting money
    renderCharacterSummary();
  }

  /**
   * Build a data object representing the character's final state.  This
   * consolidates characteristics, derived statistics, skills and
   * equipment into a single structure for exporting.
   */
  function buildCharacterData() {
    const data = {
      name: character.name,
      ageCategory: character.ageCat,
      culture: character.culture,
      career: character.career,
      socialClass: character.socialClass,
      attributes: Object.assign({}, character.attributes),
      derived: {
        damageModifier: damageModifier(character.attributes.STR + character.attributes.SIZ),
        experienceModifier: experienceModifier(character.attributes.CHA),
        healingRate: healingRate(character.attributes.CON),
        luckPoints: luckPoints(character.attributes.POW),
        initiative: Math.floor((character.attributes.DEX + character.attributes.INT) / 2),
        hitPoints: hitPointsPerLocation(character.attributes.CON + character.attributes.SIZ)
      },
      skills: {},
      startingSilver: character.startingSilver || 0
      ,
      equipment: character.equipment.map(e => ({ name: e.name, cost: e.cost }))
    };
    // Include the chosen combat style and lists of professional skills
    data.combatStyle = character.combatStyle;
    data.selectedCulturePro = character.selectedCulturePro.slice();
    data.selectedCareerPro = character.selectedCareerPro.slice();
    allSkills.forEach(skill => {
      data.skills[skill] = {
        base: computeBaseForSkill(skill),
        culture: character.skillAllocations[skill].culture,
        career: character.skillAllocations[skill].career,
        bonus: character.skillAllocations[skill].bonus,
        total: computeTotalForSkill(skill)
      };
    });
    return data;
  }

  /**
   * Render a simple character sheet into the export step.  This
   * function composes a structured summary of the current character,
   * including attributes, derived values, starting silver and skills.
   * Only skills with a total value greater than zero are shown.  The
   * summary is regenerated whenever data changes to give immediate
   * feedback to the user.
   */
  function renderCharacterSummary() {
    const container = document.getElementById('characterSummary');
    if (!container) return;
    const data = buildCharacterData();
    let html = '';
    html += '<h3>Character Sheet</h3>';
    html += `<p><strong>Name:</strong> ${data.name || 'Unnamed'}</p>`;
    html += `<p><strong>Culture:</strong> ${data.culture} &nbsp;&nbsp; <strong>Career:</strong> ${data.career}</p>`;
    html += `<p><strong>Age Category:</strong> ${data.ageCategory} &nbsp;&nbsp; <strong>Social Class:</strong> ${data.socialClass}</p>`;
    html += `<p><strong>Combat Style:</strong> ${character.combatStyle || ''}</p>`;
    // Attributes
    html += '<h4>Characteristics</h4><ul class="attr-list">';
    Object.keys(data.attributes).forEach(attr => {
      html += `<li>${attr}: ${data.attributes[attr]}</li>`;
    });
    html += '</ul>';
    // Derived attributes
    html += '<h4>Derived Attributes</h4><ul class="attr-list">';
    const d = data.derived;
    html += `<li>Damage Modifier: ${d.damageModifier}</li>`;
    html += `<li>Experience Modifier: ${d.experienceModifier}</li>`;
    html += `<li>Healing Rate: ${d.healingRate}</li>`;
    html += `<li>Luck Points: ${d.luckPoints}</li>`;
    html += `<li>Initiative: ${d.initiative}</li>`;
    html += '<li>Hit Points Per Location:';
    html += '<ul>';
    Object.keys(d.hitPoints).forEach(loc => {
      html += `<li>${loc}: ${d.hitPoints[loc]}</li>`;
    });
    html += '</ul></li>';
    html += '</ul>';
    // Starting silver
    html += `<p><strong>Starting Silver:</strong> ${character.startingSilver || 0} sp</p>`;
    // Skills
    html += '<h4>Skills</h4><ul class="skill-list">';
    Object.keys(data.skills).forEach(skill => {
      const val = data.skills[skill].total;
      if (val > 0) {
        html += `<li>${skill}: ${Math.round(val)}%</li>`;
      }
    });
    html += '</ul>';

    // Equipment
    html += '<h4>Equipment</h4>';
    if (character.equipment.length === 0) {
      html += '<p>No equipment purchased.</p>';
    } else {
      html += '<ul class="equipment-list">';
      character.equipment.forEach(item => {
        html += `<li>${item.name} (${item.cost} sp)</li>`;
      });
      html += '</ul>';
    }
    container.innerHTML = html;
  }

  /**
   * Export the character as an Excel workbook using SheetJS.  A new
   * workbook is created with a single sheet summarising all data.
   */
  function exportToExcel() {
    const data = buildCharacterData();
    const wb = XLSX.utils.book_new();
    const rows = [];
    rows.push(['Name', data.name]);
    rows.push(['Age Category', data.ageCategory]);
    rows.push(['Culture', data.culture]);
    rows.push(['Career', data.career]);
    rows.push(['Social Class', data.socialClass]);
    rows.push(['Combat Style', data.combatStyle]);
    rows.push(['Culture Professional Skills', data.selectedCulturePro.join(', ')]);
    rows.push(['Career Professional Skills', data.selectedCareerPro.join(', ')]);
    rows.push([]);
    rows.push(['Attribute','Value']);
    Object.entries(data.attributes).forEach(([key,val]) => {
      rows.push([key, val]);
    });
    rows.push([]);
    rows.push(['Derived Attribute','Value']);
    Object.entries(data.derived).forEach(([key,val]) => {
      if (typeof val === 'object') {
        rows.push([key, JSON.stringify(val)]);
      } else {
        rows.push([key, val]);
      }
    });
    rows.push([]);
    rows.push(['Skill','Base','Culture','Career','Bonus','Total']);
    Object.entries(data.skills).forEach(([skill,obj]) => {
      // Round base and total values for export to avoid decimals
      const baseVal = Math.round(obj.base);
      const totalVal = Math.round(obj.total);
      rows.push([skill, baseVal, obj.culture, obj.career, obj.bonus, totalVal]);
    });
    rows.push([]);
    rows.push(['Starting Silver', data.startingSilver]);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, 'Character');
    const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const blob = new Blob([wbout], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    downloadBlob(blob, `${data.name || 'character'}.xlsx`);
  }

  /**
   * Export the character as a PDF using jsPDF.  A simple layout is
   * produced listing attributes, derived values and skills.  Due to
   * limited space this output is kept compact.
   */
  async function exportToPDF() {
    const data = buildCharacterData();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;
    doc.setFontSize(16);
    doc.text(data.name || 'Character Sheet', 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Age Category: ${data.ageCategory}`,10,y); y+=5;
    doc.text(`Culture: ${data.culture}`,10,y); y+=5;
    doc.text(`Career: ${data.career}`,10,y); y+=5;
    doc.text(`Social Class: ${data.socialClass}`,10,y); y+=5;
    doc.text(`Combat Style: ${data.combatStyle}`,10,y); y+=5;
    doc.text(`Culture Pro: ${data.selectedCulturePro.join(', ')}`,10,y); y+=5;
    doc.text(`Career Pro: ${data.selectedCareerPro.join(', ')}`,10,y); y+=5;
    y+=3;
    doc.setFontSize(12);
    doc.text('Attributes',10,y); y+=5;
    doc.setFontSize(10);
    Object.entries(data.attributes).forEach(([k,v]) => {
      doc.text(`${k}: ${v}`, 12, y);
      y += 4;
    });
    y += 2;
    doc.setFontSize(12);
    doc.text('Derived',10,y); y+=5;
    doc.setFontSize(10);
    Object.entries(data.derived).forEach(([k,v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : v;
      doc.text(`${k}: ${val}`, 12, y);
      y += 4;
    });
    y += 2;
    doc.setFontSize(12);
    doc.text('Skills',10,y); y+=5;
    doc.setFontSize(8);
    // Header
    doc.text('Skill', 10, y);
    doc.text('Base', 60, y);
    doc.text('C', 80, y);
    doc.text('Cr', 90, y);
    doc.text('B', 100, y);
    doc.text('Total', 110, y);
    y += 4;
    Object.entries(data.skills).forEach(([skill,obj]) => {
      if (y > 280) {
        doc.addPage();
        y = 10;
      }
      const baseVal = Math.round(obj.base);
      const totalVal = Math.round(obj.total);
      doc.text(skill.substring(0,25), 10, y);
      doc.text(String(baseVal), 60, y);
      doc.text(String(obj.culture), 80, y);
      doc.text(String(obj.career), 90, y);
      doc.text(String(obj.bonus), 100, y);
      doc.text(String(totalVal), 110, y);
      y += 4;
    });
    y += 5;
    doc.setFontSize(10);
    doc.text(`Starting Silver: ${data.startingSilver} sp`, 10, y);
    const blob = doc.output('blob');
    downloadBlob(blob, `${data.name || 'character'}.pdf`);
  }

  /**
   * Export the character as Markdown.  The Markdown document
   * structures information into headers and tables.
   */
  function exportToMarkdown() {
    const data = buildCharacterData();
    let md = `# ${data.name || 'Character Sheet'}\n\n`;
    md += `**Age Category**: ${data.ageCategory}\n\n`;
    md += `**Culture**: ${data.culture}\n\n`;
    md += `**Career**: ${data.career}\n\n`;
    md += `**Social Class**: ${data.socialClass}\n\n`;
    md += `**Combat Style**: ${data.combatStyle}\n\n`;
    md += `**Culture Professional Skills**: ${data.selectedCulturePro.join(', ')}\n\n`;
    md += `**Career Professional Skills**: ${data.selectedCareerPro.join(', ')}\n\n`;
    md += `## Attributes\n`;
    Object.entries(data.attributes).forEach(([k,v]) => {
      md += `- **${k}**: ${v}\n`;
    });
    md += `\n## Derived Attributes\n`;
    Object.entries(data.derived).forEach(([k,v]) => {
      md += `- **${k}**: ${typeof v === 'object' ? JSON.stringify(v) : v}\n`;
    });
    md += `\n## Skills\n`;
    md += `| Skill | Base | Culture | Career | Bonus | Total |\n`;
    md += `|------|-----:|-------:|------:|-----:|------:|\n`;
    Object.entries(data.skills).forEach(([skill,obj]) => {
      const baseVal = Math.round(obj.base);
      const totalVal = Math.round(obj.total);
      md += `| ${skill} | ${baseVal} | ${obj.culture} | ${obj.career} | ${obj.bonus} | ${totalVal} |\n`;
    });
    md += `\n## Equipment\n`;
    md += `- **Starting Silver**: ${data.startingSilver} sp\n`;
    const blob = new Blob([md], {type:'text/markdown'});
    downloadBlob(blob, `${data.name || 'character'}.md`);
  }

  /**
   * Export the character as a JSON file.  This simply serialises the
   * data object and prompts for download.
   */
  function exportToJSON() {
    const data = buildCharacterData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    downloadBlob(blob, `${data.name || 'character'}.json`);
  }

  /**
   * Helper to trigger a file download from a Blob.
   */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  /**
   * Switch active sections when navigation buttons are clicked.
   */
  function handleNavClick(ev) {
    navButtons.forEach(btn => btn.classList.remove('active'));
    ev.target.classList.add('active');
    const target = ev.target.dataset.target;
    sections.forEach(sec => {
      if (sec.id === target) sec.classList.add('active');
      else sec.classList.remove('active');
    });
  }

  /**
   * Initialisation routine executed once the DOM is ready.
   */
  function init() {
    populateSelects();
    buildAttributeInputs();
    updateDerived();
    // Apply minimum cultural allocations on initial load before building the table
    applyCultureMinimums();
    buildSkillsTable();
    populateCombatStyleSelect();
    populateProfessionalOptions();
    populateBonusSkillSelect();
    // Event listeners
    navButtons.forEach(btn => btn.addEventListener('click', handleNavClick));
    ageSelect.addEventListener('change', onAgeChange);
    cultureSelect.addEventListener('change', onCultureOrCareerChange);
    careerSelect.addEventListener('change', onCultureOrCareerChange);
    socialSelect.addEventListener('change', onSocialClassChange);
    nameInput.addEventListener('input', () => character.name = nameInput.value);
    methodSelect.addEventListener('change', onMethodChange);
    // Adjust pool size for point buy
    if (poolSizeInput) {
      poolSizeInput.addEventListener('input', () => {
        let val = parseInt(poolSizeInput.value, 10);
        if (isNaN(val)) val = 75;
        val = Math.min(Math.max(val, 60), 120);
        poolSizeInput.value = val;
        character.pool = val;
        updatePointPoolInfo();
      });
    }
    // Update combat style on selection change
    if (combatStyleSelect) {
      combatStyleSelect.addEventListener('change', () => {
        character.combatStyle = combatStyleSelect.value;
      });
    }

    // Bonus skill selection
    if (bonusSkillSelect) {
      bonusSkillSelect.addEventListener('change', () => {
        const old = character.bonusSkill;
        const val = bonusSkillSelect.value;
        // Reset allocations on the previously selected bonus skill
        if (old && old !== val) {
          if (character.skillAllocations[old]) {
            character.skillAllocations[old].bonus = 0;
          }
        }
        character.bonusSkill = val;
        // Rebuild table and summary
        buildSkillsTable();
        renderCharacterSummary();
      });
    }
    rollSilverBtn.addEventListener('click', generateStartingSilver);
    exportExcelBtn.addEventListener('click', exportToExcel);
    exportPDFBtn.addEventListener('click', exportToPDF);
    exportMarkdownBtn.addEventListener('click', exportToMarkdown);
    exportJSONBtn.addEventListener('click', exportToJSON);

    // Build equipment list after DOM ready.  It will show all
    // available items and update remaining silver (0 until silver is rolled).
    buildEquipmentList();

    // Render the initial character summary after all controls are built
    renderCharacterSummary();
  }
  // Kick things off
  document.addEventListener('DOMContentLoaded', init);
})();