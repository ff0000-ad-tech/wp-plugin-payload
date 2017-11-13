const _ = require('lodash');
const path = require('path');
const prependHttp = require('prepend-http');

const debug = require('debug');
var log = debug('wp-plugin-settings:environments');
var logg = debug('wp-plugin-settings:environments:+');



// Requested Environment
function getRequested(settings, deploy) {
	log('Getting requested environment:');
	if (!deploy.ad.environment) {
		deploy.ad.environment = getEnvironment(
			settings,
			settings.adParams.environmentId
		);
	}
	log(deploy.ad.environment)
	return deploy;
}
function getEnvironment(settings, environmentId) {
	for (var i in settings.environments) {
		if (environmentId == settings.environments[i].id) {
			return settings.environments[i];
		}
	}
}


// Deploy Paths - where assets are to on the filesystem
// Ad Paths - where the ad looks for assets
function setPaths(settings, deploy) {
	log('Setting Deploy Paths:');
	// generate a debug-path
	var debugRunPath = prependHttp(
		`${deploy.paths.debug.domain}${deploy.paths.debug.path}`
	);

	// absolutely-pathed deploys, like "http://something..."
	if (deploy.ad.environment.runPath.match(/^http/)) {
		log(' ABSOLUTELY-PATHED');
		deploy.context.deploy = path.normalize(`${deploy.context.deploy}/${deploy.ad.size}`);
		deploy.paths.run = {
			live: path.normalize(`${deploy.ad.environment.runPath}/${deploy.ad.size}`),
			debug: path.normalize(`${debugRunPath}/${deploy.ad.size}`),
			ad: ''
		};
	}

	// relatively-pathed deploys
	else {
		log(' RELATIVELY-PATHED');

		// SHARED ADLIB: "../"
		if (deploy.ad.environment.runPath == '../') {
			log('  - shared "_adlib/"');
			deploy.context.deploy += '';
			deploy.paths.run = {
				live: deploy.ad.environment.runPath,
				debug: debugRunPath,
				ad: deploy.ad.size
			};
		}

		// SELF-CONTAINED: "./" or ""
		else if (deploy.ad.environment.runPath == './' || deploy.ad.environment.runPath == '') {
			log('  - self-contained');
			deploy.context.deploy = path.normalize(`${deploy.context.deploy}/${deploy.ad.size}`);
			deploy.paths.run = {
				live: deploy.ad.environment.runPath,
				debug: path.normalize(`${debugRunPath}/${deploy.ad.size}`),
				ad: ''
			};
		}
	}
	log(deploy.paths);
	return deploy;
}






module.exports = {
	getRequested,
	setPaths
};