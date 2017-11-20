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
function updatePayloadImports(entry, deploy) {
	// compiled-payload is requested
	if (deploy.payload.images || deploy.payload.fonts) {
		log('Updating payload-imports');

		// no payload entry!! 
		if (!entry) {
			log('Cannot compile images & fonts!! No entry specified (compiler.options.entry.payload)');
			deploy.payload.images = false;
			deploy.payload.fonts = false;
		}
		// update payload entry
		else {
			var imports = '';

			// build image imports
			if (deploy.payload.images) {
				imports += buildImports(
					deploy.settings.assets.images,
					'./images'
				);				
			}

			// build font imports
			if (deploy.payload.fonts) {
				imports += buildImports(
					deploy.settings.assets.fonts,
					'../_adlib/common/fonts'
				);
			}

			// write payload entry target
			writeEntry(entry, imports);
		}
	}
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
	// inline assets are requested
	if (deploy.inline.preloader) {
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
			if (deploy.inline.preloader) {
				imports += buildInlineImports(
					deploy.settings.assets.preloader.images.map((obj) => { return obj.source }),
					'./images',
					deploy
				);
			}

			// write payload entry target
			writeEntry(entry, imports);
		}
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
	updatePayloadImports,
	updateInlineImports
};