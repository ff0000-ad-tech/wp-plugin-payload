const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const varname = require('varname');

const debug = require('debug');
var log = debug('wp-plugin-payload:importer');




/* -- PAYLOAD IMPORTS -----------------------------
 *
 *
 */
function updateImports(entry, deploy) {
	if (!entry.target) return;

	log(`Updating ${entry.name}-imports`);
	var imports = '';
	// build image imports
	imports += buildImports(
		entry.assets.source,
		entry.assets.importPath
	);				

	// write payload entry target
	writeEntry(entry.target, imports);
}


function buildImports(paths, subpath) {
	var result = '';
	paths.forEach((_path) => {
		result += `import '${subpath}/${_path}'\n`;
	});
	return result;
}






/* -- INLINE IMPORTS -----------------------------
 *
 *
 */
function updateInlineImports(entry, deploy) {
	log('Updating inline-imports');

	// no inline entry!!
	if (!entry) {
		log('Cannot inline assets!! No entry specified (compiler.options.entry.inline)');
		deploy.inline.preloader = false;
	}
	// update inline entry
	else {
		var imports = '';

		// build preloader-image imports
		imports += buildInlineImports(
			deploy.settings.assets.preloader.images.map((obj) => { return obj.source }),
			'./images',
			deploy
		);


		// write payload entry target
		writeEntry(entry, imports);
	}
}

function buildInlineImports(paths, subpath, deploy) {
	// provide InlineSrc module to window
	var result = 
		`import { InlineSrc } from 'ad-assets'\n` +
		`window.InlineSrc = InlineSrc\n\n`;

	// import each asset & add to InlineSrc
	paths.forEach((_path) => {
		const assetPath = `${subpath}/${_path}`;
		const assetName = varname.camelback(
			path.basename(_path).split('.')[0]
		);
		result += 
			`import ${assetName} from '${assetPath}'\n` +
			`InlineSrc.add(` +
				`'${deploy.env.paths.run.live}${deploy.env.paths.ad.images}/${_path}', ` +
				`${assetName}` +
			`)\n`;
	});
	return result;
}








function writeEntry(path, contents) {
	log(' writing entry:', path);
	try {
		fs.writeFileSync(path, contents);
	}
	catch (err) {
		log(err);
	}
}


module.exports = {
	updateImports,
	updateInlineImports
};