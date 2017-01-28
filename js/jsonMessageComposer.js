define([ 'coreJS/adapt'
], function(Adapt) {

  var DefaultMessageComposer = _.extend({

    baseMessage: {
      composer: 'jsonMC_v1.0',
      timestamp: null,
      verb: null,
      object: null,
      objType: null, 
      eventInfo: null,
      text: '',
      extraData: null,
    },

    compose: function (eventSourceName, eventName, args) {
      var funcName = Adapt.trackingHub.getValidFunctionName(eventSourceName, eventName);
      if (this.hasOwnProperty(funcName)) {
        var eventInfo = {};
        _.extend(eventInfo, {
          eventSourceName: eventSourceName,
          eventName: eventName,
          functionName: funcName
        });
        // first, create a message object with the specific data items corresponding to this event
        var message = this[funcName](args);
        // then, fill out the rest of the data items in the message, which are common to all messages
        message.timestamp =  new Date(Date.now()).toISOString();
        message.eventInfo = eventInfo;
      } else {
          var message = _.clone(this.baseMessage);
          message.text = '<<Composing function for ' + funcName + ' not implemented>>';
      }
      return (message);
    },

    addCustomComposingFunction: function(eventSourceName, eventName, func) {
      funcName = this.getValidFunctionName(eventSourceName, eventName);
      this[funcName] = func;
    },


    /*******************************************/
    /*****  Specific composing functions   *****/
    /*******************************************/

    trackingHub_course_launch: function(args) {
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'started';
      message.object = Adapt.trackingHub._config._courseID; // args.get('_id');
      message.objType = 'course';
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      return(message);
    },

    Adapt_router_menu: function (args) {
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'visited';
      message.object = Adapt.trackingHub.getElementKey(args);
      message.objType = 'menu';
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      return (message);
    },

    Adapt_router_page: function (args) {
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'visited';
      message.object = Adapt.trackingHub.getElementKey(args);
      message.objType = args.get('_type');
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      return (message);
    },

    components_change__isComplete: function (args) {
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'completed';
      message.object = Adapt.trackingHub.getElementKey(args);
      message.objType = args.get('_type');
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      if (args.get('_isQuestionType')) {
        message.extraData = {};
        var attribsToCopy = [ '_attempts', '_attemptsLeft', '_component', '_questionWeight', 
            '_score', '_selectedItems', '_userAnswer', '_isCorrect', '_isOptional',
            '_numberOfCorrectAnswers', '_numberOfRequiredAnswers'];
        _.each(attribsToCopy, function(att) {
            message.extraData[att] = args.get(att);
        }, this);
      }
      return (message);
    },


    Adapt_assessments_complete: function (args) {  // plural
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'completed';
      // here args is the state of the assessment (it's not a ref to a component)
      // so we get the id, there's no _title property...
      message.object = args.id;
      message.objType = args.type;
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      message.extraData = {};
      var attribsToCopy = [ 'assessmentWeight','attempts', 'attemptsLeft', 'attemptsSpent', 'assessmentWeight', 
          'isPass', 'score', 'maxScore', 'scoreAsPercent', 'scoreToPass'];
      _.each(attribsToCopy, function(att) {
          message.extraData[att] = args[att];
      }, this);
      return (message);
    },
  
    blocks_change__isComplete: function (args) {
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'completed';
      message.object = Adapt.trackingHub.getElementKey(args);
      message.objType = args.get('_type');
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      return (message);
    },
  
    contentObjects_change__isComplete: function (args) {
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'completed';
      message.object = Adapt.trackingHub.getElementKey(args);
      message.objType = args.get('_type');
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      return (message);
    },

    course_change__isComplete: function (args) {
      var message = _.clone(this.baseMessage);

      message.actor = Adapt.trackingHub.userInfo;
      message.verb = 'completed';
      message.object = Adapt.trackingHub.getElementKey(args);
      message.objType = args.get('_type');
      message.text = message.verb + ' ' + message.objType + ' ' + message.object;
      return (message);
    }
  }, Backbone.Events);

  return (DefaultMessageComposer);

});
