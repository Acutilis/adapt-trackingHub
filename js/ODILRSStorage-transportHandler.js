define([
  'coreJS/adapt',
], function(Adapt) {

  var ODILRSStorageTransportHandler = _.extend({

    _THUB: null,  // this will be set to the trackingHub module once this transportHandler is added.
    _NAME: 'ODILRSStorageTransportHandler',
    _OWNSTATEKEY: 'odilrs',
    _OWNSTATE: {},
    _URL: '',
    _data: {},
    _currentlyShownPage: null,   // added by pab

    initialize: function() {
      console.log('Initializing ' + this._NAME);
      // this._URL = channel._transport._endpoint;
      // 3 lines moved from th to here
      _.bindAll(this, 'onStateLoadSuccess', 'onStateLoadError', 'onStateSaveSuccess', 'onStateSaveError');
      this.listenToOnce(this._THUB, 'stateReady', this.onStateReady);

      this.listenTo(Adapt, 'userDetails:updated', this.updateUserDetails);
      // either I use adapt to trigger... or this... then tracking hub will listen to 'stateLoaded' on WHATEVER tracking handler is state-enabled
      this._data.currentPage = "";
      this._interval = setInterval(this.periodicSessionTimeUpdate, 3000);
    },

    processEvent: function(channel, eventSourceName, eventName, args) {
      // In this particular transport handler, WE DON'T need to compose messages, because we're not sending messages about events...
      // If we needed to compose messages, we would do:
      //   var composer = this._THUB.getComposerFromComposerName(channel._msgComposerName);
      //   var message = composer.compose(eventSourceName, eventName, args);
      // here just call the 'specific' processor
      var ev = eventSourceName + ':' + eventName;
      funcName = this._THUB.getValidFunctionName(eventSourceName, eventName);
      // console.log('funcName = ' + funcName);
      // We only need to write event handling functions for the events that we care about
      // see "Specific event processing functions" section below
      if (this.hasOwnProperty(funcName)) {
        this[funcName](args);
      }
      // the fact that there's no method to handle a specific event is NOT an error, it's simply that this TransportHandler doesn't care  about that event.
    },

    updateUserDetails: function(user) {
      localuser = this._data.user || {};
      for(var prop in user) {
        localuser[prop] = user[prop];
      }
      this._data.user = localuser;
    },

    getUserID: function() {
      // not sure that making a delayed call on fail is the right thing to do...
      var channel = this._THUB._launchManagerChannel; // yes, we're using specific functionality from the launch manager channel.
      this._URL = channel._transport._endpoint;
      $.get( this._URL + "create_id.php", function( data ) {
        localStorage.setItem("UserID",data);
      })
      .fail( function() {
        setTimeout(this.getUserID, 10000);
      });
    },

    /*
    queryString: function() {
      // This function is anonymous, is executed immediately and 
      // the return value is assigned to QueryString!
      var query_string = {};
      var query = window.location.search.substring(1);
      var vars = query.split("&");
      for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        if (typeof query_string[pair[0]] === "undefined") {
          query_string[pair[0]] = decodeURIComponent(pair[1]);
        } else if (typeof query_string[pair[0]] === "string") {
          var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
          query_string[pair[0]] = arr;
        // If third or later entry with this name
        } else {
          query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
      } 
      return query_string;
    },
*/

    /*******************************************
    /*******  LAUNCH SEQUENCE  FUNCTIONS *******
    /*******************************************/

    startLaunchSequence: function() {
      // In this TransportHandler the only thing to do in the launch sequence is to get the userID from localStorage
      // and if there's no userID, get one from the server.
      // is there a userID specified in the query string? if so, THAT is the user whose state we must loada
      var userID = null;
      var queryUserID = this._THUB.queryString().id;
      if (queryUserID) {
        userID = queryUserID;
      } else {
        // try to use a locally saved userID to load the data.
        userID = localStorage.getItem('UserID');
      }
      if (!userID) {
          var userID = this.getUserID(); 
          localStorage.setItem('UserID', userID);
      }
      console.log('odilrs: launch sequence finished');
      this.trigger('launchSequenceFinished');
    },

    /*******  END LAUNCH SEQUENCE FUNCTIONS *******/



    /*******************************************
    /*******  STATE MANAGEMENT FUNCTIONS *******
    /*******************************************/

    initializeState: function(newUserID) {
        // Initializes our own state representation. That would be: state.odilrsstorage
        // data structure as explained in https://github.com/Acutilis/adapt-trackingHub/pull/1/commits/36ee60afa0385e7d5dbcdcd6c50bd81f06fc98cf
        // state is 'own' state ... the part that this channel handler cares about.
        var localState =  { "_id": null, "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} }
        var state = localState;

        var lang = Adapt.config.get('_activeLanguage');
        // init user
        state.user.id = newUserID;
        state.user.lastSave = null;
        state.user.email = null;
        state.user.email_sent = false;

        // walk the hierarchy and initialize our state representation
        _.each(Adapt.contentObjects.models, function(contentPage) {
            var contentPageID = contentPage.get('_id');
            // progress by page (various data points)
            state.progress[contentPageID] = {};
            state.progress[contentPageID].startTime = null;
            state.progress[contentPageID].endTime = null;
            state.progress[contentPageID].sessionTime = null;
            state.progress[contentPageID].courseID = null;
            state.progress[contentPageID].theme = null;
            state.progress[contentPageID].progress = 0;

            _.each(contentPage.get('_children').models, function(article) {
                var articleID = article.get('_id');

                _.each(article.get('_children').models, function(block) {
                    var blockID = block.get('_id');
                    state.blocks[blockID] = block.get('_isComplete');

                    _.each(block.get('_children').models, function(component) {
                        var componentID = component.get('_id');
                        state.components[componentID] = component.get('_isComplete');
                        // update answers and progress structures of our state representation
                        if (component.get('_isQuestionType')) {
                            // answers
                            state.answers[componentID] = {};
                            state.answers[componentID]._userAnswer = component.get('_userAnswer');
                            state.answers[componentID]._isCorrect = component.get('_isCorrect');
                            // progress.answers
                            state.progress[contentPageID].answers = {};
                            state.progress[contentPageID].answers[componentID] = {};
                            state.progress[contentPageID].answers[componentID]._userAnswer = component.get('_userAnswer');
                            state.progress[contentPageID].answers[componentID]._isCorrect = component.get('_isCorrect');
                            if (!state.progress[contentPageID].answers._assessmentState) {
                                state.progress[contentPageID].answers._assessmentState = "Not Attempted";
                            }
                            if (component.get('_isCorrect') == false) {
                                state.progress[contentPageID].answers._assessmentState = "Failed";  
                            } else if (component.get('_isCorrect') == true && this._state.progress[contentPageID].answers._assessmentState != "Failed") {
                                state.progress[contentPageID].answers._assessmentState = "Passed";
                            }
                            if (!component.get('_userAnswer') || component.get('_userAnswer').length < 1) {
                                state.progress[contentPageID].answers._assessmentState = "Incomplete";  
                            }
                        }                     }, this);
                }, this);
            }, this);
        }, this);

        return localState;
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
       var fullState = $.parseJSON(responseText);
       var userID = localStorage.getItem('UserID');
       if (!fullState || fullState == {} ) {
           var localState = this.initializeState(userID);
           fullState = {}
           fullState[this._OWNSTATEKEY] = localState;
       }
       console.log('odilrs: state loaded');
       this.trigger('stateLoaded', fullState);
    },

    onStateLoadError: function(xhr, ajaxOptions, thrownError) {
       console.log("LRS load failed " + thrownError);
       var newUserID = this.getUserID(); 
       var fullState = {};
       var localState = this.initializeState(newUserID);
       fullState[this._OWNSTATEKEY] = localState;
       console.log('odilrs: state ready');
       this.trigger('stateLoaded', fullState);
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



    periodicSessionTimeUpdate: function() {
      // This function gets called periodically (every 3 seconds) so we can update the cumulative
      // time that a user spends in a page (even if the user is not doing anything).
      // this function is similar to updateCurrentlyShownPageData but it's not the same!
      if (this._currentlyShownPage) {
          var currrentlyShownPageID = this._currentlyShownPage.get('_id');
          var cspProgressObj = this._THUB._state.progress[currrentlyShownPageID];  //  displayedprogress object in _state
          var lastPeriodicUpdateValue = this._currentlyShownPage.get('odilrs_lastPeriodicUpdate') || 0;
          var rightNow = new Date(); 
          var timeDelta = rightNow - lastPeriodicUpdateValue;
          cspProgressObj.sessionTime = cspProgressObj.sessionTime + timeDelta;
          this._currentlyShownPage.set('odilrs_lastPeriodicUpdate', rightNow)
          cspProgressObj.progress = this._currentlyShownPage.get('completedChildrenAsPercentage');
      }
    },

    updateCurrentlyShownPageData: function(args) {
      // this function gets called when navigating away from a page (i.e., when the user has navigated to a new page)
      if (this._currentlyShownPage) {
          // the 'currentlyShownPage' is the one the user has left
          // all we need to do is update the cumulative time it was displayed
          var currentlyShownPageID = this._currentlyShownPage.get('_id');
          var cspProgressObj = this._THUB._state.progress[currentlyShownPageID]; 
          // let's be a bit more verbose to be clearer
          var timeCurrentlyShownPageLostFocus = new Date(); // right now
          var timeCurrentlyShownPageGainedFocus = this._currentlyShownPage.get('odilrs_startFocusTime');
          cspProgressObj.sessionTime = cspProgressObj.sessionTime + (timeCurrentlyShownPageLostFocus - timeCurrentlyShownPageGainedFocus);
          cspProgressObj.progress = this._currentlyShownPage.get('completedChildrenAsPercentage');
          // clean up
          args.set('odilrs_startFocusTime', null);
          this._currentlyShownPage = null;
      }

    },

    /**************************************************
     *****  Specific event processing functions   *****
     **************************************************

      As each event happens, all these event handlers 
      need to do is to update our internal state 
      representation.
     **************************************************/

    Adapt_router_page: function (args) {
      // This function gets executed when a user has navigated to a page
      // at this point, the user is already seeing the new page
      // When the user goes to a page, we want to keep record of:
      //    startTime: first time EVER the user opened that page
      //    endTime: time when the page was marked Complete
      //    sessionTime: time the user spent on that page
      //

      console.log('Adapt_router_page in ODILRSStorage');
      this.updateCurrentlyShownPageData();

      var pageID = args.get('_id');
      // var pageProgressObj = this._THUB._state[this._OWNSTATEKEY].progress[pageID];   //use abbreviated form
      var pageProgressObj = this._OWNSTATE.progress[pageID]; 
      // pageProgressObj "points to" the progress object  in _state
      if (! pageProgressObj.startTime) {
         pageProgressObj.startTime = new Date();
      }
      // we want to keep record of the moment where the user started seeing this page 
      // and we store this in the page object itself, as an attribute.
      args.set('odilrs_startFocusTime', new Date());
      this._currentlyShownPage = args; // update our varible to refer to this new page the user has displayed

      // TODO: ??? REVIEW this
      Adapt.trigger('trackingHub:getUserDetails',this._data.user || {});
    },

    Adapt_router_menu: function (args) {
        console.log('visited menu...');
        // when user goes to the menu, we must also update the cumulative time the last page  was displayed
        this.updateCurrentlyShownPageData(args);
    },

    contentObjects_change__isComplete: function (args) {
      // this happens when a page is completed
      console.log('PAGE COMPLETED! contentObjects_change_isComplete in ODILRSStorage... type ' + JSON.stringify(args.get('_type')));
      var pageID = args.get('_id');
      //var pageProgressObj = this._THUB._state.progress[pageID]; 
      var pageProgressObj = this._OWNSTATE.progress[pageID]; 
      // if endTime has not been recorded before, then record it.
      if (! pageProgressObj.endTime) {
         pageProgressObj.endTime = new Date();
      }
      pageProgressObj.progress = args.get('completedChildrenAsPercentage');
    },

    contentObjects_change__isInteractionComplete: function (args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('contentObjects_change_isInteractionComplete in ODILRSStorage...' + JSON.stringify(obj));

      var pageID = args.get('_id');
     // var pageProgressObj = this._THUB._state.progress[pageID]; 
      var pageProgressObj = this._OWNSTATE.progress[pageID]; 
      pageProgressObj.progress = args.get('completedChildrenAsPercentage');
    },

    blocks_change__isComplete: function (args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('blocks_change_isComplete in ODILRSStorage...' + JSON.stringify(obj));

      //update our representation of state
      var blockID = args.get('_id');
      // this._THUB._state.blocks[blockID] = args.get('_isComplete');
      this._OWNSTATE.blocks[blockID] = args.get('_isComplete');
    },

    blocks_change__isInteractionComplete: function (args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('blocks_change_isInteractionComplete in ODILRSStorage...' + JSON.stringify(obj));

      //update our representation of state
      var blockID = args.get('_id');
      // this._THUB._state.blocks[blockID] = args.get('_isComplete');
      this._OWNSTATE.blocks[blockID] = args.get('_isComplete');
    },

    components_change__isComplete: function(args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('components_change__isComplete in ODILRSStorage...' + JSON.stringify(obj));
      //update our representation of state
      var componentID = args.get('_id');
      // this._THUB._state.components[componentID] = args.get('_isComplete');
      this._OWNSTATE.components[componentID] = args.get('_isComplete');
    },

    components_change__isInteractionComplete: function(args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('components_change__isInteractionComplete in ODILRSStorage...' + JSON.stringify(obj));
      //update our representation of state
      var componentID = args.get('_id');
      // this._THUB._state.components[componentID] = args.get('_isComplete');
      this._OWNSTATE.components[componentID] = args.get('_isComplete');

      if (args.get('_userAnswer')) {
        // update answers direct
        this._OWNSTATE.answers[componentID]._userAnswer = args.get('_userAnswer');
        this._OWNSTATE.answers[componentID]._isCorrect = args.get('_isCorrect');
        // update answers in 'progress'
      }
    },

  }, Backbone.Events);

  return (ODILRSStorageTransportHandler);
});
