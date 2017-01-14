define([
        'coreJS/adapt',
        './defaultMessageComposer',
], function(Adapt, msgComposer) {

  var DefaultChannelHandler = _.extend({

    _NAME: 'defaultChannelHandler',
    _OWNSTATEKEY: 'basic',
    _OWNSTATE: null,

    initialize: function() {
      console.log('Initializing defaultChannelHandler');
      this.listenToOnce(Adapt.trackingHub, 'stateReady', this.onStateReady);
    },

    /*******************************************
    /*******  LAUNCH SEQUENCE  FUNCTIONS *******
    /*******************************************/

    startLaunchSequence: function() {
      // This default channelHandler should ONLY manage the launch sequence if it's used in isolation (no other channels).
      // This handler stores the state in localStorage. 
      // In general, the launch sequence determines de identity of the user. This CH, since it doesn't really do a launch sequence,
      // we just set up a hardcoded user identity
      // If this channel is used along other channel that stores the state, the other channel will normally be the launch manager
      console.log('defaultChannelHandler: starting launch sequence...');
      console.log('defaultChannelHandler: launch sequence finished');
      Adapt.trackingHub.userInfo.mbox =  'mailto:somebody@example.com';
      // mbox_sha1sum , openid, account

      this.trigger('launchSequenceFinished');

      // AT THE END OF THE LAUNCH SEQUENCE TRACKINGhUB SHOULD HAVE AN ACTOR property?
    },

    /*******  END LAUNCH SEQUENCE FUNCTIONS *******/

    
    processEvent: function(channel, eventSourceName, eventName, args) {
      // In this particular channel handler we want a pretty centralized processing of all events:
      // On every event, we're going to:
      //    - compose & deliver the message corresponding to this event (if configured to do so, i.e. this channel isEventTracker is true )
      //    - update our internal state representation

      // msgComposer is a reference to the message composer that this particular channel handler uses.
      message = msgComposer.compose(eventSourceName, eventName, args)
      if (message) {
          this.deliverMsg(message, channel);
      }

      // call specific event handling function for the event being processed, if it exists 
      funcName = Adapt.trackingHub.getValidFunctionName(eventSourceName, eventName);
      // console.log('funcName = ' + funcName);
      // We only need to write event handling functions for the events that we care about
      // In this particular channes handler we don't need to do any specific processing for particular events.
      // In other channel handlers, the 'specific processing' would in ois
      if (this.hasOwnProperty(funcName)) {
        this[funcName](args);
      }
      // the fact that there's no method to handle a specific event is NOT an error, it's simply that this ChanneHandler doesn't care  about that event.

      // If there's any common processing that we need to do, no matter what event happened, do it here.
      // In this particular channel handler, all events will just cause an update of the internal state representation
      this.updateState();
    },


    deliverMsg: function(message, channel) {
       // here show message.text, message
       console.log('defaultChannelHandler: ', message.text, message);
    },


    /*******************************************
    /*******  STATE MANAGEMENT FUNCTIONS *******
    /*******************************************/

    initializeState: function(newUserID) {
        // Normally, this function would initialize our own state representation. That would be: state.basic
        // But in this channelHandler we're NOT going to keep an internal representation per se, because we don't need
        // to use specific state structures. When saving, we'll just save some attributes from the components.

        return this.getUpdatedLocalState();
    },

    onStateReady: function() {
      this._OWNSTATE = Adapt.trackingHub._state[this._OWNSTATEKEY]; // the part of state that THIS channelHandler manages...
    },

    updateState: function() {
      // In this CH, a function to update the whole state at once is useful because we're going to have to do this constantly.
      // This representation is just a 'snapshot' of some attributes of all the components
      this._OWNSTATE = this.getUpdatedLocalState();
      Adapt.trackingHub._state[this._OWNSTATEKEY] = this._OWNSTATE ;
    },

    getUpdatedLocalState: function() {
      // Our state representation (localState) is an object whose keys are the ids of the components, and the values are objects
      // with the attributes that begin with '_'.
      var localState = {};
      _.each(Adapt.components.models, function(component) {
        // var componentID = component.get('_id');
        var compTitleKey = Adapt.trackingHub.titleToKey(component.get('title'));
        // These are the attributes that we want to save (if they exist in the component)
        var atts = [
                    '_canReset',
                    '_canShowFeedback',
                    '_isAvailable',
                    '_isComplete',
                    '_isEnabled',
                    '_isInteractionComplete',
                    '_isLocked',
                    '_isOptional',
                    '_isResetOnRevisit',
                    '_isVisible',
                    '_requireCompletionOf',

                    '_attempts',
                    '_canShowMarking',
                    '_canShowModelAnswer',
                    '_isAtLeastOneCorrectSelection',
                    '_isRandom',
                    '_isSubmitted',
                    '_questionWeight',
                    '_shouldDisplayAttempts',
                    '_userAnswer',
        ]

        //localState[componentID] = {};
        localState[compTitleKey] = {};
        _.each(atts, function(attName) {
            if (_.has(component.attributes, attName)) {
                //localState[componentID][attName] = component.get(attName);
                localState[compTitleKey][attName] = component.get(attName);
            }
        }, this);
      }, this);

      return localState;
    },

    saveState: function(state, channel, courseID) {
      // IF we want this channelHandler to be  capable of saving state, we have to implement this function.
      // IMPORTANT: this function is always called from trackingHub NOT from within this channel handler!
      localStorage.setItem('state_'+ courseID, JSON.stringify(Adapt.trackingHub._state));
      //Adapt.trigger('defaultChannelHandler:saveStateSucceded');
      console.log('defaultChannelHandler: state saved');
    },

    loadState: function(channel, courseID) {
      var localState = null;
      var fullState = $.parseJSON(localStorage.getItem('state_' + courseID));
      if (!fullState) {
          fullState = {};
          var userID = localStorage.getItem('UserID')
          localState = this.initializeState(userID);
          fullState[this._OWNSTATEKEY] = localState;
      }
      this._OWNSTATE = fullState[this._OWNSTATEKEY];
      console.log('defaultChannelHandler: state loaded');
      this.trigger('stateLoaded', fullState);
    },

    applyStateToStructure: function() {
      var localState = this._OWNSTATE;
      // Walk through all components, and update its '_' attributes with what ther is in localState.
      // process each item in localState, which is a component
      if (localState) {
          _.each(Adapt.components.models, function(component) {
            //var componentID = component.get('_id');
            var compTitleKey = Adapt.trackingHub.titleToKey(component.get('title'));
            //var stateAtts = localState[componentID];
            var stateAtts = localState[compTitleKey];
            _.each(stateAtts, function(value, key, list) {  //stateAtts is an object, not a list!
                component.set(key, value );
            }, this);
          }, this);
          console.log('defaultChannelHandler state applied to structure...');
      }
    },

    /*******  END STATE MANAGEMENT FUNCTIONS ********/



    /*******************************************
    /*** SPECIFIC EVENT PROCESSING FUNCTIONS ***
    /*******************************************/

    // no need to do any specific event processing in this channel handler.

    /*******  END SPECIFIC EVENT PROCESSING FUNCTIONS ********/

  }, Backbone.Events);
  
  DefaultChannelHandler.initialize();
  return (DefaultChannelHandler);
});
