import { Log } from 'meteor/convexset:log';

const serverCollection = new Mongo.Collection("log");

// set-up logging on the server
Log.storeServerMessages({
	collection: serverCollection,
	timeToLiveInHours: 24,
	additionalLoggingPredicate: () => true,
	publications: [{
		pubName: "log",
	}]
});
serverCollection.remove({});
Log.info(5, "----------------------------------------------\nLog messages on the server will now be stored.\n----------------------------------------------");
