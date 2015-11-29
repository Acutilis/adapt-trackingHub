define([ './xapi-manager'
], function(xapiManager) {

  var XapiMessageComposer = _.extend({

    _NAME: 'xapiMessageComposer',

    compose: function (eventSourceName, eventName, args) {
      var statementParts;
      var statement;
      var timestamp = new Date(Date.now()).toISOString();

      funcName = this.getValidFunctionName(eventSourceName, eventName);
      if (this.hasOwnProperty(funcName)) {
        statement = new ADL.XAPIStatement( xapiManager.actor); 
        statement.timestamp = timestamp;
        statement.generateId();
        // Call the specific composing function for this event
        // it will add things to the statement.
        this[funcName](statement,args); 
        return (statement);
      }
      return (null);
    },

    getValidFunctionName: function (eventSourceName, eventName) {
      return (eventSourceName + '_' + eventName.replace(/:/g, "_"));
    },

    addCustomComposingFunction: function(eventSourceName, eventName, func) {
      func_name = this.getValidFunctionName(eventSourceName, eventName);
      this[func_name] = func;
    },

    /*******************************************/
    /*****  Specific composing functions   *****/
    /*******************************************/

    Adapt_navigationView_preRender: function (statement, args) {
      // course started. Review if this is the right event.
      statement.verb = xapiManager.xapiCustom.verbs.tcr_launched;
      statement.object = new ADL.XAPIStatement.Activity( xapiManager.courseID);
    },

    Adapt_router_menu: function (statement, args) {
      // visited menu
      statement.verb = xapiManager.xapiCustom.verbs.tcr_viewed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.get('_id'));
    },

    Adapt_router_page: function (statement, args) {
      // visited page  
      statement.verb = xapiManager.xapiCustom.verbs.tcr_viewed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.get('_id'));
    },

    Adapt_questionView_complete: function (statement, args) {
      // completed question
      statement.verb = ADL.verbs.completed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.get('_id'));
    },
    
    Adapt_questionView_reset: function (statement, args) {
      // reset question
      statement.verb = xapiManager.xapiCustom.verbs.tcr_viewed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.get('_id'));
    },

    Adapt_questionView_recordInteraction: function (statement, args) {
      // recorded interaction
      var result;
      
      statement.verb = ADL.verbs.answered;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.model.get('_id'));
      result = { score: { scaled: args.model.get('_score') },
        success: args.model.get('_isCorrect'),
        completion: args.model.get('_isComplete'),
        response:  JSON.stringify(args.model.get('_userAnswer'))
      }
      statement.result = result;
     },

    components_change__isInteractionComplete: function (statement, args) {
      // completed interaction
      statement.verb = ADL.verbs.completed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.get('_id'));
    },

    Adapt_assessments_complete: function (statement, args) { 
      // completed assessment 
      statement.verb = ADL.verbs.completed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.id);
      var result = { score: { scaled: args.score },
        success: args.isPass,
        completion: args.isComplete,
        response:  ''
      }
      statement.result = result;
     },

    Adapt_assessments_reset: function (statement, args) {
      // reset assessment
      statement.verb = xapiManager.xapiCustom.verbs.tcr_viewed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.id);
    },

    blocks_change__isComplete: function (statement, args) {
      // completed block
      statement.verb = ADL.verbs.completed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.get('_id'));
    },

    course_change__isComplete: function (statement, args) {
      // completed course
      statement.verb = ADL.verbs.completed;
      statement.object = new ADL.XAPIStatement.Activity(xapiManager.courseID
        + "#" + args.get('_id'));
    }
  }, Backbone.Events);

  return (XapiMessageComposer);
});

