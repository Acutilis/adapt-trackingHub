define(function() {

  var LocalStorageTransportHandler = _.extend({

    _NAME: 'localStorageTransportHandler',

    deliver: function(msg, channel) {
      console.log(msg);
    },

    saveState: function(state, channel, courseID) {
      var state_str = JSON.stringify(state);
      console.log('localStorageTransportHandler saving state' + state_str );
      localStorage.setItem('state_' + courseID , state_str);
    },

    loadState: function(channel, courseID) {
        console.log('localStorageTransportHandler loading state ' + 'state_' + courseID);
        return $.parseJSON(localStorage.getItem( 'state_' + courseID));
    }

  }, Backbone.Events);

  return (LocalStorageTransportHandler);
});
