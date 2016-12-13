define(['./xapi-manager'], function(xapiManager) {

  var XapiTransportHandler = _.extend({

    _NAME: 'xapiTransportHandler',
    _STATE_ID: 'ACTIVITY_STATE',

    deliver: function(msg, channel) {
      var wrapper = xapiManager._wrappers[channel._name];
      wrapper.sendStatement(msg);
    },

    saveState: function(state, channel, courseID) {
      var wrapper = xapiManager._wrappers[channel._name];
      wrapper.sendState(xapiManager.courseID, xapiManager.actor,
        this._STATE_ID, null, state);
    },

    loadState: function(channel) {
      var state;
      var wrapper = xapiManager._wrappers[channel._name];
      var state = wrapper.getState(xapiManager.courseID, xapiManager.actor,
        this._STATE_ID);
      return (state);
    }

  }, Backbone.Events);

  return (XapiTransportHandler);
});
