define([
        'coreJS/adapt',
       ],
       function(Adapt) {

  var DefaultChannelHandler = _.extend({

    trackingHub: null,
    _NAME: 'defaultChannelHandler',
    _OWNSTATEKEY: 'basic',
    _OWNSTATE: null,
    _currentlyShownPage: null,   // added by pab

    initialize: function() {
      console.log('Initializing ' + this._NAME);
      this.listenToOnce(this.trackingHub, 'stateReady', this.onStateReady);
    },

    processEvent: function(channel, eventSourceName, eventName, args) {
      // In this particular channel handler we want a pretty centralized processing of all events:
      // On every event, we're going to:
      //    - compose & deliver the messages (if configured to do so, i.e. there's a composer defined for this channel)
      //    - update our internal state representation
      //    - save state (if configured to do so, i.e. if this channel _isStateStore is true)
      var composer = null;
      var message = null;

      // deliver the message
      composer = this.trackingHub.getComposerFromComposerName(channel._msgComposerName);
      if (composer) {
          message = composer.compose(eventSourceName, eventName, args);
      }
      if (message) {
          this.deliver(message, channel);
      }
      // ALL EVENTS UPDATE the state and save, SO WE CAN DO IT HERE!
      // do common processing for all events:
      this.updateState();
      // call specific event handling function, if it exists 
      funcName = this.trackingHub.getValidFunctionName(eventSourceName, eventName);
      // console.log('funcName = ' + funcName);
      // We only need to write event handling functions for the events that we care about
      // see "Specific event processing functions" section below
      if (this.hasOwnProperty(funcName)) {
        this[funcName](args);
      }
      // the fact that there's no method to handle a specific event is NOT an error, it's simply that this ChanneHandler doesn't care  about that event.
    },

    deliver: function(message, channel) {
        // here show message.text, message
        console.log('defaultChannelHandler: ', message.text, message);
    },

    /*******************************************
    /*******  LAUNCH SEQUENCE  FUNCTIONS *******
    /*******************************************/

    startLaunchSequence: function() {
      // This default channelHandler should ONLY manage the launch sequence if it's used in isolation (no other channels).
      // This handler stores the state in localStorage. There's no need to manage userIDs or anything like that
      // If this channel is used along other channel who store the state, the other channel will normally be the launch manager
      // and will take care of identifying the user.
      console.log('defaultChannelHandler: starting launch sequence...');
      console.log('defaultChannelHandler: launch sequence finished');
      this.trigger('launchSequenceFinished');
    },

    /*******  END LAUNCH SEQUENCE FUNCTIONS *******/


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
      this._OWNSTATE = this.trackingHub._state[this._OWNSTATEKEY]; // the part of state that THIS channelHandler manages...
    },

    updateState: function() {
      // In this CH, a function to update the whole state at once is useful because we're going to have to do this constantly.
      // This representation is just a 'snapshot' of some attributes of all the components
      this._OWNSTATE = this.getUpdatedLocalState();
      this.trackingHub._state[this._OWNSTATEKEY] = this._OWNSTATE ;
    },

    getUpdatedLocalState: function() {
      // Our state representation (localState) is an object whose keys are the ids of the components, and the values are objects
      // with the attributes that begin with '_'.
      var localState = {};
      _.each(Adapt.components.models, function(component) {
        var componentID = component.get('_id');
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

        localState[componentID] = {};
        _.each(atts, function(attName) {
            if (_.has(component.attributes, attName)) {
                localState[componentID][attName] = component.get(attName);
            }
        }, this);
      }, this);

      return localState;
    },

    saveState: function(state, channel, courseID) {
      // IF we want this channelHandler to be  capable of saving state, we have to implement this function.
      // THIS FUNCTION is always called from this.trackingHub NOT FROM WITHIN THIS CHANNEL HANDLER!
      localStorage.setItem('state_'+ courseID, JSON.stringify(this.trackingHub._state));
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
            var componentID = component.get('_id');
            var stateAtts = localState[componentID];
            _.each(stateAtts, function(value, key, list) {  //stateAtts is an object, not a list!
                component.set(key, value);
            }, this);
          }, this);
          console.log('defaultChannelHandler state applied to structure...');
      }
    },

    /*******  END STATE MANAGEMENT FUNCTIONS ********/


    /**************************************************
     *****  Specific event processing functions   *****
     **************************************************/

    // no need to do any specific event processing in this channel handler.

    /*******  END SPECIFIC EVENT PROCESSING FUNCTIONS ********/

  }, Backbone.Events);
  
  DefaultChannelHandler.initialize();
  return (DefaultChannelHandler);
});
