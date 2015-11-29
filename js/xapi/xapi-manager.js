define([ 'coreJS/adapt',
         './xapiwrapper.min' 
], function( Adapt) {

  var XapiManager = _.extend({

    courseID: null,
    registration: null,
    actor: null,
    xapiCustom: { verbs: {}, activityTypes: {} },
    actorIsRandom: null,
    _xapiChannels: [],
    _wrappers: {}, 

    initialize: function() {
      this.autoSetActor();
      this.setXapiCustom();
    },

    autoSetActor: function() {
      var randActor = { name: 'Random User', objectType: 'Agent'};
      // If the actor was passed on the query string, it's already in the
      // 'default' XAPIWrapper.lrs.actor
      // We should immediately 'clean' the query string in the route ( how? )
      if (_.has(ADL.XAPIWrapper.lrs, 'actor')) {
        this.actor = JSON.parse(ADL.XAPIWrapper.lrs.actor); 
        this.actorIsRandom = false;
      } else {  
        randActor.name = 'Random User';
        randActor.mbox = 'mailto:' + ADL.ruuid() + '@randomusers.com';
        this.actor = randActor;
        this.actorIsRandom = true;
      }
    },

    addXapiChannel: function(channel) {
      var conf = {};
      this._xapiChannels.push(channel);
      _.extend(conf, {"endpoint": channel._transport._endpoint} );
      _.extend(conf, {"auth": "Basic "
        + toBase64(channel._transport._auth._username + ":"
        + channel._transport._auth._password) });
      this._wrappers[channel._name] = new XAPIWrapper(conf, false);
    },

    setActor: function(actorObj) {
      // Allow external code to set the actor
    },

    setXapiCustom: function() {
      // tcr stands for TinCan Registry: https://registry.tincanapi.com/
      this.xapiCustom.verbs['tcr_viewed'] = new ADL.XAPIStatement.Verb(
        "http://id.tincanapi.com/verb/viewed",
        {"en-US":"viewed"});
      this.xapiCustom.verbs['tcr_launched'] = new ADL.XAPIStatement.Verb(
        "http://adlnet.gov/expapi/verbs/launched",
        { "en-US": "launched" });
    }
  }, Backbone.Events);

  XapiManager.initialize();
  return XapiManager;
});
