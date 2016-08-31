Package.describe({
  // [validatis:stack]
  name: 'convexset:log',
  version: '0.1.4_2',
  summary: 'A logging package that supports productive development and debugging in production',
  git: 'https://github.com/convexset/meteor-log',
  documentation: '../../README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.3.3');
  api.use(['ecmascript', 'ejson', 'ddp']);
  api.use('tmeasday:check-npm-versions@0.3.1');
  api.mainModule('log.js');
});
