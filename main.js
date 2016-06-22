import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

import { Log } from "meteor/convexset:log";


/* global _Log: true */
/* global _check: true */
Meteor.startup(function() {
	if (Meteor.isDevelopment) {
		_Log = Log;
		_check = check;
	}
});


Log.registerException("invalid-argument", "Your argument is invalid.");
Log.registerException("not-a-number", function nanMessage(item) {
	return `${item} is not a number.`;
});
Log.registerException("item-out-of-range", function oorMessage({
	validRange, item
}) {
	return `Item out of range (item: ${item}, valid range: ${validRange})`;
});

var serverCollection = new Mongo.Collection("log");

const TEST_EXCEPTIONS_IN_CALLBACKS = true;
if (TEST_EXCEPTIONS_IN_CALLBACKS) {
	Meteor.setTimeout(function invalidArgumentTest() {
		try {
			Log.throwException("invalid-argument");
		} catch(e) {
			console.log('[Caught]', e);
		}
	}, Math.random() * 10000);

	Meteor.setTimeout(function notANumberTest() {
		(function someRecursiveThing(dp = 0) {
			if (Math.random() < 0.25 + dp) {
				Log.throwException("not-a-number", "9", {
					logLevel: "warn", // valid choices: "log", "info", "warn", "error"
					verbosity: 7
				});
			} else {
				someRecursiveThing(dp + 0.05);
			}
		})();
	}, Math.random() * 10000);

	Meteor.setTimeout(function itemOutOfRangeTest() {
		Log.throwException("item-out-of-range", {
			item: 10,
			validRange: [0, 1]
		}, {
			logLevel: "error", // valid choices: "log", "info", "warn", "error"
			verbosity: 3
		});
	}, Math.random() * 10000);
}

if (Meteor.isClient) {
	Meteor.subscribe("log");

	Template.info.helpers({
		clientLog: () => Log.allRecords.map(x => EJSON.stringify(x)),
		serverLog: () => serverCollection.find().map(x => EJSON.stringify(x)),
	});
}


if (Meteor.isServer) {
	Log.storeServerMessages({
		collection: serverCollection,
		timeToLiveInHours: 24,
		additionalLoggingPredicate: () => true,
		publications: [{
			pubName: "log",
		}]
	});

	Meteor.startup(function() {
		serverCollection.remove({});
	})
}