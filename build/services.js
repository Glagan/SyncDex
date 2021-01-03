#!/usr/bin/env node

const fs = require('fs');
const rimraf = require('rimraf');
const path = require('path');
const services = require('../services.json');
const { reverse } = require('dns');

// Paths

const scssPath = path.resolve('css/Services.scss');
const namesPath = path.resolve('src/Service/Names.ts');
const keysPath = path.resolve('src/Service/Keys.ts');
const serviceMapPath = path.resolve('src/Service/Map.ts');

// Generate SCSS file

const maps = [];
function scssMap(name, elements) {
	let result = `$${name}: (\n`;
	Object.keys(elements).forEach((key) => {
		result = `${result}\t'${key}': ${elements[key]},\n`;
	});
	result = `${result});`;
	maps.push(result);
}

// Main map
scssMap(
	'services',
	services.reduce((acc, def) => {
		acc[def.key] = `'${def.name}'`;
		return acc;
	}, {})
);

// Colors
['light', 'dark'].forEach((theme) => {
	const affix = theme == 'dark' ? '-dark' : '';
	const fonts = { primary: [], secondary: [] };
	const backgrounds = [];
	services.forEach((def) => {
		if (def.theme[theme] !== undefined) {
			if (def.theme[theme].font) {
				if (typeof def.theme[theme].font === 'object') {
					fonts.primary.push({ key: def.key, color: def.theme[theme].font[0] });
					fonts.secondary.push({ key: def.key, color: def.theme[theme].font[1] });
				} else {
					fonts.primary.push({ key: def.key, color: def.theme[theme].font });
				}
			}
			if (def.theme[theme].background) {
				backgrounds.push({ key: def.key, color: def.theme[theme].background });
			}
		} else if (theme == 'light') {
			console.error(`Missing required light theme for ${def.name}.`);
		}
	});
	if (fonts.primary.length > 0) {
		scssMap(
			`services-color${affix}`,
			fonts.primary.reduce((acc, def) => {
				acc[def.key] = def.color;
				return acc;
			}, {})
		);
	}
	if (fonts.secondary.length > 0) {
		scssMap(
			`services-secondary${affix}`,
			fonts.secondary.reduce((acc, def) => {
				acc[def.key] = def.color;
				return acc;
			}, {})
		);
	}
	if (backgrounds.length > 0) {
		scssMap(
			`services-bg${affix}`,
			backgrounds.reduce((acc, def) => {
				acc[def.key] = def.color;
				return acc;
			}, {})
		);
	}
});

// Generate classes for names
const classes = [];
const classesMaps = ['services-color', 'services-secondary'];
services.forEach((def) => {
	if (Array.isArray(def.theme.separator)) {
		const acc = [];
		for (const sep of def.theme.separator) {
			acc.push(sep);
			const cssClass = acc.join(' .');
			let map = acc.length == 1 ? 0 : 1;
			if (def.theme.reverse) map = (map + 1) % 2;
			classes.push(`.${cssClass} { color: map.get($${classesMaps[map]}, '${def.key}'); }`);
		}
	}
});
fs.writeFileSync(scssPath, `/** Generated File */\n${maps.join('\n')}\n${classes.join('\n')}\n`);

console.info('Generated SCSS.');

// Generate Names and Keys
const nameKeys = { names: [], staticKeys: [], activableKeys: [] };
services.forEach((def) => {
	nameKeys.names.push(`\t${def.name} = '${def.name}',`);
	if (def.activable) {
		nameKeys.activableKeys.push(`\t'${def.name}' = '${def.key}',`);
	} else {
		nameKeys.staticKeys.push(`\t'${def.name}' = '${def.key}',`);
	}
});
fs.writeFileSync(
	namesPath,
	`/** Generated File */\nexport const enum ServiceName {\n${nameKeys.names.join('\n')}\n}\n`
);
const staticKeys = nameKeys.staticKeys.join('\n');
const activableKeys = nameKeys.activableKeys.join('\n');
fs.writeFileSync(
	keysPath,
	`/** Generated File */\nexport enum StaticKey {\n${staticKeys}\n}\n\nexport enum ActivableKey {\n${activableKeys}\n}\n\nexport const ServiceKey = {\n\t...StaticKey, ...ActivableKey\n};\nexport type ServiceKey = StaticKey | ActivableKey;\n`
);
console.info('Generated Name and Keys.');

// Generate global Service Map

const serviceMap = { imports: [], services: [] };
serviceMap.imports.push(`import { Service } from '../Core/Service';`);
serviceMap.imports.push(`import { ActivableKey } from './Keys';`);
services.forEach((def) => {
	if (def.activable) {
		serviceMap.imports.push(`import { ${def.name} } from './${def.name}';`);
		serviceMap.services.push(`\t[ActivableKey.${def.name}]: ${def.name},`);
	}
});

const imports = serviceMap.imports.join('\n');
const serviceMapValues = serviceMap.services.join('\n');
fs.writeFileSync(
	serviceMapPath,
	`/** Generated File */\n${imports}\n\nexport const Services: { [key in ActivableKey]: typeof Service } = {\n${serviceMapValues}\n};\n`
);
console.info('Generated Service Map.');
