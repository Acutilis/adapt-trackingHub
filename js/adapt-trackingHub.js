define([
  'coreJS/adapt',
  './string-messageComposer',
  './learnify-messageComposer',
  './consoleLog-transportHandler',
  './localStorage-transportHandler',
  './ODILRSStorage-transportHandler',
  './xapi/xapi-manager',
  './xapi/xapi-messageComposer',
  './xapi/xapi-transportHandler'
], function(Adapt, stringMessageComposer, learnifyMessageComposer, consoleLogTransportHandler, localStorageTransportHandler,ODILRSStorageTransportHandler, xapiManager, xapiMessageComposer, xapiTransportHandler ) {

    var TrackingHub = _.extend({

    _state: null,
    _sessionID: null,
    _config: null,
    _channels: [],
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
       contentObjects: ['change:_isComplete'],
       contentObjects: ['change:_isInteractionComplete'],
       contentObjects: ['change:_isVisible'],
       components: ['change:_isInteractionComplete']
    },
  
    initialize: function() {
      this.sessionID = ADL.ruuid();
      xapiManager.registration = this.sessionID;
  
      this.addMessageComposer(stringMessageComposer);
      this.addMessageComposer(learnifyMessageComposer);
      this.addTransportHandler(consoleLogTransportHandler);
      this.addMessageComposer(xapiMessageComposer);
      this.addTransportHandler(xapiTransportHandler);
      this.addTransportHandler(localStorageTransportHandler);
      this.addTransportHandler(ODILRSStorageTransportHandler);
  
      this.listenToOnce(Adapt, 'configModel:dataLoaded', this.onConfigLoaded);
      this.listenToOnce(Adapt, 'app:dataReady', this.onDataReady);

      this._data.currentPage = "";
      var local = this;
      local.interval = setInterval(function() {local.focus_check();},3000);
    },
  
    onConfigLoaded: function() {
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
      this.setupInitialEventListeners();
      this.loadState();
      // Important: state change listeners smust be loaded AFTER loading the state
      //this.listenTo(Adapt.contentObjects, 'change:_isVisible', this.sessionTimer);
      this.listenTo(Adapt, 'router:page', this.sessionTimer);
      this.listenTo(Adapt.components, 'change:_isInteractionComplete', this.onStateChanged);
      this.listenTo(Adapt.contentObjects, 'change:_isInteractionComplete', this.saveState);
      this.listenTo(Adapt.blocks, 'change:_isComplete', this.onStateChanged);
    },

    sessionTimer: function(target) {
        pageID = target.get('_trackingHub')._pageID || target.get('_id') || null;
        this._data.currentPage = pageID;
        this.window_focused();
    },

    onStateChanged: function(target) {
      var stateValue = this._state[target.get("_type") + "s"][target.get("_id")];
      if (!target.get("_isComplete") == stateValue || target.get('_userAnswer')) {
        this.saveState();
      } else {
	      this.saveState();
      }
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
        this.dispatchTrackedMsg(args, eventSourceName, eventName);
      }, this);
    },
  
    dispatchTrackedMsg: function(args, eventSourceName, eventName) {
      var composer;
      var thandler;
      var message;
      var transportConfig;
  
      _.each(this._channels, function (channel) {
        var isEventIgnored = _.contains(channel._ignoreEvents,eventName);
        if ( !isEventIgnored ) {
          composer = this.getComposerFromComposerName(channel._msgComposerName);
          thandler = this.getTransportHandlerFromTransportHandlerName(
            channel._transport._handlerName);
          message = composer.compose(eventSourceName, eventName, args);
          thandler.deliver(message, channel);
        }
      }, this);
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
    },
      
    updateState: function() {
      this._state = this._state || { "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} };
      this._state.courseID = this._config._courseID;
      this._state._isComplete = Adapt.course.get('_isComplete');
      this._state.user = this._data.user || {};
      //$.parseJSON(localStorage.getItem("user")) || {};
      pageID = this._data.currentPage;
      _.each(Adapt.contentObjects.models, function(contentObject) {
        // IDIOT DAVE THIS IS EVERY PAGE SO NOT JUST THE ONE ON THE SCREEN!!! 
        //localID = contentObject.getParent()
        localProgress = 0;
        progressObject = this._data.progress || {};
        //progressObject = $.parseJSON(localStorage.getItem("progress")) || {};
        pageProgress = progressObject[pageID] || {};
        if (pageID) {
          this._state.progress[pageID] = {};
        }

        pageTimes = this._data.sessionTimes || {};
        //pageTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
        thisPage = pageTimes[pageID] || {};
        sessionTime = thisPage.sessionTime || undefined;
        pageProgress.sessionTime = sessionTime;

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
          if (pageID) {
            this._data.progress[pageID] = progressObject;
          }
          
          //localStorage.setItem('progress',JSON.stringify(progressObject));
        }
        if (pageID) {
          this._state.progress[pageID] = pageProgress;
        }
      }, this);
      _.each(Adapt.blocks.models, function(block) {
        this._state.blocks[block.get('_id')] = block.get('_isComplete');
      }, this);
      _.each(Adapt.components.models, function(component) {
        this._state.components[component.get('_id')]=component.get('_isComplete');
        this._state.answers[component.get('_id')]=component.get('_userAnswer');
        if (pageID && component.get('_userAnswer')) {
          this._state.progress[pageID].answers = this._state.progress[pageID].answers || {};
          this._state.progress[pageID].answers[component.get('_id')] = {};
          this._state.progress[pageID].answers[component.get('_id')]._userAnswer = component.get('_userAnswer');
          this._state.progress[pageID].answers[component.get('_id')]._isCorrect = component.get('_isCorrect');
        }
      }, this);
      this.window_focused();
    },
  
    saveState: function() {
      this.updateState();
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
        this._data.progress = state.progress;
        this._data.user = state.user;
        //localStorage.setItem('progress',JSON.stringify(state.progress));
        //localStorage.setItem('user',JSON.stringify(state.user));
        _.each(Adapt.blocks.models, function(targetBlock) {
          targetBlock.set('_isComplete', state.blocks[targetBlock.get('_id')]);
        });
  
        _.each(Adapt.components.models, function(targetComponent) {
          targetComponent.set('_isComplete', state.components[targetComponent.get('_id')]);
          answers = state.answers[targetComponent.get('_id')] || [];
          if (answers.length > 0) {
            targetComponent.set('_userAnswer', state.answers[targetComponent.get('_id')]);
            targetComponent.set('_isSubmitted', true);
            targetComponent.set('_isInteractionComplete', true);
            //targetComponent.restoreUserAnswers();
            //targetComponent.updateButtons();
          }
        });
      };
      this.updateState();
    },

    focus_check: function() {
      pageID = this._data.currentPage;
      sessionTimes = this._data.sessionTimes || {};
      //sessionTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
      pageTimes = sessionTimes[pageID] || {};
      start_focus_time = undefined;
      last_user_interaction = undefined;   
      if (pageTimes.last_user_interaction) {
          last_user_interaction = new Date(pageTimes.last_user_interaction)
      }
      if (pageTimes.start_focus_time) {
        start_focus_time = new Date(pageTimes.start_focus_time)
      }
      if (last_user_interaction != undefined) {
        var curr_time = new Date();
        if((curr_time.getTime() - last_user_interaction.getTime()) > (20 * 1000) && start_focus_time != undefined) {
            this.window_unfocused();
        }
      }
    },

    window_focused: function() {
      pageID = this._data.currentPage;
      if (pageID == null) {
        return;
      }
      sessionTimes = this._data.sessionTimes || {};
      //sessionTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
      pageTimes = sessionTimes[pageID] || {};
      if (!pageTimes.start_focus_time) {
        pageTimes.start_focus_time = new Date();
      }
      pageTimes.last_user_interaction = new Date();
      sessionTimes[pageID] = pageTimes;
      this._data.sessionTimes = sessionTimes;
      //localStorage.setItem('sessionTimes',JSON.stringify(sessionTimes));
    },

    window_unfocused: function() {
      pageID = this._data.currentPage;
      sessionTimes = this._data.sessionTimes || {};
      //sessionTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
      pageTimes = sessionTimes[pageID] || {};
      start_focus_time = undefined;
      if (pageTimes.start_focus_time) {
        start_focus_time = new Date(pageTimes.start_focus_time);
      }
      total_focus_time = pageTimes.sessionTime || 0;
      if (start_focus_time != undefined) {
        var stop_focus_time = new Date();
        var to_add = stop_focus_time.getTime() - start_focus_time.getTime();
        to_add = Math.round(to_add / 1000);
        var total = total_focus_time + to_add;
        pageTimes.sessionTime = total;
        pageTimes.start_focus_time = undefined;
      }
      sessionTimes[pageID] = pageTimes;
      this._data.sessionTimes = sessionTimes;
      //localStorage.setItem('sessionTimes',JSON.stringify(sessionTimes));
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
