const hooksRegex = require('hooks-regex');
const requireFromString = require('require-from-string');

// define expected model with the hook-ids
var hooks = {
	adParams: 'ad_params',
	assets: 'assets',
	environments: 'environments',
	includes: 'includes',
	externalIncludes: 'external_includes',
	runtimeIncludes: 'runtime_includes'
};

function readSettings(source) {
	var settings = {};
	for (var key in hooks) {
		var matches = source.match(
			hooksRegex.get('Red', 'Settings', hooks[key])
		);
		if (matches) {
			settings[key] = requireFromString(
				`${matches.groups.content} module.exports = ${key};`
			);
		}
	}
	return settings;
}

module.exports = {
	readSettings
};