import { COSTANTS, isRequesting, npcGenGPTLib } from "./lib.js";
import { npcGenGPTDataStructure } from "./dataStructures.js";

export class npcGenGPTGenerateNPC extends Application {
    constructor() {
        super();
        this.data = {};
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: COSTANTS.MODULE_ID,
            title: game.i18n.localize("npc-generator-gpt.dialog.title"),
            template: `modules/${COSTANTS.MODULE_ID}/templates/${COSTANTS.TEMPLATE.DIALOG}`,
            width: 300,
            height: 480
        });
    }

    async getData(options) {
        const data = await super.getData(options);
        const categories = npcGenGPTLib.getDialogCategories(npcGenGPTDataStructure.categoryList);
        data.category = categories.map(category => {
            const arg = (category.value === 'subtype') ? 'commoner' : category.value;
            return { ...category, option: npcGenGPTLib.getDialogOptions(arg, (arg !== 'type' && arg !== 'cr')) };
        });
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('#type').change(this.changeDialogCategory.bind(this));
        html.find('#npcGenGPT_create-btn').click(this.initGeneration.bind(this));
    }

    changeDialogCategory() {
        const npcType = this.element.find('#type option:selected').val();
        const generateOptions = (data, random) => {
            return npcGenGPTLib.getDialogOptions(data, random).map(subtype => {
                if (subtype.translate) subtype.label = game.i18n.localize(subtype.label);
                return `<option value="${subtype.value}">${subtype.label}</option>`;
            }).join('');
        };
        const label = game.i18n.localize(`npc-generator-gpt.dialog.subtype.${((npcType === 'npc') ? 'class' : 'label')}`);
        this.element.find("label[for='subtype']").text(`${label}:`);
        this.element.find("#subtype").html(generateOptions(npcType, true));
        this.element.find("#cr").html(generateOptions('cr', npcType === 'npc'));
    }

    async initGeneration() {
        if (isRequesting) {
            ui.notifications.warn(`${COSTANTS.LOG_PREFIX} ${game.i18n.localize("npc-generator-gpt.status.wait")}`);
            return;
        }

        this.generateDialogData();

        const button = this.element.find('#npcGenGPT_create-btn');
        button.text(game.i18n.localize("npc-generator-gpt.dialog.buttonPending"));

        const responseData = await npcGenGPTLib.callAI(this.initQuery());
	this.updateDataWithGPT(responseData);
	this.generateNonGPTData();
        button.text(game.i18n.localize("npc-generator-gpt.dialog.button"));

        if (responseData) {
            this.mergeGptData(responseData);
            this.createNPC();
        }
    }

    generateDialogData() {
        this.data.details = {};
        this.data.details.optionalContext = this.element.find('#context').val();
        npcGenGPTDataStructure.categoryList.forEach(category => {
            const dialogCategory = this.element.find(`#${category}`);
            this.data.details[category] = npcGenGPTLib.getSelectedOption(dialogCategory, this.data.details.optionalContext);
        });
        const { cr, race, type, subtype } = this.data.details;
        subtype.value = (type.value === 'commoner') ? type.value : subtype.value;
        this.data.details.optionalName = this.element.find('#name').val();
        this.data.details.sheet = (type.value === 'commoner') ? 'npc-generator-gpt.dialog.subtype.label' : 'npc-generator-gpt.dialog.subtype.class';
    }

    updateDataWithGPT(gptData) {
	console.log(gptData);
	let data = {
		gender: { label: "", value: "" },
		race: { label: "", value: "" },
		commoner: { label: "", value: "" },
		npc: { label: "", value: "" },
		alignment: { label: "", value: "" },
		cr: {label: "", value: "" }
	};
	data.gender.gpt = gptData.gender;
	data.race.gpt = gptData.race;
	data.commoner.gpt = gptData.commoner;
	data.npc.gpt = gptData.npc;
	data.alignment.gpt = gptData.alignment;
	data.cr.gpt = gptData.challenge_rating;
	for (let i = 0; i < Object.keys(data).length; i++) {
		let key=Object.keys(data)[i];
		if (data[key].gpt) {
			console.log("PRE_KEY");
			console.log(data[key].value);
			data[key].value = data[key].gpt.toLowerCase();
			console.log("KEY: " + key +", " + data[key].value);
			let localizationObject = game.i18n.translations["npc-generator-gpt"];
			delete localizationObject.dialog[key].label
			let localizationKeys = localizationObject.dialog[key];
			console.log(localizationKeys);
			if (key === 'commoner') {
				let job = data[key].gpt.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
				console.log("JOB: " + job);
				data[key].label = job;
				data[key].value = job;
				this.data.details.subtype.label = data[key].label;
			}
			else if (key === 'npc') {
				let localizationKeysArray=Object.keys(localizationKeys);
				let labelIndex = localizationKeysArray.indexOf("label");
				if ( labelIndex != "-1" ) localizationKeysArray.splice(labelIndex, 1);
				let localizationValue = npcGenGPTLib.fuzzyCompare(data[key].value, localizationKeysArray, 100)[0].string;
			        let localization="npc-generator-gpt.dialog." + key + "." + localizationValue;
				console.log(data[key].value + " vs " + localizationValue);
				data[key].value = localizationValue;
				data[key].label = game.i18n.localize(localization);
				this.data.details.subtype.label = data[key].label;
				this.data.details.subtype.key = data[key].value;
				this.data.details.subtype.value = data[key].value;
			}
			else if (key === 'cr') {
				data[key].value = data[key].gpt;
				this.data.details[key].value = data[key].value;
			}
			else {
				if (key === 'race') localizationKeys = npcGenGPTDataStructure.raceData;
				console.log("Localization Keys!");
				console.log(localizationKeys);
				let localizationKeysArray=Object.keys(localizationKeys);
				let labelIndex = localizationKeysArray.indexOf("label");
				if ( labelIndex != "-1" ) localizationKeysArray.splice(labelIndex, 1);
				console.log(localizationKeysArray);
				let localizationValue= npcGenGPTLib.fuzzyCompare(data[key].value, localizationKeysArray, 100)[0].string;
			        let localization="npc-generator-gpt.dialog." + key + "." + localizationValue;
				console.log(data[key].value + " vs " + localizationValue);
				data[key].label = game.i18n.localize(localization);
				data[key].value = localizationValue;
				this.data.details[key].label = data[key].label;
				this.data.details[key].value = data[key].value;
			}
		}
	}
    }
    generateNonGPTData() {
        const { cr, race, type, subtype } = this.data.details;
        this.data.abilities = this.generateNpcAbilities(subtype.value, cr.value);
        this.data.attributes = this.generateNpcAttributes(this.data.details.race.value, subtype.value, cr.value);
        this.data.skills = this.generateNpcSkills(race.value, subtype.value);
        this.data.traits = this.generateNpcTraits(race.value, subtype.value);
        this.data.currency = npcGenGPTLib.getNpcCurrency(cr.value);
    }
    initQuery() {
        const { optionalName, gender, race, type, subtype, alignment, cr, optionalContext } = this.data.details;
	if (gender.label === 'Random') gender.label === 'gender based on context';
	if (race.label === 'Random') race.label === 'race based on context';
	if (subtype.label === 'Random') {
		if (type.label === 'Commoner') subtype.label === 'profession based on context';
		else subtype.label === 'profession based on context';
	}
	if (alignment.label === 'Random') alignment.label === 'alignment based on context';
	if (cr.label === 'Random') cr.label === 'alignment based on context';
        let options = `${gender.label}, ${race.label}, ${subtype.label}, ${alignment.label}, ${cr.label}`;
        if (optionalName) options = `(${game.i18n.localize("npc-generator-gpt.query.name")}: ${optionalName}) ${options}`; 
        if (optionalContext) options = `(${game.i18n.localize("npc-generator-gpt.query.context")}: ${optionalContext}) ${options}`; 
	const details = this.data.details;
	return npcGenGPTDataStructure.getGenerateQueryTemplate(options, optionalContext, details)
    }

    mergeGptData(gptData) {
        const { name: gptName, spells, items, appearance, background, roleplaying, readaloud } = gptData;
        this.data.name = gptName;
        this.data.spells = spells;
        this.data.items = items;
	if (gptData.strength) this.data.abilities.str.value = gptData.strength
	if (gptData.dexterity) this.data.abilities.dex.value = gptData.dexterity
	if (gptData.constitution) this.data.abilities.con.value = gptData.constitution
	if (gptData.wisdom) this.data.abilities.wis.value = gptData.wisdom
	if (gptData.intelligence) this.data.abilities.int.value = gptData.intelligence
	if (gptData.charisma) this.data.abilities.cha.value = gptData.charisma
        this.data.details = {
            ...this.data.details,
            source: "NPC Generator (GPT)",
            biography: {
                appearance: appearance,
                background: background,
                roleplaying: roleplaying,
                readaloud: readaloud
            }
        };
    }

    async createNPC() {
        try {
            const { abilities, attributes, details, name, skills, traits, currency } = this.data;
            const fakeAlign = (game.settings.get(COSTANTS.MODULE_ID, "hideAlignment")) ? game.i18n.localize("npc-generator-gpt.sheet.unknown") : details.alignment.label;
            const bioContent = await npcGenGPTLib.getTemplateStructure(COSTANTS.TEMPLATE.SHEET, this.data);

            const npc = await Actor.create({ name: name, type: "npc" });
            await npc.update({
                system: {
                    details: {
                        source: details.source,
                        cr: details.cr.value,
                        alignment: fakeAlign,
                        race: details.race.label,
                        biography: { value: bioContent },
                        type: { value: 'custom', custom: details.race.label }
                    },
                    traits: { size: traits.size, languages: { value: traits.languages } },
                    abilities: abilities,
                    attributes: {
                        hp: attributes.hp,
                        'ac.value': attributes.ac,
                        movement: attributes.movement,
                        senses: attributes.senses,
                        spellcasting: attributes.spellcasting
                    },
                    skills: skills,
                    currency: currency
                }
            });

            let comp = npcGenGPTLib.getSettingsPacks();
            npcGenGPTLib.addItemstoNpc(npc, comp.items, this.data.items);
            npcGenGPTLib.addItemstoNpc(npc, comp.spells, this.data.spells);

            npc.sheet.render(true);

            this.close();
            ui.notifications.info(`${COSTANTS.LOG_PREFIX} ${game.i18n.format("npc-generator-gpt.status.done", { npcName: name })}`);
        } catch (error) {
            console.error(`${COSTANTS.LOG_PREFIX} Error during NPC creation:`, error);
            ui.notifications.error(`${COSTANTS.LOG_PREFIX} ${game.i18n.localize("npc-generator-gpt.status.error3")}`);
        }
    }

    generateNpcAbilities(npcSubtype, npcCR) {
	console.log("Subtype: " + npcSubtype);
        const npcStats = npcGenGPTDataStructure.subtypeData[npcSubtype];
        const profAbilities = (npcSubtype === 'commoner')
            ? npcGenGPTLib.getRandomFromPool(npcStats.save.pool, npcStats.save.max)
            : npcStats.save;
        const npcAbilities = npcGenGPTLib.getNpcAbilities(profAbilities);
        return npcGenGPTLib.scaleAbilities(npcAbilities, npcCR)
    }

    generateNpcAttributes(npcRace, npcSubtype, npcCR) {
	console.log("race: " + npcRace + ", subtype: " + npcSubtype + ", " + npcCR);
        const raceData = npcGenGPTDataStructure.raceData[npcRace];
        const subtypeData = npcGenGPTDataStructure.subtypeData[npcSubtype];
        const measureUnits = game.settings.get(COSTANTS.MODULE_ID, "movementUnits") ? 'm' : 'ft';
        return {
            hp: npcGenGPTLib.getNpcHp(npcCR, this.data.abilities.con.value, raceData.size),
            ac: npcGenGPTLib.getNpcAC(npcCR),
            spellcasting: subtypeData[npcSubtype]?.spellcasting && 'int',
            movement: { ...((measureUnits === 'm') ? npcGenGPTLib.convertToMeters(raceData.movement) : raceData.movement), units: measureUnits },
            senses: { ...((measureUnits === 'm') ? npcGenGPTLib.convertToMeters(raceData.senses) : raceData.senses), units: measureUnits }
        }
    }

    generateNpcSkills(npcRace, npcSubtype) {
        const { pool: defaultPool, max } = npcGenGPTDataStructure.subtypeData[npcSubtype].skills;
        const pool = (npcRace === 'elf' || npcRace === 'drow')
            ? npcGenGPTLib.getRandomFromPool(defaultPool.filter(skill => skill !== 'prc'), max).concat('prc')
            : npcGenGPTLib.getRandomFromPool(defaultPool, max);

        return pool.reduce((acc, el) => {
            acc[el] = { value: 1, ability: npcGenGPTLib.getSkillAbility(el) };
            return acc;
        }, {});
    }

    generateNpcTraits(npcRace, npcSubtype) {
        const languages = (npcGenGPTDataStructure.raceData[npcRace].lang || []).slice();
        const subtypeLanguages = (npcGenGPTDataStructure.subtypeData[npcSubtype].lang || []).slice();
        for (const subLang of subtypeLanguages) if (!languages.includes(subLang)) languages.push(subLang);
        if (npcRace === 'human' || npcRace === 'halfelf') {
            languages.push(npcGenGPTLib.getRandomFromPool(npcGenGPTDataStructure.languagesList.filter(lang => !languages.includes(lang)), 1)[0]);
        }
        return {
            languages: languages,
            size: npcGenGPTDataStructure.raceData[npcRace].size
        }
    }
}
