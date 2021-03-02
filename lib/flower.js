const homeyApi = require("./homeyApi");
const { Defer } = require("./proto");
const _ = require('lodash');

const { v4: uuidv4 } = require('uuid');

const defaults = {
  text: 'null',
  number: -1,
  bool: false
}


class Flower {
  static init(app) {
    this.app = app;
    this.homey = app.homey;
    this.log = app.log.bind(app);
    this.error = app.error.bind(app);
  }

  static getRunCard({ card, args }) {
    var toRunCard = {};
    for (const key in card) {
      if (key == 'args') {
        toRunCard[key] = args;
        continue;
      }
      if (Object.hasOwnProperty.call(card, key)) toRunCard[key] = card[key];
    }
    this.log('toRunCard', toRunCard);
    return toRunCard;
  }
  static getArgs({ args, tokens }) {
    this.log('getArgs', args, 'tokens', tokens)
    _.forEach(args, (argValue, argKey) => {
      if (!_.isObject(argValue)) {
        if (_.isString(argValue)) {
          //replace tokens
          var s = argValue;
          var matches = s.match(/(?<=\[\[).*?(?=\]\])/gs)
          if (matches && tokens) matches.forEach(match => {
            if (Object.keys(tokens).indexOf(match) > -1) s = s.replace('[[' + match + ']]', tokens[match]);
          });
          args[argKey] = s;
        }
        else if (!_.isString(argValue)) args[argKey] = argValue;
      } else args[argKey] = argValue;
    });
    return args;
  }

  static async getDropTokens({ args, droptoken, manifest }) {
    try {
      if (!droptoken) return;
      const dropTokens = !manifest || !manifest.droptoken ? null : Array.isArray(manifest.droptoken) ? manifest.droptoken : [manifest.droptoken];
      if (!dropTokens) return null;
      var guid = uuidv4() + '-' + droptoken;
      const arg = _.find(args, (arg, key) => key == droptoken);
      const token = await this.homey.flow.createToken(guid, {
        type: _.isString(arg) ? 'string' : _.isNumber(arg) ? 'number' : 'boolean',
        title: droptoken
      })
      await token.setValue(arg);

      return {
        id: 'homey:app:' + this.app.id + '|' + guid,
        dispose: () => {
          token.unregister();
        }
      }
    } catch (error) {
      this.log('logging the error');
      this.error(error);
    }
  }


  static async getFlowCardAutocomplete({ card, args, tokens, type, query, autocompleteNumber } = {}) {
    var argsToBeUsed = args || card.args;
    argsToBeUsed = tokens ? this.getArgs({ args: argsToBeUsed, tokens: tokens }) : argsToBeUsed
    var toRunCard = this.getRunCard({ card: card, args: argsToBeUsed })
    try {
      var name = card.args.find(arg => arg.type == 'autocomplete').name;
      var a = type == 'actions' ? 'flowcardaction' : 'flowcardcondition';
      toRunCard.type = a;//type.substring(0, type.length-1);
      toRunCard.name = name;
      toRunCard.query = query; //HomeyAPI.ManagerFlow.FlowCardAction
      var r = await (await homeyApi.getHomeyAPI()).flow.getFlowCardAutocomplete(toRunCard);
      //r.then(x=> this.log('x', x)).catch(err=> this.log('err', err));
      //await r;
      //this.log('r', r);
      return r;
    } catch (error) {
      this.log('error here');
      this.error(error);

    }
  }


  static async triggerCard({ card, args, tokens, type } = {}) {
    var argsToBeUsed = args || card.args;
    argsToBeUsed = tokens ? this.getArgs({ args: argsToBeUsed, tokens: tokens }) : argsToBeUsed
    var toRunCard = this.getRunCard({ card: card, args: argsToBeUsed })
    this.log(type == 'actions' ? 'runFlowCardAction' : type == 'conditions' ? 'runFlowCardCondition' : 'runFlowCardTrigger')
    try {

      var r = await (await homeyApi.getHomeyAPI()).flow[type == 'actions' ? 'runFlowCardAction' : type == 'conditions' ? 'runFlowCardCondition' : 'runFlowCardTrigger'](toRunCard);
      //   r.then(x=> this.log('x', x)).catch(err=> this.log('err', err));
      //   await r;
      //this.log('r', r);
      return r;
    } catch (err) {
      this.log('error here');
      this.error(err);
      throw err + ' card: ' + card.uri + '.' + card.id;
    }
  }


