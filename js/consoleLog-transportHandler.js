define(function() {

  var ConsoleLogTransportHandler = _.extend({

    _NAME: 'consoleLogTransportHandler',

    deliver: function(msg, channel) {
      console.log(msg);
    },

    saveState: function(state, channel, courseID) {
      console.log('consoleLogTransportHandler Saving state!!');
      console.log(JSON.stringify(state));
    }

  }, Backbone.Events);

  return (ConsoleLogTransportHandler);
});
