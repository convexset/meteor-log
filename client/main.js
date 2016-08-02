import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Log } from 'meteor/convexset:log';

import './main.html';

Meteor.subscribe("log");
const serverCollection = new Mongo.Collection("log");

Template.info.helpers({
	clientLogData: () => ({
		logEntries: Log.allRecords,
		tableAttributes: {
			border: 1
		}
	}),
	serverLogData: () => ({
		logEntries: serverCollection.find().fetch(),
		tableAttributes: {
			border: 2
		}
	})
});
