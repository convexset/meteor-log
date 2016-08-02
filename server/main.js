const serverCollection = new Mongo.Collection("log");

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