  static async triggerFlow({ flow, tokensAsArgs, actioncardsmode, conditioncardsmode }) {
    var defer = new Defer();
    const realFlow = await homeyApi.getFlow(flow);
    actioncardsmode = actioncardsmode || (realFlow.trigger.args && realFlow.trigger.args.actioncardsmode ? realFlow.trigger.args.actioncardsmode : 'async')
    conditioncardsmode = conditioncardsmode || (realFlow.trigger.args && realFlow.trigger.args.conditioncardsmode ? realFlow.trigger.args.conditioncardsmode : 'if-or-or')
    if (!realFlow) return defer.reject('Flow not found.');
    else if (!realFlow.enabled) return defer.reject('Flow disabled.');
    //if(flow.actions.conditions)
    //this.log('realFlow.trigger', realFlow.trigger);

    /// Make possible form conditions also to run async (waiting for end result ofc).
    
    var anyErrored = null;
    var nextGroup = null;
    var group = 'then';
    this.log('conditioncardsmode', conditioncardsmode)
    switch (conditioncardsmode) {
      case 'if-or-or':        
        var conditionGroups = ['group1', 'group2', 'group3'];

        for (let conditionGroupI = 0; conditionGroupI < conditionGroups.length; conditionGroupI++) {
          const conditionGroup = conditionGroups[conditionGroupI];
          const conditions = realFlow.conditions ? _.filter(realFlow.conditions, fc => fc.group == conditionGroup) : null;
          //Need to start Async if async
          //Build in delays
          if (conditions) for (let conditionI = 0; conditionI < conditions.length; conditionI++) {
            const condition = conditions[conditionI];
            try {
              const args = this.getArgs({ args: condition.args, tokens: tokensAsArgs })
              var conditionManifest = await homeyApi.getFlowCard({ uri: condition.uri, id: condition.id, type: 'conditions' });

              var droptoken = await this.getDropTokens({ droptoken: condition.droptoken, args: tokensAsArgs, manifest: conditionManifest });
              const toRunCard = this.getRunCard({ card: condition, args })
              if(droptoken) toRunCard.droptoken = droptoken.id;
              const res = await (await homeyApi.getHomeyAPI()).flow.runFlowCardCondition(toRunCard).catch(err => {
                anyErrored = err;
                this.log('triggerFlow.runFlowCardCondition.err');
                this.error(err);
                return defer.reject(err + ' within ' + flow.name + ' - card: ' + condition.uri + '.' + condition.id);
              });
              
              if(droptoken) droptoken.dispose();

              if (anyErrored) return defer.reject(anyErrored);

              if ((res.result === true && !condition.inverted) || (res.result === false && condition.inverted)) {
                nextGroup = false;
                continue;
              }
              if ((res.result === false && !condition.inverted) || (res.result === true && condition.inverted)) {
                nextGroup = true
                break;
              }
            } catch (error) {
              this.log('error');
              //How to handle erros?
              return defer.reject('Error was thrown');
            }
            if (nextGroup === true) {
              break;
            }
          }
          if (nextGroup === false) break;
        }
        break;
      case 'if-or-finally':
        function runCondition({conditionGroup } ) {
          var defer = new Defer() 
          var nextGroup = null;
          const conditions = realFlow.conditions ? _.filter(realFlow.conditions, fc => fc.group == conditionGroup) : null;
          //Need to start Async if async
          //Build in delays
          (async ()=>{              
            if (conditions) for (let conditionI = 0; conditionI < conditions.length; conditionI++) {
              const condition = conditions[conditionI];
                  try {
                    const args = this.getArgs({ args: condition.args, tokens: tokensAsArgs })
                  var conditionManifest = await homeyApi.getFlowCard({ uri: condition.uri, id: condition.id, type: 'conditions' });
    
                  var droptoken = await this.getDropTokens({ droptoken: condition.droptoken, args: tokensAsArgs, manifest: conditionManifest });
                  const toRunCard = this.getRunCard({ card: condition, args })
                  if(droptoken) toRunCard.droptoken = droptoken.id;
                  const res = await (await homeyApi.getHomeyAPI()).flow.runFlowCardCondition(toRunCard).catch(err => {
                    anyErrored = err;
                    this.log('triggerFlow.runFlowCardCondition.err');
                    this.error(err);
                    return defer.reject(err + ' within ' + flow.name + ' - card: ' + condition.uri + '.' + condition.id);
                  });
                  
                  if(droptoken) droptoken.dispose();
    
                  if (anyErrored) return defer.reject(anyErrored);
    
                  if ((res.result === true && !condition.inverted) || (res.result === false && condition.inverted)) {
                    nextGroup = false;
                    continue;
                  }
                  if ((res.result === false && !condition.inverted) || (res.result === true && condition.inverted)) {
                    nextGroup = true
                    break;
                  }
                } catch (error) {
                  this.log('error');
                  //How to handle erros?
                  return defer.reject('Error was thrown');
                }

              if (nextGroup === true) {
                break;
              }
            }
            this.log('resolving')
            defer.resolve({nextGroup:nextGroup});
          }).call(this);
          return defer.promise;
        }
        
        var conditionGroups = ['group1', 'group2' ];
        for (let conditionGroupI = 0; conditionGroupI < conditionGroups.length; conditionGroupI++) {
          const conditionGroup = conditionGroups[conditionGroupI];
          var conditionResult = await runCondition.call(this, {conditionGroup})
          this.log('conditionResult', conditionResult);
          nextGroup = conditionResult.nextGroup;

          if (nextGroup === false) break;
        }
        var conditionResultGroup3 = await runCondition.call(this, {conditionGroup:'group3'})
        this.log('conditionResultGroup3', conditionResultGroup3);
        break;
      default:
        break;
    }
    
    if (nextGroup) group = 'else';

    var actions = realFlow.actions ? _.filter(realFlow.actions, fa => fa.group == group) : null;
    var promises = [];
    //Need to start Async if async
    //Build in delays
    if (actions) for (let actionI = 0; actionI < actions.length; actionI++) {
      const action = actions[actionI];
      try {
        const args = this.getArgs({ args: action.args, tokens: tokensAsArgs, droptoken: action.droptoken })
        const toRunCard = this.getRunCard({ card: action, args })
        var promise = (await homeyApi.getHomeyAPI()).flow.runFlowCardAction(toRunCard).catch(err => {
          this.log('err', err);
          anyErrored = err;
        });
        promises.push(promise);
        if (actioncardsmode == 'sync') await promise;
      } catch (error) {
        this.log('error from here');
        this.error(error);
      }
    }
    Promise.all(promises).then(x => {
      if (anyErrored) defer.reject(anyErrored);
      else defer.resolve(true);
    }).catch(err => {
      defer.reject(err);
    });
    return defer.promise;
  }

  


