define(function() {

  var localStorageTransportHandler = _.extend({

    _NAME: 'localStorageTransportHandler',    
    
    deliver: function(msg, channel) {
      console.log(msg);
    },

    saveState: function(state, channel, courseID) {
      console.log('localStorageTransportHandler Saving state!!');
      console.log(JSON.stringify(state));
      localStorage.setItem(courseID + '_state',JSON.stringify(state));
    },

    loadState: function(channel, courseID) {
	    console.log('loading state');
	    console.log(JSON.stringify(localStorage.getItem(courseID + '_state')));
    	return $.parseJSON(localStorage.getItem(courseID + '_state'));
    }

  }, Backbone.Events);

  return (localStorageTransportHandler);
});
