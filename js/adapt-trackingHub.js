// Careful... setting global variable because the ODI setup needs it...
var theme="ODI";
define([
  'coreJS/adapt',
  './string-messageComposer',
  './localStorage-transportHandler',
  './ODILRSStorage-transportHandler',
  './xapi/xapi-manager',
  './xapi/xapi-messageComposer',
  './xapi/xapi-transportHandler'
], function(Adapt, stringMessageComposer, localStorageTransportHandler, ODILRSStorageTransportHandler, xapiManager, xapiMessageComposer, xapiTransportHandler ) {

    var TrackingHub = _.extend({

    _state: null,
    // _state: { 'base': {}},
    _sessionID: null,
    _config: null,
    _channels: [],
    // 1 lines moved from here to ODILRSStorageTH
    _data: {},
    _message_composers: {},
    _transport_handlers: {},
    _xapiManager: xapiManager,

    // Basic, default tracked messages
    _TRACKED_MSGS: {
       Adapt: [
        'navigationView:preRender',                    // opened course
        'router:menu',                                 // visited menu
        'router:page',                                 // visited page
        'questionView:complete',
        'questionView:reset',
        'assessments:complete',
        'assessments:reset',
        'questionView:recordInteraction'
       ],
       blocks: ['change:_isComplete'],
       course: ['change:_isComplete'],
       components: ['change:_isInteractionComplete'],
       // I think that these additions by @davetaz should remain in the core trackingHub
       contentObjects: ['change:_isComplete',
                        'change:_isInteractionComplete',
                        'change:_isVisible'
       ]
    },

    initialize: function() {
      this.sessionID = ADL.ruuid();
      xapiManager.registration = this.sessionID;

      this.addMessageComposer(stringMessageComposer);
      this.addMessageComposer(xapiMessageComposer);
      this.addTransportHandler(xapiTransportHandler);
      this.addTransportHandler(localStorageTransportHandler);
      // the ODILRSStorageTH was added by @davetaz. This will not be here.
      this.addTransportHandler(ODILRSStorageTransportHandler);

      this.listenToOnce(Adapt, 'configModel:dataLoaded', this.onConfigLoaded);
      this.listenToOnce(Adapt, 'app:dataReady', this.onDataReady);

      // 3 lines moved from here to ODILRSStorageTH
      //this._data.currentPage = "";
      //var local = this;
      //local.interval = setInterval(function() {local.focus_check();},3000);
    },

    onConfigLoaded: function() {
      // just add the defined channels to trackingHub
      var isXapiChannel;

      if (!this.checkConfig())
        return;
      xapiManager.courseID = this._config._courseID;
      _.each(this._config._channels, function addChannel (channel) {
        if (this.checkChannelConfig(channel) && channel._isEnabled) {
          this._channels.push(channel);
          isXapiChannel = (channel._msgComposerName.indexOf('xapi') == 0) ||
            (channel._transport._handlerName.indexOf('xapi') == 0);
          if (isXapiChannel) {
            xapiManager.addXapiChannel(channel);
          }
        }
      }, this);
    },

    onDataReady: function() {
      // TODO: loadState will be executed AFTER the LaunchSequence, controlled by _activeLaunch in config
      this.loadState();  // this should be startUpState or prepareState
      // I SET UP the event listeners AFTER the state is loaded, otherwise, the load state will change things in the structure
      // and the events will be fired, and the state saved again...
      // NO NO NO this does'nt work!! the loadState is going to be most likely, async, and might end AFTER setupInitialEventListeners has run
      // SO the setupInitialEventListenes SHOULD be called after the prepareState has issued a 'stateReady' event!!!
      // onStateReady -> setupInitialEventListeners.
      this.setupInitialEventListeners();
      // Important: state change listeners must be loaded AFTER loading the state

      // 1 line moved to ODILRSStorageHandler
      // this.listenTo(Adapt, 'router:page', this.sessionTimer);
      // THIS IS WRONG... EVENT listeners have already been added!!
      // THE odilrs will REACT to these changes, and all they do is SAVE STATE!
      // this.listenTo(Adapt.components, 'change:_isInteractionComplete', this.onStateChanged);
      // this.listenTo(Adapt.contentObjects, 'change:_isInteractionComplete', this.saveState);
      // this.listenTo(Adapt.blocks, 'change:_isComplete', this.onStateChanged);

      // NO WAY this can be here... in the main 'trackinghub' he's listenting for an event triggered by his custom THEME!!
      // It is HIS OWN extension the one who has to listen... THIS IS An example of a  CUSTOM EVENT!
      // this.listenTo(Adapt, 'userDetails:updated', this.updateUserDetails);
    },

    /*
     // function moved to ODILRSStorageHandler.
    sessionTimer: function(target) {
        // ( @jpablo128 edit)
        // Trying to do:
        //    pageID = target.get('_trackingHub')._pageID || target.get('_id');
        // directly causes errors, because target migt not have the attribute called '_trackinghub' (so it's null), at least sometimes
        // So I use this equivalent safest alternative:
        if (target.get('_trackingHub')) {
          var pageID = target.get('_trackingHub')._pageID;
        } else {
            var pageID = target.get('_id');
        }
        this._data.currentPage = pageID;
        this.window_focused();
        Adapt.trigger('trackingHub:getUserDetails',this._data.user || {});
    },

    */

    /*
    // function moved to ODILrs
    updateUserDetails: function(user) {
      localuser = this._data.user || {};
      for(var prop in user) {
        localuser[prop] = user[prop];
      }
      this._data.user = localuser;
    },
    */

    onStateChanged: function(target) {
      // well, I think that stateChanged should just call saveState, no matter what.
      // and besides, it was VERY limiting... it was only considering _isComplete...
      this.saveState();
      // BUT.... onStateChanged ... it should give the opportunity to OTHER TransportHandlers to do stuff 
      // OR... better, I think, OTHER THs should be able to notify when state has changed... because their concept of STATE is different.
/*
      var stateValue = this._state[target.get("_type") + "s"][target.get("_id")];
      if (!target.get("_isComplete") == stateValue || target.get('_userAnswer')) {
        this.saveState();
      } else {
          this.saveState();
      }
*/
    },
  
    checkConfig: function() {
      this._config = Adapt.config.has('_trackingHub') 
        ? Adapt.config.get('_trackingHub')
        : false;
    
      if (this._config && this._config._isEnabled !== false) {
        this._config._courseID = this._config._courseID || ADL.ruuid();
        return true;
      }
      return false;
    },
  
    checkChannelConfig: function(channel) {
      channel.has = channel.hasOwnProperty;
      channel._ignoreEvents = channel._ignoreEvents || [];
      channel._xapiData = channel._xapiData || {};
 
      /* original condition: msgComposer was mandatory
      if ((_.isArray(channel._ignoreEvents)) && (_.isObject(channel._xapiData)) &&
        (channel.has('_isEnabled') && _.isBoolean(channel._isEnabled)) &&
        (channel.has('_name') && _.isString(channel._name) &&
          !_.isEmpty(channel._name) ) &&
        (channel.has('_msgComposerName') && _.isString(channel._msgComposerName) &&
          !_.isEmpty(channel._msgComposerName) ) &&
        (channel.has('_transport') ) &&
        (channel._transport.hasOwnProperty('_handlerName') &&
          _.isString(channel._transport._handlerName) &&
         !_.isEmpty(channel._transport._handlerName) ) ) {
        return  true;
      }
      */
      // new condition: _msgComposerName is optional
      if ((_.isArray(channel._ignoreEvents)) && (_.isObject(channel._xapiData)) &&
        (channel.has('_isEnabled') && _.isBoolean(channel._isEnabled)) &&
        (channel.has('_name') && _.isString(channel._name) &&
          !_.isEmpty(channel._name) ) &&
        (channel.has('_transport') ) &&
        (channel._transport.hasOwnProperty('_handlerName') &&
          _.isString(channel._transport._handlerName) &&
         !_.isEmpty(channel._transport._handlerName) ) ) {
        return  true;
      }
  
      console.log('trackingHub Error: Channel specification is wrong in config.');
      return false;
    },
  
    setupInitialEventListeners: function() {
      this._onDocumentVisibilityChange = _.bind(this.onDocumentVisibilityChange, this);
      $(document).on("visibilitychange", this._onDocumentVisibilityChange);
    
      _.each(_.keys(this._TRACKED_MSGS), function (eventSourceName) {
        _.each(this._TRACKED_MSGS[eventSourceName], function (eventName) {
          this.addLocalEventListener(eventSourceName, eventName);
        },this);
      },this);
    },
  
    getObjFromEventSourceName: function (eventSourceName) {
      var obj = null;
      switch (eventSourceName.toLowerCase()) {
        case 'adapt': obj = Adapt; break;
        case 'course': obj = Adapt.course; break;
        case 'blocks': obj = Adapt.blocks; break;
        case 'components': obj = Adapt.components; break;
        case 'contentobjects': obj = Adapt.contentObjects; break;
      };
      return obj;
    },
  
    addCustomEventListener: function(eventSource, eventName) {
      // this fuction is susceptible of being  called form other plugins
      //(mainly custom components that implement custom reporting)
      var sourceObj;
      var longEventName;
  
      if (_.isString(eventSource)) {
        sourceObj = this.getObjFromEventSourceName(eventSourceName);
        eventSourceName = eventSource;
      } else {
        sourceObj = eventSource;
        eventSourceName = sourceObj._NAME;
      }
      longEventName = eventSourceName + ':' + eventName;
  
      this.listenTo(sourceObj, longEventName, function (args) {
        this.dispatchTrackedMsg(args, eventSourceName, eventName);
      }, this);
    },
  
    addLocalEventListener: function(eventSourceName, eventName) {
      var sourceObj;
  
      sourceObj = this.getObjFromEventSourceName(eventSourceName);
      this.listenTo(sourceObj, eventName, function (args) {
        // TODO: dispatchTrackedMsg should be processTrackedMsg
        this.dispatchTrackedMsg(args, eventSourceName, eventName);
      }, this);
    },
  
    dispatchTrackedMsg: function(args, eventSourceName, eventName) {
      // OK, for tracked events, I'm just calling the 'deliver' function  
      // BUT IT'S NOT JUST DELIVER! I want to allow the TransportHandlers TO DO whatever they want
      // THEY might want to COMPOSE a message... or they might just want to update its internal state...
      // that's mostly what ODILRSStorageTH is doing...
      // I think that, instead of 'deliver' I should call 'dealWith', or 'processEvent' within the TH,
      // and let IT decide if it wants to compose a message and deliver it, OR if it just wants to 
      // update its state... and then call 'stateChanged'
      // IN OTHER WORDS
      // THE WAY I did it... is VERY LIMITING 
      // THIS STRENGTHENS MY THEORY: The STATE representation IS AFFECTED, or changed, by the EVENTS that happen
      // SO if every TransportHandler has its OWN representation of STATE... then we must let the events PERCOLATE to each TH so it can AFFECT its state representation.
      var composer;
      var thandler;
      var message;
      var transportConfig;

      _.each(this._channels, function (channel) {
        var isEventIgnored = _.contains(channel._ignoreEvents,eventName);
        if ( !isEventIgnored ) {
          // commented out all lines about composing and 'deliver' . He's not really using them.
          // composer = this.getComposerFromComposerName(channel._msgComposerName);
          thandler = this.getTransportHandlerFromTransportHandlerName(channel._transport._handlerName);
          //message = composer.compose(eventSourceName, eventName, args);
          //thandler.deliver(message, channel);
          // @jpablo128 1 line added
          thandler.processEvent(channel, eventSourceName, eventName, args);
        }
      }, this);
      // THIS IS THE MOMENT where ALL channels have processed (or not) the event, they've updated their representation of the state, 
      // and when trackinghub  can SAVE the state! (although the specific save is performed by a concrete channel).
      // HERE CALL this.saveState(x, y, z)  THAT FUNCTION will implement the 'only really save once every 5 calls' or whatever
      this.saveState();
    },
  
    getComposerFromComposerName: function (cname) {
      return (this._message_composers[cname]);
    },
  
    getTransportHandlerFromTransportHandlerName: function (thname) {
      return (this._transport_handlers[thname]);
    },
  
    // *** functions addMessageComposer and addTransportHandler 
    // are here so other extensions (extensions implementing messageComposers and
    // TransportHandlers) can add themselves to trackingHub
    addMessageComposer: function (mc) {
      this._message_composers[mc['_NAME']] = mc;
    },
  
    addTransportHandler: function (th) {
      this._transport_handlers[th['_NAME']] = th;
      // @jpablo128 addition: call the THandler's  'initialize' function if it exists
      th._THUB = this;
      if (th.initialize) {
          th.initialize();
      }
    },
/*      
    updateState: function() {
      this._state = this._state || { "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} };
      courseID = this._config._courseID;
      lang = Adapt.config.get('_activeLanguage');
      this.window_unfocused();
      // THIS DOESN'T WORK
      //this._state._isComplete = Adapt.course.get('_isComplete');
      this._state.user = this._data.user || {};
      pageID = this._data.currentPage;
      _.each(Adapt.contentObjects.models, function(contentObject) {
        // ( @jpablo128 edit)
        // Trying to do:
        //    contentPageID = contentObject.get('_trackingHub')._pageID || contentObject.get('_id');
        // directly causes errors, because contentObject has no attribute called '_trackinghub' (so it's null), at least sometimes
        // So I use this equivalent safest alternative:
        if (contentObject.get('_trackingHub')) {
          var contentPageID = contentObject.get('_trackingHub')._pageID;
        } else {
            var contentPageID = contentObject.get('_id');
        }
        // IDIOT DAVE THIS IS EVERY PAGE SO NOT JUST THE ONE ON THE SCREEN!!! 
        //localID = contentObject.getParent()
        localProgress = 0;
        progressObject = this._data.progress || {};
        pageProgress = progressObject[contentPageID] || {};
        if (contentPageID) {
          this._state.progress[contentPageID] = {};
        }

        pageTimes = this._data.sessionTimes || {};
        thisPage = pageTimes[contentPageID] || {};
        
        sessionTime = thisPage.sessionTime || undefined;
        pageProgress.sessionTime = sessionTime;
        pageProgress.courseID = courseID;
        pageProgress.lang = lang;
        pageProgress.theme = theme;
        pageProgress._isComplete = false;
        if (contentObject.get('completedChildrenAsPercentage')) {
          localProgress = contentObject.get('completedChildrenAsPercentage');
          if (localProgress > 10 && !pageProgress.startTime) {
            pageProgress.startTime = new Date();
            pageProgress.progress = localProgress;
          }
          if (localProgress > 99) {
            pageProgress.endTime = new Date();
            pageProgress.progress = 100;
            pageProgress._isComplete = true;
          }
          pageProgress.progress = contentObject.get('completedChildrenAsPercentage');
          if (contentPageID) {
            this._data.progress[contentPageID] = pageProgress;
          }
          
          //localStorage.setItem('progress',JSON.stringify(progressObject));
        }
        if (contentPageID) {
          this._state.progress[contentPageID] = pageProgress;
        }
      }, this);
      _.each(Adapt.blocks.models, function(block) {
        this._state.blocks[block.get('_id')] = block.get('_isComplete');
      }, this);
      _.each(Adapt.components.models, function(component) {
        // ( @jpablo128 edit)
        // Trying to do:
        //    contentPageID = component.getParent().getParent().getParent().get('_trackingHub')._pageID || component.getParent().getParent().getParent().get('_id');
        // directly causes errors, because the object referenced has no attribute called '_trackinghub' (so it's null), at least sometimes
        // So I use this equivalent safest alternative:
        var parentChain = component.getParent().getParent().getParent();
        if (parentChain.get('_trackingHub')) {
          var contentPageID = parentChain.get('_trackingHub')._pageID;
        } else {
          var contentPageID = parentChain.get('_id');
        }

        this._state.components[component.get('_id')]=component.get('_isComplete');
        if (contentPageID && component.get('_userAnswer')) {
          this._state.answers[component.get('_id')] = {};
          this._state.answers[component.get('_id')]._userAnswer = component.get('_userAnswer');
          this._state.answers[component.get('_id')]._isCorrect = component.get('_isCorrect');
          this._state.progress[contentPageID].answers = this._state.progress[contentPageID].answers || {};
          this._state.progress[contentPageID].answers[component.get('_id')] = {};
          this._state.progress[contentPageID].answers[component.get('_id')]._userAnswer = component.get('_userAnswer');
          this._state.progress[contentPageID].answers[component.get('_id')]._isCorrect = component.get('_isCorrect');
          if (!this._state.progress[contentPageID].answers._assessmentState) {
            this._state.progress[contentPageID].answers._assessmentState = "Not Attempted";
          }
          if (component.get('_isCorrect') == false) {
            this._state.progress[contentPageID].answers._assessmentState = "Failed";  
          } else if (component.get('_isCorrect') == true && this._state.progress[contentPageID].answers._assessmentState != "Failed") {
            this._state.progress[contentPageID].answers._assessmentState = "Passed";
          }
          if (component.get('_userAnswer').length < 1) {
            this._state.progress[contentPageID].answers._assessmentState = "Incomplete";  
          }
        }
      }, this);
    },
*/
    saveState: function() {
       // HERE implement reading from config _saveOnceIn or something like that... so it only really saves once every 5 times or whatever.
      //this.updateState();
      _.each(this._channels, function(channel) {
        if (channel._saveStateIsEnabled) {
          this._transport_handlers[channel._transport._handlerName].saveState(this._state, channel, this._config._courseID);
        }
      }, this);
    }, 

    loadState: function() {
      var stateSourceChnl = null;
      var handlerName = null;
      var state = null;
 
      // THERE should ONLY Be 1 stateSource channel... so, whenever we find the 1st one... it should stop searching
      // maybe use another technicque.
      // right now, is getting teh last one (the last one in the config)
      _.each(this._channels, function(channel) {
        if (channel._isStateSource) {
          stateSourceChnl = channel;
        }
      }, this);
      if (stateSourceChnl) {
        handlerName = stateSourceChnl._transport._handlerName;
        state = this._transport_handlers[handlerName].loadState(stateSourceChnl,this._config._courseID);
      }
      if (state) {
          this._state = state;
          this.updateStructureFromState(state);
      } else {
          this._state = this.generateInitialState();
      }

    },

    generateInitialState: function() {
        // LET'S MAKE 1 state now, I'll separate later!
        // OK, this DOESN'T generate an 'empty object'...e.g. { "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} }
        // it should generate the complete object... that is, generateStateFromStructure ... generates ITS OWN representation of the state, from Adapt objects.

    },

    generateInitialChannelStates: function() {
    },

    updateStructureFromState: function(state) {
        console.log('PAB prog in trackinghub 1');
        this._data.progress = state.progress;
        this._data.user = state.user;
        _.each(Adapt.blocks.models, function(targetBlock) {
          targetBlock.set('_isComplete', state.blocks[targetBlock.get('_id')]);
        });
  
        _.each(Adapt.components.models, function(targetComponent) {
          targetComponent.set('_isComplete', state.components[targetComponent.get('_id')]);
          answers = state.answers[targetComponent.get('_id')] || false;
          if (answers) {
            if (answers._userAnswer.length > 0) {
              targetComponent.set('_userAnswer', state.answers[targetComponent.get('_id')]._userAnswer);
              targetComponent.set('_isCorrect', state.answers[targetComponent.get('_id')]._isCorrect);
              targetComponent.set('_isSubmitted', true);
              targetComponent.set('_isInteractionComplete', true);
            }
          }
        });
      //this.updateState();
    },

    getValidFunctionName: function (eventSourceName, eventName) {
      return (eventSourceName + '_' + eventName.replace(/:/g, "_"));
    },

    onDocumentVisibilityChange: function() {
      // Use visibilitystate instead of unload or beforeunload. It's more reliable.
      // See:
      // https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/
  
      if (document.visibilityState == "hidden") {
        this.window_unfocused();
        this.saveState();
      };
    
      if (document.visibilityState == "visible") {
        this.window_focused();
        //this.loadState();
      };
       
      $(document).off("visibilitychange", this._onDocumentVisibilityChange);
      $(document).on("visibilitychange", this._onDocumentVisibilityChange);
    }
  }, Backbone.Events);
  
  TrackingHub.initialize();
  return (TrackingHub);
});
