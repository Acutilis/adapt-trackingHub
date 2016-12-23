define(function() {

  var DefaultChannelHandler = _.extend({

    _THUB: null,  // this will be set to the trackingHub module once this transportHandler is added.
    _NAME: 'defaultChannelHandler',
    _OWNSTATEKEY: 'basic',
    _OWNSTATE: null,
    _currentlyShownPage: null,   // added by pab

    initialize: function() {
      console.log('Initializing ' + this._NAME);
      _.bindAll(this, 'onStateLoadSuccess', 'onStateLoadError', 'onStateSaveSuccess', 'onStateSaveError');
      this.listenToOnce(this._THUB, 'stateReady', this.onStateReady);
    },

    processEvent: function(channel, eventSourceName, eventName, args) {
      // In this default channel handler we will compose messages and show them on the console
      // If we needed to compose messages, we would do:
      var composer = this._THUB.getComposerFromComposerName(channel._msgComposerName);
      var message = composer.compose(eventSourceName, eventName, args);
      // NOW DELIVER THE MESSAGE! i guess this should go into the specific event processing function
      // maybe... in the event processing we pass message... if there is message, it will 'send' it ?
      funcName = this._THUB.getValidFunctionName(eventSourceName, eventName);
      // console.log('funcName = ' + funcName);
      // We only need to write event handling functions for the events that we care about
      // see "Specific event processing functions" section below
      if (this.hasOwnProperty(funcName)) {
        this[funcName](args);
      }
      // the fact that there's no method to handle a specific event is NOT an error, it's simply that this TransportHandler doesn't care  about that event.
    },


    /*******************************************
    /*******  LAUNCH SEQUENCE  FUNCTIONS *******
    /*******************************************/

    startLaunchSequence: function() {
      // In a real-life scenario, this channelHandler should not be launchManager... but we implement some basic 'launch' functionality 
      // for when only the default trackingHub functionality is used.
      // This launch sequence is:
      //    - If there's a userID on localStorage, use that, otherwise:
      //        - delete locaStorage with key thstate_<COURSEID> if it exists, that's where we will store state
      //        - generate a random userID, place it in localStorage, and use that
      var userID = null;
      var queryUserID = this._THUB.queryString().id;
      if (queryUserID) {
        userID = queryUserID;
      } else {
        userID = localStorage.getItem('UserID');
      }
      if (!userID) {
          var userID = this._THUB.genUUID() 
          localStorage.setItem('UserID', userID);
      }
      console.log('defaultChannelHandler: launch sequence finished');
      this.trigger('launchSequenceFinished');
    },

    /*******  END LAUNCH SEQUENCE FUNCTIONS *******/


    /*******************************************
    /*******  STATE MANAGEMENT FUNCTIONS *******
    /*******************************************/

    initializeState: function(newUserID) {
        // Initializes our own state representation. That would be: state.basic
        var fullState = {};
        // OK, let's not have a specific representation of state
        // we're just going to directly save some of the attributes of the objects (those that start with '_')

        fullState[this._OWNSTATEKEY] = state
        return fullState;
    },

    onStateReady: function() {
      this._OWNSTATE = this._THUB._state[this._OWNSTATEKEY]; // the part of state that THIS transportHandler manages...
    },

    saveState: function(state, channel, courseID) {
      // IF we want this channelHandler to be  capable of saving state, we have to implement this function.
      // THIS FUNCTION is always called from trackingHub NOT FROM WITHIN THIS CHANNEL HANDLER!

      // I have the URL init here because I need the channel... BUT when this becomes a 'channelHandler'...? is that going to change?
      this._URL = channel._transport._endpoint;

      //this._THUB._state[this._OWNSTATENAME].user.lastSave = new Date().toString();  // this is _state.odilrs.user.lastSave
      // Yes THIS SHOULD be using _OWNSTATENAME BUT I'M STILL NOT MANAGING IT... JUST MANAGING THE WHOLE STATE FOR NOW.
      //
      this._OWNSTATE.user.lastSave = new Date().toString();  // this is _state.odilrs.user.lastSave
      // Unlike the originial odilrsstorage-transportHandler, I'm not saving to localStorage, only to the backend server.
      //
      // A custom Transport Handler should not trigger messages 'in the name of trackingHub' ...
      // If a custom TH needs to trigger messages on Adapt, namespace the event with a custom namespace 
      // Adapt.trigger('odilrs:savingState')
      // Adapt.trigger('trackingHub:saving'); // LOOK AT THE THEME... IT'S LISTENING TO THIS TO UPDATE SOMETHING

      var objToSend = {};
      objToSend.data = JSON.stringify(this._THUB._state); // we save the FULL state
      $.ajax({
        type: "POST",
        url: this._URL + "store.php",
        data: objToSend,
        success: this.onStateSaveSuccess,
        error: this.onStateSaveError,
      });
    },

    onStateSaveSuccess: function(ev) {
      // review the TZ theme, I think it listens for events from here.
      Adapt.trigger('odilrs:saveStateSucceded');
    },

    onStateSaveError: function(xhr, ajaxOptions, thrownError) {
      console.log("State save failed: " + thrownError);
      // Adapt.trigger('trackingHub:failed'); // Modify the theme because it's listening for this event
      Adapt.trigger('odilrs:saveStateFailed');
    },

    loadState: function(channel, courseID) {
      this._URL = channel._transport._endpoint;
      // at this point, we can be sure that there's a userID in localstorage, because that's what the launch sequence did.
      var loadID = localStorage.getItem('UserID');
      var state = null;
      var loadUrl = this._URL + 'load.php?id=' + loadID;
      $.ajax({
          url: loadUrl,
          success: this.onStateLoadSuccess,
      });
    },

    onStateLoadSuccess: function(responseText) {
       var state = $.parseJSON(responseText);
       var userID = localStorage.getItem('UserID');
       if (!state || state == {} ) {
           state = this.initializeState(userID);
       }
       console.log('odilrs: state loaded');
       this.trigger('stateLoaded', state);
    },

    onStateLoadError: function(xhr, ajaxOptions, thrownError) {
       console.log("LRS load failed " + thrownError);
       var newUserID = this.getUserID(); 
       var state = this.initializeState(newUserID);
       console.log('odilrs: state ready');
    },

    applyStateToStructure: function() {
        // if (! this._THUB._state[this._OWNSTATEKEY]) return;
        if (! this._OWNSTATE) return;
        console.log('applying '+ this._OWNSTATEKEY + ' state to structure...');
        // this function will be called from trackingHub
        // var state = this._THUB._state[this._OWNSTATEKEY]; // the part of state that THIS transportHandler manages...
        var state = this._OWNSTATE; // the part of state that THIS transportHandler manages...
        // var state = this._THUB._state; // the part of state that THIS transportHandler manages...

        // walk the hierarchy and initialize our the Adapt objects based on our state representation
        _.each(Adapt.contentObjects.models, function(contentPage) {
            var contentPageID = contentPage.get('_id');

            _.each(contentPage.get('_children').models, function(article) {
                var articleID = article.get('_id');

                _.each(article.get('_children').models, function(block) {
                    var blockID = block.get('_id');
                    block.set('_isComplete', state.blocks[blockID]);

                    _.each(block.get('_children').models, function(component) {
                        var componentID = component.get('_id');
                        component.set('_isComplete', state.components[componentID]);

                        // update Adapt object based on  state representation (answers and progress)
                        if (component.get('_userAnswer')) {
                            // answers
                            component.set('_userAnswer', state.answers[componentID]._userAnswer);
                            component.set('_isCorrect', state.answers[componentID]._isCorrect);
                            // progress.answers
                            component.set('_userAnswer', state.progress[contentPageID].answers[componentID]._userAnswer);
                            component.set('_isCorrect', state.progress[contentPageID].answers[componentID]._isCorrect);
                        }
                    }, this);
                }, this);
            }, this);
        }, this);
        // would I need to trigger an 'stateApplied' event or something??
        console.log('odilrs state applied to structure...');

    },

    /*******  END STATE MANAGEMENT FUNCTIONS ********/









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

  return (DefaultChannelHandler);
});
