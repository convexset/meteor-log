Package.describe({
	// [validatis:stack]
	name: 'convexset:log',
	version: '0.1.5_6',
	summary: 'A logging package that supports productive development and debugging in production',
	git: 'https://github.com/convexset/meteor-log',
	documentation: '../../README.md'
});

Package.onUse(function pkgSetup(api) {
	api.versionsFrom('1.4.1');
	api.use(['ecmascript', 'ejson', 'ddp', 'tracker']);
	api.use('tmeasday:check-npm-versions@0.3.1');
	api.mainModule('log.js');
});
