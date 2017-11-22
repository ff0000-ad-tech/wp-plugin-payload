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


function buildImports(paths, importPath) {
	var result = '';
	paths.forEach((_path) => {
		result += `import '${importPath}/${_path}'\n`;
	});
	return result;
}






/* -- INLINE IMPORTS -----------------------------
 *
 *
 */
function updateInlineImports(entry) {
	log('Updating inline-imports');
	var imports = '';

	// build preloader-image imports
	imports += buildInlineImports(
		entry.assets.source,
		entry.assets.importPath,
		entry.assets.requestPath
	);

	// write payload entry target
	writeEntry(entry.target, imports);
}

function buildInlineImports(paths, importPath, requestPath) {
	// provide InlineSrc module to window
	var result = 
		`import { InlineSrc } from 'ad-assets'\n` +
		`window.InlineSrc = InlineSrc\n\n`;

	// import each asset & add to InlineSrc
	paths.forEach((_path) => {
		const assetPath = `${importPath}/${_path}`;
		const assetName = varname.camelback(
			path.basename(_path).split('.')[0]
		);
		result += 
			`import ${assetName} from '${assetPath}'\n` +
			`InlineSrc.add(` +
				`'${requestPath}/${_path}', ` +
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