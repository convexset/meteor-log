Package.describe({
  // [validatis:stack]
  name: 'convexset:log-table',
  version: '0.1.0',
  summary: 'Provides a simple table for client-side data of convexset:log',
  git: 'https://github.com/convexset/meteor-log',
  documentation: '../../README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.3.3');
  api.use(['ecmascript', 'ejson']);
  api.use('convexset:log@0.1.3');

  api.use(['templating'], 'client');

  api.mainModule('table.js', 'client');
});
