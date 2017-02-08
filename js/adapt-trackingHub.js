define([
  'coreJS/adapt',
  './browserChannelHandler',
], function(Adapt, browserChannelHandler ) {

    Adapt.trackingHub = _.extend({

    userInfo: {},
    _state: {},
    _sessionID: null,
    _config: null,
    _channel_handlers: [],      // references to the existing channel handler modules
    _channels: [],              // configuration for each channel
    _launchManagerChannel: null,
    _stateSourceChannel: null,
    _stateStoreChannel: null,
    _tkhubOK: false,
    _settingUpListeners: false,


    // Basic, default tracked messages
    _TRACKED_MSGS: {
       trackingHub: ['course:launch'],
       Adapt: [
        'router:menu',                                 // visited menu
        'router:page',                                 // visited page
        'assessments:complete',
       ],
       course: ['change:_isComplete'],
       components: ['change:_isComplete'],
       contentObjects: ['change:_isComplete', 'change:_isVisible' ]
    },


    initialize: function() {
      // Hold up setup while credentials and other key data is retrieved
      Adapt.trigger('plugin:beginWait');

      this.addChannelHandler(browserChannelHandler);
      this.listenToOnce(Adapt, 'configModel:dataLoaded', this.onConfigLoaded);
      this.listenToOnce(Adapt, 'app:dataLoaded', this.onDataLoaded);
      this.listenToOnce(Adapt, 'adapt:start', this.onStart);
    },


    /*******************************************
    /*******      CONFIG  FUNCTIONS      *******
    /*******************************************/

    onConfigLoaded: function() {
      if (! this.checkBaseConfig()) // if trackingHub is disabled, don't do anything
        return false;
      if (!this.processConfigs()) {
          console.log('Config for trackingHub or any of its tracking extension is wrong. Tracking will not work.');
          return false;
      }
      this._tkhubOK = true;
      return true;
    },

    processConfigs: function() {
      // check the config for each channel, and if it's ok, place it in the _channels array
      // first do the browserChannel, which is different
      if( !_.has(this._config, '_browserChannel') || ! this.checkBrowserChannelConfig()) {
          return false;
      }
      if (this._config._browserChannel._isEnabled) {
        this._config._browserChannel._handler = browserChannelHandler;
        if (this._config._browserChannel._isLaunchManager) { this._launchManagerChannel = this._config._browserChannel };
        if (this._config._browserChannel._isStateSource) { this._stateSourceChannel = this._config._browserChannel };
        this._channels.push(this._config._browserChannel);
      }
      // now do the same with the rest of the channel handlers
      _.each(this._channel_handlers, function(chandler) {
          if (chandler != browserChannelHandler) {
            if (! chandler.checkConfig())
              return false;
            if (chandler._config._isEnabled) {
              // Only if this handler is enabled, we process its channel definitions to add them to our array of _channels.
              var channelDefs = chandler.getChannelDefinitions();
              _.each(channelDefs, function(channel) {
                // if channel is enabled, add it to our list of channels, adding a reference to the handler itself
                if (channel._isEnabled) {
                  channel._handler = chandler;
                  if (channel._isLaunchManager) { this._launchManagerChannel = channel };
                  if (channel._isStateSource) { this._stateSourceChannel = channel };
                  //if (channel._isStateStore) { this._stateStoreChannel = channel };
                  this._channels.push(channel);
                }
            }, this);
          }
        }
      }, this);
    return true;
    },

    checkBaseConfig: function() {
      this._config = Adapt.config.has('_trackingHub')
        ? Adapt.config.get('_trackingHub')
        : false;
      if (this._config && this._config._isEnabled !== false) {
        this._config._courseID = this._config._courseID || 'http://www.courses.com/' + this.genUUDI();
        this._config._identifyById = this._config._identifyById || false; // is this wrong?
        return true;
      }
      return false;
    },

    checkBrowserChannelConfig: function() {
      var bcconf = this._config._browserChannel;
      browserChannelHandler._config = bcconf;  // just for convenience
      // force the name of the default CH
      browserChannelHandler._config._name = 'browserChannel';
      return this.checkCommonChannelConfig(bcconf);
    },

    checkCommonChannelConfig: function(chConfig) {
      // Check configuration settings that are common to all channels
      // This function will also be called from other tracking extensions
      if (chConfig._name == undefined) {
          // not a breaking problem, but do report the issue
          chConfig._name = this.genUUID();
          console.log('No name provided for a channel. You should set a name for the channel!');
      }
      if (chConfig._isEnabled == undefined)
          chConfig._isEnabled = true;
      if (chConfig._reportsEvents == undefined)
          chConfig._reportsEvents = true;
      if (chConfig._tracksState == undefined)
          chConfig._tracksState = true;
      if (chConfig._isStateSource == undefined)
          chConfig._isStateSource = false;
      if (chConfig._isStateStore == undefined)
          chConfig._isStateStore = true;
      if (chConfig._isLaunchManager == undefined)
          chConfig._isLaunchManager = false;
      chConfig._ignoreEvents = chConfig._ignoreEvents || [];

      if ( ( _.isArray(chConfig._ignoreEvents)) &&
           ( _.isBoolean(chConfig._isEnabled)) &&
           ( _.isBoolean(chConfig._reportsEvents)) &&
           ( _.isBoolean(chConfig._tracksState)) &&
           ( _.isBoolean(chConfig._isStateSource)) &&
           ( _.isBoolean(chConfig._isStateStore)) &&
           ( _.isBoolean(chConfig._isLaunchManager)) &&
           (_.has(chConfig,'_name') && _.isString(chConfig._name) && !_.isEmpty(chConfig._name)))   {
             return true;
      }
      console.log('There are errors in the common channel settings for channel ' + chConfig._name + '.');
      return false;
    },

    checkStrictTitles: function() {
      var idsWithEmptyTitles = [];
      var uniqueTitles = [];
      var repeatedTitles = [];
      var msg = '';
      var result = true;
      _.each(Adapt.components.models, function(componentModel) {
        var t = componentModel.get('title');
        if (t.trim() == '') {
            idsWithEmptyTitles.push(componentModel.get('_id'));
        } else {
          if ( _.indexOf(uniqueTitles, t) == -1 ) {
              uniqueTitles.push(t);
          } else {
              repeatedTitles.push(t);
          }
        }
      });
      if (idsWithEmptyTitles.length > 0) {
          msg += 'The components with the following Ids have empty titles:\n';
          _.each(idsWithEmptyTitles, function(id) {
              msg = msg + id + '\n';
          });
      }
      if (repeatedTitles.length > 0) {
          msg += 'The following titles are assigned to more than one component:\n';
          _.each(repeatedTitles, function(title) {
              msg = msg + title + '\n';
          });
      }
      if(msg.length > 0) {
          msg += 'PLEASE FIX TITLES. Tracking aborted. It will NOT work.';
          alert(msg);
          result = false;
      }
      return result;
    },

    applyChannelConfig: function(channel) {
      if (channel._handler.hasOwnProperty('applyChannelConfig')) {
          channel._handler.applyChannelConfig(channel);
      }
    },

    /*******  END CONFIG FUNCTIONS *******/


    onDataLoaded: function() {
      // Check strict titles.
      if (!this._config._identifyById) {
          if (!this.checkStrictTitles()) {
              return
          }
      }

      // Hold up setup while credentials and other key data is retrieved
      //Adapt.trigger('plugin:beginWait');

      // start launch sequence -> loadState -> setupInitialEventListeners... do this asynchronously
      console.log('trackingHub: starting launch sequence...');
      if (this._launchManagerChannel) {
          var channelHandler = this._launchManagerChannel._handler;
          if (! channelHandler) {
              alert('Please review your configuration file. There seems to be an error in the handler name ' + this._launchManagerChannel._handlerName);
          }
          this.listenToOnce(channelHandler, 'launchSequenceFinished', this.onLaunchSequenceFinished);
          channelHandler.startLaunchSequence(this._launchManagerChannel, this._config._courseID);
      } else {
          // just call the function directly, as if the launch sequence had really finished.
          this.onLaunchSequenceFinished();
      }
    },

    /*******************************************
    /******* GENERAL  UTILITY  FUNCTIONS *******
    /*******************************************/

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

    /*!
    Excerpt from: Math.uuid.js (v1.4)
    http://www.broofa.com
    mailto:robert@broofa.com
    Copyright (c) 2010 Robert Kieffer
    Dual licensed under the MIT and GPL licenses.
    */
    genUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
        });
    },


    /*******  END GENERAL UTILITY FUNCTIONS *******/




    /*******************************************
    /******* STATE MANAGEMENT  FUNCTIONS *******
    /*******************************************/


    onLaunchSequenceFinished: function(ev) {
      console.log('launch sequence finished.');
      // once the launch seq is finished (we have the user identity) we can 'initialize' the channels
      _.each(this._channels, function(channel) {
        this.applyChannelConfig(channel);
      },this);
      // once the launch seq is complete, let's attempt to load state, if there's a state source
      if (this._stateSourceChannel) {
        var channelHandler = this._stateSourceChannel._handler;
        this.listenToOnce(channelHandler, 'stateLoaded', this.onStateLoaded);
        console.log('loading state...');
        channelHandler.loadState(this._stateSourceChannel, this._config._courseID);
      } else {
          this.onStateLoaded({});  // initialize the full state representation to an empty object
      }
    },

    onStateLoaded: function(fullState) {
      // The FULL version of the state is saved/loaded. Then each ChannelHandler  will deal with its 'own' part
      console.log('state loaded');
      this._state = fullState;
      this.trigger('stateReady');
      console.log('state ready');
      this.applyStateToStructure();

      // Retrieval completed. This plugin is done doings its things
      Adapt.trigger('plugin:endWait');
    },

    onStart: function() {
      console.log('bind event listeners');

      this.setupInitialEventListeners();
      this.trigger('course:launch');
    },

    applyStateToStructure: function() {
        // call every channel handler to apply its particular state representation
        _.each(this._channel_handlers, function(chandler, name, list) {
          if(chandler.applyStateToStructure) {
            chandler.applyStateToStructure();
          }
        }, this);
    },

    /*******  END STATE MANAGEMENT FUNCTIONS *******/


    setupInitialEventListeners: function() {
      this._settingUpListeners = true; // turn on control flag
      console.log('setting up initial event listeners (for tracked messages)');
      _.each(_.keys(this._TRACKED_MSGS), function (eventSourceName) {
        _.each(this._TRACKED_MSGS[eventSourceName], function (eventName) {
          this.addLocalEventListener(eventSourceName, eventName);
        },this);
      },this);

      this._onDocumentVisibilityChange = _.bind(this.onDocumentVisibilityChange, this);
      $(document).on("visibilitychange", this._onDocumentVisibilityChange);
      console.log('FINISHED setting up initial event listeners...');
      this._settingUpListeners = false;
    },

    getObjFromEventSourceName: function (eventSourceName) {
      var obj = null;
      // TODO: do this with an object? (name is key, value is the target object)
      switch (eventSourceName.toLowerCase()) {
        case 'trackinghub': obj = this; break;
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
        eventSourceName = sourceObj._CHID;
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
        // only allow some events to be dispatched as the listeners are being set up.
        var allowedEvents = ['router:menu', 'navigationView:preRender'];
        if (!this._settingUpListeners || _.indexOf(allowedEvents, eventName)!=-1) {    //only dispatch if control flag is off (e.g. we're not in the initial setup stage)
            this.dispatchTrackedMsg(args, eventSourceName, eventName);
        }
      }, this);
    },

    dispatchTrackedMsg: function(args, eventSourceName, eventName) {
      var chandler;
      var message;
      var channelConfig;

      _.each(this._channels, function (channel) {
          channel._handler.processEvent(channel, eventSourceName, eventName, args);
      }, this);
      // At this point in time, all channels have processed (or not) the event, so the whole representation of state is updated.
      // So trackingHub can invoke the Save functionality, (although the specific save is performed by a concrete channel).
      this.saveState();
    },

    addChannelHandler: function (ch) {
      // this function is here so other extensions (implementing ChannelHandlers) can call it to add themselves to trackingHub
      this._channel_handlers.push(ch);
    },

    saveState: function() {
      // TODO: implement configurable functionality to throttle saving somehow, that is, save only
      // once every X times this function is called, for example
      _.each(this._channels, function(channel) {
        if (channel._isStateStore) {
          channel._handler.saveState(this._state, channel, this._config._courseID);
        }
      }, this);
    },

    getValidFunctionName: function (eventSourceName, eventName) {
      return (eventSourceName + '_' + eventName.replace(/:/g, "_"));
    },

    getElementKey: function(obj) {
        // checks the config to see if the 'key' (unique identifier) of a Component, block, article, or contentObject
        // should be the _id or the title
        var key = null;
        this._config._identifyById ?
            key = obj.get('_id')
            :
            key = this.titleToKey(obj.get('title'));
       return key;
    },

    titleToKey: function(str) {
        // replace spaces with '_' and lowercase all
        return str.replace(/[\?’,.:\s]/g, "_").toLowerCase();
    },

    onDocumentVisibilityChange: function() {
      // Use visibilitystate instead of unload or beforeunload. It's more reliable.
      // See: // https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/

      if (document.visibilityState == "hidden") {
        this.saveState();
      };

      if (document.visibilityState == "visible") {
        //this.loadState();
      };

      $(document).off("visibilitychange", this._onDocumentVisibilityChange);
      $(document).on("visibilitychange", this._onDocumentVisibilityChange);
    }
  }, Backbone.Events);

  Adapt.trackingHub.initialize();
  return (Adapt.trackingHub);
});