  static getArgsForArgs({ args, actionCard, triggerCard } = {}) {
    var newArgsStructure = {};
    _.each(['text', 'number', 'boolean', 'autocomplete', 'range'], type => {
      var count = 0;
      var argsNeeded = _.filter(triggerCard.args, arg => arg.type == type);
      for (let i = 0; i < argsNeeded.length; i++) {
        const arg = argsNeeded[i];
        count++;
        switch (type) {
          case 'autocomplete':
            newArgsStructure[arg.name] = args[type + '_' + count.toString()];
            break;
          case 'range':
            newArgsStructure[arg.name] = args['number' + '_' + count.toString()];
            break;
          default:
            newArgsStructure[arg.name] = args[type + '_' + count.toString()]
            break;
        }
      }
    });
    _.each(_.filter(triggerCard.args, arg => arg.type == 'device'), arg => newArgsStructure[arg.name] = arg);

    this.log('newArgsStructure', newArgsStructure);
    return newArgsStructure;
    //return this.getArgsForTokens({args:newArgsStructure, actionCard, triggerCard})
  }

  /**
   * Used for getting the tokens for triggers setup
   * @param {*} param0 
   */
  static getArgsForTokens({ args, actionCard, triggerCard } = {}) {
    var filledArgs = {};
    for (const key in _.orderBy(actionCard.args, arg => arg.name)) {
      if (Object.hasOwnProperty.call(actionCard.args, key)) {
        const arg = actionCard.args[key];
        var type = arg.name.split('_')[0];
        switch (type) {
          case 'text':
            fillArgs('text', args, arg);
            break;
          case 'number':
            fillArgs('number', args, arg);
            break;
          case 'boolean':
            fillArgs('boolean', args, arg);
            break;
          case 'autocomplete':
            fillArgs('autocomplete', args, arg);
            break;
          default:
            break;
        }
      }
    }
    var argsToUse = {};
    //var ownFlowItem = this.flows.triggers[flow.trigger.id];
    //var triggerManifest = homeyApi.getFlowCard({ uri:  flow.trigger.uri ,id: flow.trigger.id, type:'triggers' });    
    // homeyApi.getFlowCard({ uri:  flow.trigger.uri ,id: flow.trigger.id, type:'triggers' }).then(x=> {
    //     this.log('getFlowCard', x);
    // });    

    // var ownFlowItem = device.flows.triggers[flow.trigger.id];
    // this.log('flow.trigger', flow);
    // this.log('ownFlowItem', ownFlowItem);
    //this.log('triggerManifest', triggerManifest);

    for (const key in _.orderBy(triggerCard.tokens, token => token.id)) {
      if (Object.hasOwnProperty.call(triggerCard.tokens, key)) {
        const token = triggerCard.tokens[key];
        if (token.id.split('_').length > 2) continue;
        switch (token.type) {
          case 'string':
            fillTokens('text');
            break;
          case 'number':
            fillTokens('number');
            break;
          case 'boolean':
            fillTokens('boolean');
            break;
          default:
            break;
        }
      }
    }
    var triggerArgs = {};
    for (const key in argsToUse) {
      if (Object.hasOwnProperty.call(argsToUse, key)) {
        const arg = argsToUse[key];
        for (let i = 0; i < arg.length; i++) {
          switch (key) {
            case 'boolean':
              const _val = arg[i];// || defaults[key];
              const val = _val === 'true' || _val === true ? true : _val === 'false' || _val === false ? false : null;
              triggerArgs[key + '_' + (i + 1)] = (val !== null ? val : defaults[key]);
              triggerArgs[key + '_' + (i + 1) + '_hasvalue'] = val !== null;
              break;
            default:
              const valText = arg[i] || defaults[key];
              triggerArgs[key + '_' + (i + 1)] = valText;
              triggerArgs[key + '_' + (i + 1) + '_hasvalue'] = valText != null && (valText != defaults[key]) && !(key == 'text' && valText == 'null');
              break;
          }
        }
      }
    }

    return triggerArgs;


    function fillArgs(type, args, arg) {
      if (!filledArgs[type]) filledArgs[type] = [];
      var toPush = null;
      switch (type) {
        case 'autocomplete':
          toPush = _.find(args, arg => arg.type == type)
          break;
        default:
          toPush = type == 'boolean' ? args[arg.name] === 'true' || args[arg.name] === true || args[arg.name] === 'false' || args[arg.name] === false : args[arg.name] || null;
          break;
      }
      filledArgs[type].push(toPush);
    }
    function fillTokens(type) {
      if (!argsToUse[type]) argsToUse[type] = [];
      var val = filledArgs && filledArgs[type] && filledArgs[type].length > argsToUse[type].length ? filledArgs[type][argsToUse[type].length] : null;
      argsToUse[type].push(val);
    }
  }
}


module.exports = Flower;