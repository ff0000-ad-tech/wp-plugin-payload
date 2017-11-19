const _ = require('lodash');
const fs = require('fs');
const path = require('path');

const debug = require('debug');
var log = debug('wp-plugin-settings:payload');


function buildImports(paths) {
	log('buildImports');
	var result = '';
	paths.forEach((_path) => {
		result += `import '${_path}'\n`;
	});
	return result;
}

function writeEntry(path, contents) {
	log('writing payload imports:', path);
	try {
		fs.writeFileSync(path, contents);
	}
	catch (err) {
		log(err);
	}
}


module.exports = {
	buildImports,
	writeEntry
};