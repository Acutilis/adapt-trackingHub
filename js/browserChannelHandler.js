define([
        'coreJS/adapt',
        './jsonMessageComposer',
], function(Adapt, msgComposer) {

  var BrowserChannelHandler = _.extend({

    _CHID: 'browserChannelHandler',
    _OWNSTATEKEY: 'basic',
    _OWNSTATE: null,

    initialize: function() {
      console.log('Initializing browserChannelHandler');
      this.listenToOnce(Adapt.trackingHub, 'stateReady', this.onStateReady);
    },

    /*******************************************
    /*******      CONFIG  FUNCTIONS      *******
    /*******************************************/


    checkConfig: function() {
      // this special handler must implement this function, like all handlers. But in this case, it always returns true
        return true;
    },

    getChannelDefinitions: function() {
    },

    /*******  END CONFIG FUNCTIONS *******/


    /*******************************************
    /*******  LAUNCH SEQUENCE  FUNCTIONS *******
    /*******************************************/

    startLaunchSequence: function(channel, courseID) {
      // This browser channelHandler should ONLY manage the launch sequence if it's used in isolation (no other channels).
      // This handler stores the state in localStorage.
      // In general, the launch sequence determines de identity of the user. Since this CH doesn't really do a launch sequence,
      // we just set up a hardcoded user identity
      // If this channel is used along other channel that stores the state, the other channel will normally be the launch manager
      console.log('browserChannelHandler: starting launch sequence...');
      console.log('browserChannelHandler: launch sequence finished');
      Adapt.trackingHub.userInfo.mbox =  'mailto:somebody@example.com';
      this.trigger('launchSequenceFinished');
    },

    /*******  END LAUNCH SEQUENCE FUNCTIONS *******/


    processEvent: function(channel, eventSourceName, eventName, args) {
      // In this particular channel handler we want a pretty centralized processing of all events:
      // On every event, we're going to:
      //    - compose & deliver the message corresponding to this event (if configured to do so, i.e. this channel isEventTracker is true )
      //    - update our internal state representation

      // msgComposer is a reference to the message composer that this particular channel handler uses.
      // if REPORTS events and ! ignored!
      var isEventIgnored = _.contains(channel._ignoreEvents,eventName);
      if ( !isEventIgnored && channel._reportsEvents ) {
        message = msgComposer.compose(eventSourceName, eventName, args)
        if (message) {
          this.deliverMsg(message, channel);
        }
      }
      // call specific event handling function for the event being processed, if it exists
      funcName = Adapt.trackingHub.getValidFunctionName(eventSourceName, eventName);
      // We only need to write event handling functions for the events that we care about
      // In this particular channes handler we don't need to do any specific processing for particular events.
      if (this.hasOwnProperty(funcName)) {
        this[funcName](args);
      }
      // the fact that there's no method to handle a specific event is NOT an error, it's simply that this ChanneHandler doesn't care  about that event.

      // If there's any common processing that we need to do, no matter what event happened, do it here.
      // In this particular channel handler, all events will just cause an update of the internal state representation
      this.updateState();
    },


    deliverMsg: function(message, channel) {
       console.log('browserChannelHandler: ', message.text, message);
    },


    /*******************************************
    /*******  STATE MANAGEMENT FUNCTIONS *******
    /*******************************************/

    initializeState: function() {
        // Normally, this function would initialize our own state representation, that is, it would set up a custom
        // object with some keys and initial values that would be updated as the user progresses.
        // But in this channelHandler, our state representation is a dump of several attributes for each component, and it
        // gets re-built every time. There's no need to pre-initialize anything.
        return this.getUpdatedLocalState();
    },

    onStateReady: function() {
      this._OWNSTATE = Adapt.trackingHub._state[this._OWNSTATEKEY]; // the part of state that THIS channelHandler manages.
    },

    updateState: function() {
      // In this CH, a function to update the whole state at once is useful because we're going to have to do this constantly.
      // This representation is just a 'snapshot' of some attributes of all the components
      if (!this._config._tracksState)
          return;
      this._OWNSTATE = this.getUpdatedLocalState();
      Adapt.trackingHub._state[this._OWNSTATEKEY] = this._OWNSTATE ;
    },

    getUpdatedLocalState: function() {
      // Our state representation (localState) is an object with collections for the major
      // model types. Each collections keys are the titles of the components, (or ids,
      // depending on config. titles are the default, and preferred) and the values are
      // objects with the attributes that begin with '_'.
      var localState = {
        contentObjects: {},
        articles: {},
        blocks: {},
        components: {}
      };

      // These are the attributes that we want to save (if they exist in the component)
      var componentProps = [
        '_canReset', '_canShowFeedback', '_isAvailable', '_isComplete', '_isEnabled',
        '_isInteractionComplete', '_isLocked', '_isOptional', '_isResetOnRevisit',
        '_isVisible', '_requireCompletionOf', '_attempts', '_canShowMarking',
        '_canShowModelAnswer', '_isAtLeastOneCorrectSelection', '_isRandom',
        '_isSubmitted', '_questionWeight', '_shouldDisplayAttempts', '_userAnswer'
      ];
      _.each(Adapt.components.models, function(component) {
        var key = Adapt.trackingHub.getElementKey(component);
        localState.components[key] = _.pick(component.attributes, componentProps);
      }, this);

      var blockProps = [
        '_isComplete', '_isInteractionComplete', '_isLocked'
      ];
      _.each(Adapt.blocks.models, function(block) {
        var key = Adapt.trackingHub.getElementKey(block);
        localState.blocks[key] = _.pick(block.attributes, blockProps);
      });

      var articleProps = [
        '_isComplete', '_isInteractionComplete', '_isLocked', '_questions',
        '_attemptInProgress', '_attemptsLeft', '_attemptsSpent', '_isAssessmentComplete',
        '_scoreAsPercent', '_score', '_lastAttemptScoreAsPrecent', '_isPass', '_maxScore'
      ];
      _.each(Adapt.articles.models, function(article) {
        var key = Adapt.trackingHub.getElementKey(article);
        localState.articles[key] = _.pick(article.attributes, articleProps);
      });

      var contentProps = [
        '_isComplete', '_isInteractionComplete', '_isLocked', '_isVisited'
      ];
      _.each(Adapt.contentObjects.models, function(contentObject) {
        var key = Adapt.trackingHub.getElementKey(contentObject);
        localState.contentObjects[key] = _.pick(contentObject.attributes, contentProps);
      });

      return localState;
    },

    saveState: function(state, channel, courseID) {
      // IF we want this channelHandler to be  capable of saving state, we have to implement this function.
      // IMPORTANT: this function is always called from trackingHub NOT from within this channel handler!
      localStorage.setItem('state_'+ courseID, JSON.stringify(Adapt.trackingHub._state));
      console.log('browserChannelHandler: state saved');
    },

    loadState: function(channel, courseID) {
      var localState = null;
      var fullState = $.parseJSON(localStorage.getItem('state_' + courseID));
      if (!fullState) {
          fullState = {};
          localState = this.initializeState();
          fullState[this._OWNSTATEKEY] = localState;
      }
      this._OWNSTATE = fullState[this._OWNSTATEKEY];
      console.log('browserChannelHandler: state loaded');
      this.trigger('stateLoaded', fullState);
    },

    applyStateToStructure: function() {
      this._OWNSTATE = Adapt.trackingHub._state[this._OWNSTATEKEY];
      var localState = this._OWNSTATE;

      if (!localState) {
        console.log('browserChannelHandler no state to apply to structure...');
        return;
      }

      // Backwards compatability with components being at root of object
      if (!localState.components) {
        localState.components = localState;
      }

      // Walk through all components, blocks, articles, and contentObjects,
      // update their '_' attributes with what there is in localState.

      _.each(Adapt.components.models, function(component) {
        var key = Adapt.trackingHub._config._identifyById ? component.get('_id') :
            Adapt.trackingHub.titleToKey(component.get('title'));
        if (_.has(localState.components, key)) {
          component.set(localState.components[key]);
        }
      }, this);

      _.each(Adapt.blocks.models, function(block) {
        var key = Adapt.trackingHub._config._identifyById ? block.get('_id') :
            Adapt.trackingHub.titleToKey(block.get('title'));
        if (_.has(localState.blocks, key)) {
          block.set(localState.blocks[key]);
        }
      }, this);

      _.each(Adapt.articles.models, function(article) {
        var key = Adapt.trackingHub._config._identifyById ? article.get('_id') :
            Adapt.trackingHub.titleToKey(article.get('title'));
        if (_.has(localState.articles, key)) {
          article.set(localState.articles[key]);
        }
      }, this);

      _.each(Adapt.contentObjects.models, function(contentObject) {
        var key = Adapt.trackingHub._config._identifyById ? contentObject.get('_id') :
            Adapt.trackingHub.titleToKey(contentObject.get('title'));
        if (_.has(localState.contentObjects, key)) {
          contentObject.set(localState.contentObjects[key]);
        }
      }, this);

      console.log('browserChannelHandler state applied to structure...');
    },

    /*******  END STATE MANAGEMENT FUNCTIONS ********/



    /*******************************************
    /*** SPECIFIC EVENT PROCESSING FUNCTIONS ***
    /*******************************************/

    // no need to do any specific event processing in this channel handler.

    /*******  END SPECIFIC EVENT PROCESSING FUNCTIONS ********/

  }, Backbone.Events);

  BrowserChannelHandler.initialize();
  return (BrowserChannelHandler);
});
