const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const varname = require('varname');

const debug = require('debug');
var log = debug('wp-plugin-payload:importer');




function updatePayloadImports(entry, deploy) {
	log('Updating payload-imports');
	var imports = '';
	// build image imports
	imports += buildImports(
		deploy.settings.assets.images,
		'./images'
	);

	/** 
	 *		!!! Need to setup Webpack-loaders for supported fonts 
	 *
	// build font imports
	imports += buildImports(
		deploy.settings.assets.fonts,
		'../_adlib/common/fonts'
	);
	 *
	 */

	// write payload entry target
	writeEntry(entry, imports);
}

function buildImports(paths, subpath) {
	var result = '';
	paths.forEach((_path) => {
		result += `import '${subpath}/${_path}'\n`;
	});
	return result;
}




function updateInlineImports(entry, deploy) {
	log('Updating inline-imports');
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
				`'${deploy.paths.run.live}${deploy.paths.ad.images}/${_path}', ` +
				`${assetName}` +
			`)\n`;
	});
	return result;
}




function writeEntry(path, contents) {
	log('writing entry:', path);
	try {
		fs.writeFileSync(path, contents);
	}
	catch (err) {
		log(err);
	}
}


module.exports = {
	updatePayloadImports,
	updateInlineImports
};