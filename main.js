// Mythras character generator script
// This file implements a simple multi‑step form to build a Mythras character.
// It loads data from JSON files, handles attribute rolling, skill point
// allocation and equipment selection, and produces a final character sheet.

(async function () {
  // Cache DOM elements
  const stepConcept = document.getElementById('step-concept');
  const stepAttributes = document.getElementById('step-attributes');
  const stepSkillsCulture = document.getElementById('step-skills-culture');
  const stepSkillsCareer = document.getElementById('step-skills-career');
  const stepSkillsBonus = document.getElementById('step-skills-bonus');
  const stepEquipment = document.getElementById('step-equipment');
  const stepReview = document.getElementById('step-review');

  const cultureSelect = document.getElementById('culture');
  const careerSelect = document.getElementById('career');
  const sexSelect = document.getElementById('sex');
  const ageInput = document.getElementById('age');
  const characterNameInput = document.getElementById('characterName');
  const playerNameInput = document.getElementById('playerName');

  const nextToAttributesBtn = document.getElementById('next-to-attributes');
  const nextToSkillsBtn = document.getElementById('next-to-skills');
  const nextToCareerBtn = document.getElementById('next-to-career-skills');
  const nextToBonusBtn = document.getElementById('next-to-bonus-skills');
  const nextToEquipmentBtn = document.getElementById('next-to-equipment');
  const nextToReviewBtn = document.getElementById('next-to-review');
  const startOverBtn = document.getElementById('start-over');

  const culturePointsLeftEl = document.getElementById('culture-points-left');
  const careerPointsLeftEl = document.getElementById('career-points-left');
  const bonusPointsLeftEl = document.getElementById('bonus-points-left');
  const hobbySkillSelect = document.getElementById('hobby-skill');

  const attributesBody = document.getElementById('attributes-body');
  const cultureSkillsContainer = document.getElementById('culture-skills-container');
  const careerSkillsContainer = document.getElementById('career-skills-container');
  const bonusSkillsContainer = document.getElementById('bonus-skills-container');
  const equipmentContainer = document.getElementById('equipment-container');
  const equipmentTotalCostEl = document.getElementById('equipment-total-cost');
  const startingSpInput = document.getElementById('starting-sp');
  const reviewContainer = document.getElementById('review-container');

  // Data objects
  let skillsData = null;
  let culturesData = null;
  let careersData = null;
  let equipmentData = null;

  // Character state
  const character = {
    concept: {},
    attributes: {
      STR: 0,
      CON: 0,
      SIZ: 0,
      DEX: 0,
      INT: 0,
      POW: 0,
      CHA: 0,
    },
    skills: {}, // base skills computed
    skillAlloc: {
      culture: {},
      career: {},
      bonus: {},
      hobby: null,
    },
    equipment: {},
    startingSp: 0,
  };

  /**
   * Load JSON data from the data directory. We fetch these resources relative
   * to the site root. Should be loaded only once.
   */
  async function loadData() {
    const [skillsRes, culturesRes, careersRes, equipmentRes] = await Promise.all([
      fetch('data/skills.json'),
      fetch('data/cultures.json'),
      fetch('data/careers.json'),
      fetch('data/equipment.json'),
    ]);
    skillsData = await skillsRes.json();
    culturesData = await culturesRes.json();
    careersData = await careersRes.json();
    equipmentData = await equipmentRes.json();
  }

  /**
   * Hide all steps and then show the provided section.
   * @param {HTMLElement} stepEl
   */
  function showStep(stepEl) {
    [stepConcept, stepAttributes, stepSkillsCulture, stepSkillsCareer, stepSkillsBonus, stepEquipment, stepReview].forEach(
      (el) => {
        el.classList.add('hidden');
      }
    );
    stepEl.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  /**
   * Populate select elements for cultures and careers.
   */
  function populateSelects() {
    // Culture options
    Object.keys(culturesData).forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = culturesData[key].displayName;
      cultureSelect.appendChild(opt);
    });
    // Career options
    Object.keys(careersData).forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = careersData[key].displayName;
      careerSelect.appendChild(opt);
    });
    // Hobby skill options include all skills
    const allSkillNames = [
      ...skillsData.standard.map((s) => s.name),
      ...skillsData.professional.map((s) => s.name),
    ];
    allSkillNames.sort();
    allSkillNames.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      hobbySkillSelect.appendChild(opt);
    });
  }

  /**
   * Render attribute inputs. Creates a row for each characteristic with an
   * editable number input. When an input changes, update the character
   * attribute value and recompute base skill values.
   */
  function renderAttributeInputs() {
    const attrs = Object.keys(character.attributes);
    attributesBody.innerHTML = '';
    attrs.forEach((attr) => {
      const tr = document.createElement('tr');
      const tdLabel = document.createElement('td');
      tdLabel.textContent = attr;
      const tdInput = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '3';
      input.max = '18';
      input.value = character.attributes[attr];
      input.addEventListener('input', () => {
        const val = parseInt(input.value || '0', 10);
        character.attributes[attr] = val;
        recomputeBaseSkills();
      });
      tdInput.appendChild(input);
      tr.appendChild(tdLabel);
      tr.appendChild(tdInput);
      attributesBody.appendChild(tr);
    });
  }

  /**
   * Roll attributes randomly according to Mythras rules: 3d6 for most, 2d6+6 for SIZ and INT.
   */
  function rollAttributes() {
    function rollDice(num, sides, add = 0) {
      let total = 0;
      for (let i = 0; i < num; i++) {
        total += Math.floor(Math.random() * sides) + 1;
      }
      return total + add;
    }
    // STR, CON, DEX, POW, CHA: 3d6
    ['STR', 'CON', 'DEX', 'POW', 'CHA'].forEach((attr) => {
      character.attributes[attr] = rollDice(3, 6);
    });
    // SIZ, INT: 2d6+6
    character.attributes['SIZ'] = rollDice(2, 6, 6);
    character.attributes['INT'] = rollDice(2, 6, 6);
    renderAttributeInputs();
    recomputeBaseSkills();
  }

  /**
   * Compute base skill percentages from current attributes using formula strings
   * defined in skillsData. Results are stored on character.skills.
   */
  function recomputeBaseSkills() {
    const attrs = character.attributes;
    const baseSkills = {};
    const compute = (formula) => {
      let total = 0;
      // Split on '+' to support addition
      formula.split('+').forEach((part) => {
        part = part.trim();
        if (!part) return;
        if (part.includes('*')) {
          const [name, mult] = part.split('*');
          const val = attrs[name.trim()] || 0;
          total += val * parseInt(mult.trim(), 10);
        } else {
          total += attrs[part] || 0;
        }
      });
      return total;
    };
    // Standard skills
    skillsData.standard.forEach((skill) => {
      const baseVal = compute(skill.base);
      const bonus = skill.bonus ? skill.bonus : 0;
      baseSkills[skill.name] = baseVal + bonus;
    });
    // Professional skills
    skillsData.professional.forEach((skill) => {
      const baseVal = compute(skill.base);
      const bonus = skill.bonus ? skill.bonus : 0;
      baseSkills[skill.name] = baseVal + bonus;
    });
    character.skills = baseSkills;
    // When base skills change, update any allocation displays
    updateAllocationDisplays();
  }

  /**
   * Update all allocation tables (culture, career, bonus) to reflect new base
   * values and any current allocations. This should be called whenever
   * character.skills changes or allocation values change.
   */
  function updateAllocationDisplays() {
    // Culture
    if (!cultureSkillsContainer.innerHTML) return;
    updateSkillTable(cultureSkillsContainer, character.skillAlloc.culture);
    updateSkillTable(careerSkillsContainer, character.skillAlloc.career);
    updateSkillTable(bonusSkillsContainer, character.skillAlloc.bonus, true);
    // Update points left values
    culturePointsLeftEl.textContent = computePointsLeft(character.skillAlloc.culture, 100);
    careerPointsLeftEl.textContent = computePointsLeft(character.skillAlloc.career, 100);
    bonusPointsLeftEl.textContent = computePointsLeft(character.skillAlloc.bonus, 150);
    // Update equipment totals separately
    updateEquipmentTotal();
  }

  /**
   * Compute points left for a given allocation object and limit.
   * @param {Object} alloc
   * @param {number} limit
   */
  function computePointsLeft(alloc, limit) {
    let spent = 0;
    Object.values(alloc).forEach((v) => {
      spent += parseInt(v || '0', 10);
    });
    const left = limit - spent;
    return left < 0 ? 0 : left;
  }

  /**
   * Update a single skill table to show current base and allocated points
   * @param {HTMLElement} container 
   * @param {Object} alloc
   * @param {boolean} includeBonus Whether this is the bonus table (affects display)
   */
  function updateSkillTable(container, alloc, includeBonus = false) {
    // Each table row has dataset-skill attribute
    const rows = container.querySelectorAll('tr[data-skill]');
    rows.forEach((tr) => {
      const skillName = tr.getAttribute('data-skill');
      const baseVal = character.skills[skillName] || 0;
      const allocVal = alloc[skillName] || 0;
      const finalVal = baseVal + allocVal;
      tr.querySelector('.base-val').textContent = baseVal + '%';
      tr.querySelector('.allocated-val').value = allocVal;
      tr.querySelector('.total-val').textContent = finalVal + '%';
    });
  }

  /**
   * Build a skill allocation table for a set of skills. When constructing, we
   * attach event listeners to the number inputs so that changes update the
   * corresponding allocation object and recalculate the points left. Each
   * container should be empty before calling this function.
   * @param {HTMLElement} container
   * @param {Array<string>} skillList
   * @param {Object} allocObj
   * @param {HTMLElement} pointsLeftEl
   * @param {number} limit
   */
  function buildSkillTable(container, skillList, allocObj, pointsLeftEl, limit) {
    const table = document.createElement('table');
    table.classList.add('skills-table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Skill</th><th>Base</th><th>Allocated</th><th>Total</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    skillList.forEach((skillName) => {
      // Avoid duplicates
      if (!character.skills.hasOwnProperty(skillName)) return;
      const tr = document.createElement('tr');
      tr.setAttribute('data-skill', skillName);
      const nameTd = document.createElement('td');
      nameTd.textContent = skillName;
      const baseTd = document.createElement('td');
      baseTd.className = 'base-val';
      const allocTd = document.createElement('td');
      const allocInput = document.createElement('input');
      allocInput.type = 'number';
      allocInput.min = '0';
      allocInput.value = allocObj[skillName] || 0;
      allocInput.className = 'allocated-val';
      allocInput.addEventListener('input', () => {
        let val = parseInt(allocInput.value || '0', 10);
        if (isNaN(val)) val = 0;
        allocObj[skillName] = val;
        // Ensure you cannot spend beyond limit
        const left = computePointsLeft(allocObj, limit);
        if (left < 0) {
          // reduce this value accordingly
          const currentSpent = Object.values(allocObj).reduce((a, b) => a + (parseInt(b || '0', 10)), 0);
          const overspend = currentSpent - limit;
          allocObj[skillName] = Math.max(0, val - overspend);
          allocInput.value = allocObj[skillName];
        }
        pointsLeftEl.textContent = computePointsLeft(allocObj, limit);
        // Update final cell
        const baseVal = character.skills[skillName] || 0;
        const finalVal = baseVal + allocObj[skillName];
        tr.querySelector('.total-val').textContent = finalVal + '%';
      });
      allocTd.appendChild(allocInput);
      const totalTd = document.createElement('td');
      totalTd.className = 'total-val';
      tr.appendChild(nameTd);
      tr.appendChild(baseTd);
      tr.appendChild(allocTd);
      tr.appendChild(totalTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
    // Initial update of values
    updateSkillTable(container, allocObj);
    pointsLeftEl.textContent = computePointsLeft(allocObj, limit);
  }

  /**
   * Build the equipment table, listing all items with cost and quantity
   */
  function buildEquipmentTable() {
    const table = document.createElement('table');
    table.classList.add('equipment-table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Item</th><th>Cost (sp)</th><th>Qty</th><th>Total</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    equipmentData.forEach((item) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-item', item.name);
      const nameTd = document.createElement('td');
      nameTd.textContent = item.name;
      const costTd = document.createElement('td');
      costTd.textContent = item.cost;
      const qtyTd = document.createElement('td');
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '0';
      qtyInput.value = character.equipment[item.name] || 0;
      qtyInput.addEventListener('input', () => {
        let val = parseInt(qtyInput.value || '0', 10);
        if (isNaN(val) || val < 0) val = 0;
        character.equipment[item.name] = val;
        // Update total cell
        tr.querySelector('.equip-total').textContent = (val * item.cost).toString();
        updateEquipmentTotal();
      });
      qtyTd.appendChild(qtyInput);
      const totalTd = document.createElement('td');
      totalTd.className = 'equip-total';
      totalTd.textContent = '0';
      tr.appendChild(nameTd);
      tr.appendChild(costTd);
      tr.appendChild(qtyTd);
      tr.appendChild(totalTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    equipmentContainer.innerHTML = '';
    equipmentContainer.appendChild(table);
    updateEquipmentTotal();
  }

  /**
   * Update equipment total cost
   */
  function updateEquipmentTotal() {
    let total = 0;
    equipmentData.forEach((item) => {
      const qty = character.equipment[item.name] || 0;
      total += qty * item.cost;
    });
    equipmentTotalCostEl.textContent = total.toString();
  }

  /**
   * Render the review page summarizing all data and derived attributes.
   */
  function renderReview() {
    const { concept, attributes, skills, skillAlloc, equipment, startingSp } = character;
    // Compute final skill values (base + allocations)
    const finalSkills = {};
    Object.keys(skills).forEach((name) => {
      finalSkills[name] = skills[name] + (skillAlloc.culture[name] || 0) + (skillAlloc.career[name] || 0) + (skillAlloc.bonus[name] || 0);
      // Add hobby skill points if applicable
      if (skillAlloc.hobby && skillAlloc.hobby === name) {
        finalSkills[name] += 50;
      }
    });
    // Derived attributes
    const derived = {};
    // Action Points: Mythras Imperative uses 2 action points for everyone
    derived.actionPoints = 2;
    // Damage Modifier from STR+SIZ
    const dmgSum = attributes.STR + attributes.SIZ;
    function damageMod(sum) {
      if (sum <= 5) return '-1d8';
      if (sum <= 10) return '-1d6';
      if (sum <= 15) return '-1d4';
      if (sum <= 20) return '-1d2';
      if (sum <= 25) return '+0';
      if (sum <= 30) return '+1d2';
      if (sum <= 35) return '+1d4';
      if (sum <= 40) return '+1d6';
      if (sum <= 45) return '+1d8';
      return '+1d10';
    }
    derived.damageMod = damageMod(dmgSum);
    // Experience Modifier from CHA
    const cha = attributes.CHA;
    let expMod = 0;
    if (cha <= 6) expMod = -1;
    else if (cha <= 12) expMod = 0;
    else if (cha <= 18) expMod = 1;
    else expMod = 1 + Math.floor((cha - 18) / 6);
    derived.expMod = expMod;
    // Healing Rate from CON
    const con = attributes.CON;
    let healRate = 1;
    if (con <= 6) healRate = 1;
    else if (con <= 12) healRate = 2;
    else if (con <= 18) healRate = 3;
    else healRate = 3 + Math.floor((con - 18) / 6);
    derived.healingRate = healRate;
    // Initiative bonus: floor((DEX + INT)/2)
    derived.initiativeBonus = Math.floor((attributes.DEX + attributes.INT) / 2);
    // Magic Points = POW
    derived.magicPoints = attributes.POW;
    // Luck Points from POW
    const pow = attributes.POW;
    let luck = 1;
    if (pow <= 6) luck = 1;
    else if (pow <= 12) luck = 2;
    else if (pow <= 18) luck = 3;
    else luck = 3 + Math.floor((pow - 18) / 6);
    derived.luckPoints = luck;
    // Movement Rate: default 6
    derived.movementRate = 6;

    // Resistances (a subset of skills) – show as final skills
    const resistances = ['Brawn', 'Endurance', 'Evade', 'Willpower'];
    // Build review HTML
    const htmlParts = [];
    htmlParts.push(`<h3>Concept</h3>`);
    htmlParts.push('<table class="attributes-table">');
    htmlParts.push('<tbody>');
    htmlParts.push(`<tr><td>Character</td><td>${concept.characterName || ''}</td></tr>`);
    htmlParts.push(`<tr><td>Player</td><td>${concept.playerName || ''}</td></tr>`);
    htmlParts.push(`<tr><td>Sex</td><td>${concept.sex || ''}</td></tr>`);
    htmlParts.push(`<tr><td>Age</td><td>${concept.age || ''}</td></tr>`);
    htmlParts.push(`<tr><td>Culture</td><td>${concept.cultureDisplay || ''}</td></tr>`);
    htmlParts.push(`<tr><td>Career</td><td>${concept.careerDisplay || ''}</td></tr>`);
    htmlParts.push('</tbody></table>');

    htmlParts.push('<h3>Characteristics</h3>');
    htmlParts.push('<table class="attributes-table"><tbody>');
    Object.keys(attributes).forEach((attr) => {
      htmlParts.push(`<tr><td>${attr}</td><td>${attributes[attr]}</td></tr>`);
    });
    htmlParts.push('</tbody></table>');

    htmlParts.push('<h3>Derived Attributes</h3>');
    htmlParts.push('<table class="attributes-table"><tbody>');
    Object.entries(derived).forEach(([key, val]) => {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (c) => c.toUpperCase());
      htmlParts.push(`<tr><td>${label}</td><td>${val}</td></tr>`);
    });
    htmlParts.push('</tbody></table>');

    htmlParts.push('<h3>Skills</h3>');
    htmlParts.push('<table class="attributes-table"><thead><tr><th>Skill</th><th>Value</th></tr></thead><tbody>');
    // Sort skills alphabetically for display
    Object.keys(finalSkills)
      .sort()
      .forEach((name) => {
        htmlParts.push(`<tr><td>${name}</td><td>${finalSkills[name]}%</td></tr>`);
      });
    htmlParts.push('</tbody></table>');

    htmlParts.push('<h3>Equipment</h3>');
    htmlParts.push('<table class="attributes-table"><thead><tr><th>Item</th><th>Qty</th><th>Cost</th></tr></thead><tbody>');
    let totalCost = 0;
    Object.keys(equipment).forEach((name) => {
      const qty = equipment[name];
      if (!qty || qty <= 0) return;
      const item = equipmentData.find((i) => i.name === name);
      const cost = qty * item.cost;
      totalCost += cost;
      htmlParts.push(`<tr><td>${name}</td><td>${qty}</td><td>${cost}</td></tr>`);
    });
    htmlParts.push(`<tr><td><strong>Total</strong></td><td></td><td>${totalCost}</td></tr>`);
    htmlParts.push('</tbody></table>');
    htmlParts.push(`<p><strong>Starting Silver:</strong> ${startingSp || 0} sp</p>`);
    htmlParts.push(`<p><strong>Silver Remaining:</strong> ${startingSp - totalCost} sp</p>`);

    reviewContainer.innerHTML = htmlParts.join('');
  }

  /**
   * Handle navigation and data capture for each step. When a Next button is
   * clicked, validate the current inputs, store them on the character object
   * and then build the next step.
   */
  function setupEventHandlers() {
    // Step 1 -> Step 2
    nextToAttributesBtn.addEventListener('click', () => {
      // Validate concept selections
      const cultureKey = cultureSelect.value;
      const careerKey = careerSelect.value;
      if (!cultureKey || !careerKey) {
        alert('Please select a culture and career before proceeding.');
        return;
      }
      character.concept = {
        characterName: characterNameInput.value.trim(),
        playerName: playerNameInput.value.trim(),
        age: parseInt(ageInput.value || '0', 10),
        sex: sexSelect.value,
        culture: cultureKey,
        cultureDisplay: culturesData[cultureKey].displayName,
        career: careerKey,
        careerDisplay: careersData[careerKey].displayName,
      };
      // Initialize skill allocations
      character.skillAlloc.culture = {};
      character.skillAlloc.career = {};
      character.skillAlloc.bonus = {};
      character.skillAlloc.hobby = null;
      // Show attributes step
      renderAttributeInputs();
      showStep(stepAttributes);
    });

    // Roll attributes button
    document.getElementById('roll-attributes').addEventListener('click', () => {
      rollAttributes();
    });

    // Step 2 -> Step 3
    nextToSkillsBtn.addEventListener('click', () => {
      // Ensure attributes have values (cannot be 0)
      const missing = Object.values(character.attributes).some((v) => v <= 0);
      if (missing) {
        alert('Please set values for all attributes (roll or input numbers).');
        return;
      }
      recomputeBaseSkills();
      // Build cultural skills table
      const cultureKey = character.concept.culture;
      const culture = culturesData[cultureKey];
      // Compose list of skills from standard + professional + combat style (use first style)
      const skillList = [];
      culture.standardSkills.forEach((s) => skillList.push(s));
      if (culture.professionalSkills) culture.professionalSkills.forEach((s) => skillList.push(s));
      if (culture.combatStyles && culture.combatStyles.length) {
        const styleName = culture.combatStyles[0];
        // Combat styles use same base formula as Combat Style (STR+DEX)
        // If not already defined, assign to skills list and base skills
        skillList.push(styleName);
        if (!skillsData.standard.some((sk) => sk.name === styleName) && !skillsData.professional.some((sk) => sk.name === styleName)) {
          // treat as new skill with base formula STR+DEX
          character.skills[styleName] = character.attributes.STR + character.attributes.DEX;
        }
      }
      // Remove duplicates
      const uniqueSkills = [...new Set(skillList)];
      buildSkillTable(cultureSkillsContainer, uniqueSkills, character.skillAlloc.culture, culturePointsLeftEl, 100);
      showStep(stepSkillsCulture);
    });

    // Step 3 -> Step 4
    nextToCareerBtn.addEventListener('click', () => {
      // Validate points spent
      if (computePointsLeft(character.skillAlloc.culture, 100) > 0) {
        if (!confirm('You still have unspent culture points. Continue?')) {
          return;
        }
      }
      // Build career skills table
      const careerKey = character.concept.career;
      const career = careersData[careerKey];
      const skillList = [];
      career.standardSkills.forEach((s) => skillList.push(s));
      if (career.professionalSkills) career.professionalSkills.forEach((s) => skillList.push(s));
      const uniqueSkills = [...new Set(skillList)];
      buildSkillTable(careerSkillsContainer, uniqueSkills, character.skillAlloc.career, careerPointsLeftEl, 100);
      showStep(stepSkillsCareer);
    });

    // Step 4 -> Step 5
    nextToBonusBtn.addEventListener('click', () => {
      if (computePointsLeft(character.skillAlloc.career, 100) > 0) {
        if (!confirm('You still have unspent career points. Continue?')) {
          return;
        }
      }
      // Build bonus skills table; include all skills from base skill list
      const allSkillNames = Object.keys(character.skills);
      buildSkillTable(bonusSkillsContainer, allSkillNames, character.skillAlloc.bonus, bonusPointsLeftEl, 150);
      showStep(stepSkillsBonus);
    });

    // Handle hobby skill selection
    hobbySkillSelect.addEventListener('change', () => {
      character.skillAlloc.hobby = hobbySkillSelect.value || null;
    });

    // Step 5 -> Step 6
    nextToEquipmentBtn.addEventListener('click', () => {
      if (computePointsLeft(character.skillAlloc.bonus, 150) > 0) {
        if (!confirm('You still have unspent bonus points. Continue?')) {
          return;
        }
      }
      buildEquipmentTable();
      showStep(stepEquipment);
    });

    // Starting silver pieces input
    startingSpInput.addEventListener('input', () => {
      character.startingSp = parseInt(startingSpInput.value || '0', 10);
    });

    // Step 6 -> Step 7
    nextToReviewBtn.addEventListener('click', () => {
      // Save starting SP
      character.startingSp = parseInt(startingSpInput.value || '0', 10);
      renderReview();
      showStep(stepReview);
    });

    // Start over resets everything
    startOverBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Initialize the application
  await loadData();
  populateSelects();
  renderAttributeInputs();
  recomputeBaseSkills();
  setupEventHandlers();
})();