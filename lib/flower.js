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
  static init(app, driver) {
    if(this.app) return;
    if(app) this.app = app; else app = driver;
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
    //this.log('toRunCard', toRunCard);
    return toRunCard;
  }
  static getArgs({ args, tokens }) {
    _.forEach(args, (argValue, argKey) => {
      if (!_.isObject(argValue)) {
        if (_.isString(argValue)) {
          //replace tokens
          var s = argValue;
          if(tokens) _.each(tokens, (tokenValue, tokenKey)=> {
            s = s.replace('[['+tokenKey+']]', tokens[tokenKey]);
          })
          // var matches = s.match(/(?<=\[\[).*?(?=\]\])/gs)
          // if (matches && tokens) matches.forEach(match => {
          //   if (Object.keys(tokens).indexOf(match) > -1) s = s.replace('[[' + match + ']]', tokens[match]);
          // });
          args[argKey] = s;
        }
        else if (!_.isString(argValue)) args[argKey] = argValue;
      } else args[argKey] = argValue;
    });
    return args;
  }

  static async getDropTokens({ args, droptoken, manifest }) {
    try {
      if (!droptoken || !args) return;
      const dropTokens = !manifest || !manifest.droptoken ? null : Array.isArray(manifest.droptoken) ? manifest.droptoken : [manifest.droptoken];
      if (!dropTokens) return null;
      var guid = uuidv4() + '-' + droptoken;
      if(Object.keys(args).indexOf(droptoken)>-1) {
        const arg = _.find(args, (arg, key) => key == droptoken);
        if(arg!==null && arg!==undefined) {
          //this.log('getDropTokens type: ', _.isString(arg) ? 'string' : _.isNumber(arg) ? 'number' : 'boolean', '\r\nargs: ', args, '\r\narg: ', arg);
          const token = await this.homey.flow.createToken(guid, {
            type: _.isString(arg) ? 'string' : _.isNumber(arg) ? 'number' : 'boolean',
            title: droptoken
          })
          await token.setValue(arg);        
          return {
            id: 'homey:app:' + this.app.id + '|' + guid,
            dispose: (() => {
              //this.log('disposeing token: ', 'homey:app:' + this.app.id + '|' + guid);
              token.unregister();
            }).bind(this)
          }
        }
      }
      return null;
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
   // this.log(type == 'actions' ? 'runFlowCardAction' : type == 'conditions' ? 'runFlowCardCondition' : 'runFlowCardTrigger')
    // this.log('toRunCard', toRunCard);
    try {

      var r = await (await homeyApi.getHomeyAPI()).flow[type == 'actions' ? 'runFlowCardAction' : type == 'conditions' ? 'runFlowCardCondition' : 'runFlowCardTrigger'](toRunCard)
        .catch(err=> {
          this.log('something wend wrong'); 
          this.error(err);
        });
      //   r.then(x=> this.log('x', x)).catch(err=> this.log('err', err));
      //   await r;
      //this.log('r', r);
      return r;
    } catch (err) {
      this.log('error here');
      this.error(err);
      throw (err.name||err) + ' card: ' + card.uri + '.' + card.id;
    }
  }


  static async triggerFlow({ flow, tokensAsArgs, actioncardsmode, conditioncardsmode }) {
    this.log('triggerflow + ' + flow.name);
    //this.log('tokensAsArgs', tokensAsArgs);
    var defer = new Defer();
    try {      
      const realFlow = await homeyApi.getFlow(flow);
      actioncardsmode = actioncardsmode || (realFlow.trigger.args && realFlow.trigger.args.actioncardsmode ? realFlow.trigger.args.actioncardsmode : 'async')
      conditioncardsmode = conditioncardsmode || (realFlow.trigger.args && realFlow.trigger.args.conditioncardsmode ? realFlow.trigger.args.conditioncardsmode : 'if-or-or')
      if (!realFlow) return defer.reject('Flow not found.');
      else if (!realFlow.enabled) return defer.reject('Flow disabled.');
      
      /// Make possible form conditions also to run async (waiting for end result ofc).
      
      var anyErrored = null;
      var nextGroup = null;
      var group = 'then';

      async function runCondition({condition, args, tokensAsArgs, conditionManifest}) {
        var returnValue = null;
        var returnError = null;
            try {                  
              var droptoken = await this.getDropTokens({ droptoken: condition.droptoken, args: tokensAsArgs, manifest: conditionManifest });
              const toRunCard = this.getRunCard({ card: condition, args })
              if (droptoken) toRunCard.droptoken = droptoken.id;
              this.log('toRunCard = ', toRunCard);
              const res = await (await homeyApi.getHomeyAPI()).flow.runFlowCardCondition(toRunCard).catch(err => {
                this.log('runCondition.error');
                this.error(err);
                returnError = CustomError.new(err, 'Flow \"' + flow.name + '\" - card: ' + condition.uri + '.' + condition.id)              
              });
        
              if (!returnError && res) {
                if ((res.result === true && !condition.inverted) || (res.result === false && condition.inverted)) {
                  returnValue = true;
                }
                if ((res.result === false && !condition.inverted) || (res.result === true && condition.inverted)) {
                  returnValue = false;
                }
              }
              return { value: returnValue, error: returnError }
            } catch (error) {
              return { value: null,  error: CustomError.new(error, 'Flow \"' + flow.name + '\" - card: ' + condition.uri + '.' + condition.id)     }
            }finally {
              if(droptoken) droptoken.dispose();
            }
      }

      function runConditionGroup({ conditionGroup, error }) {
        this.log('runConditionGroup');
        var defer = new Defer()
        var nextGroup = null;
        const conditions = realFlow.conditions ? _.filter(realFlow.conditions, fc => fc.group == conditionGroup) : null;
        //Need to start Async if async
        //Build in delays
        //this.log('runConditionGroup', conditionGroup);
        //this.log('runConditionGroup')
        //this.log(conditionGroups)
        (async ()=> {
          try {
            //this.log('hallo');
            var flowDirectorConditionModeIndex = -1;
            var flowDirectorConditionModes = [];
            
          
            if (conditions) for (let conditionI = 0; conditionI < conditions.length; conditionI++) {
              const condition = conditions[conditionI];
              //this.log('condition used: ', condition);
              try {
                var flowDirectorConditionMode = flowDirectorConditionModeIndex>-1 && flowDirectorConditionModes.length>flowDirectorConditionModeIndex ? flowDirectorConditionModes[flowDirectorConditionModeIndex] : null;
                
                const conditionManifest = await homeyApi.getFlowCard({ uri: condition.uri, id: condition.id, type: 'conditions' });

                if(conditionManifest && conditionManifest.uriObj && conditionManifest.uriObj.meta && conditionManifest.uriObj.meta.driverUri==='homey:app:nl.qluster-it.HOOP') {
                  if(conditionManifest.id.startsWith('flowdirector_condition___')
                  //&& ['flowdirector_condition__if', 'flowdirector_condition__orelse', 'flowdirector_condition__then', 'flowdirector_condition__else', 'flowdirector_condition__elseif', 'flowdirector_condition__endif', ].indexOf(conditionManifest.id)>-1
                  ) {
                    switch (conditionManifest.id.split('___')[1]) {
                      case 'if':
                        flowDirectorConditionModeIndex++;                  
                        flowDirectorConditionMode = {
                          ifTarget: true,// !condition.inverted,
                          ifValue : null,//!condition.inverted,
                          ifValueAbsolute:null,
                          andAlso : !condition.inverted,
                          if:true,
                          run:false,
                          ended:false,
                          gotoElse:false
                        }
                        if(flowDirectorConditionModes.length>flowDirectorConditionModeIndex) flowDirectorConditionModes[flowDirectorConditionModeIndex] = flowDirectorConditionMode;
                        else flowDirectorConditionModes.push(flowDirectorConditionMode);
                        break;
                      case 'orelse':
                        if(flowDirectorConditionMode.run)  flowDirectorConditionMode.hasRunned = !(flowDirectorConditionMode.run=false);
                        if(flowDirectorConditionMode.hasRunned) break;

                        if(flowDirectorConditionMode) {
                          if(flowDirectorConditionMode.ifValue===flowDirectorConditionMode.ifTarget) {
                            if(!condition.inverted) flowDirectorConditionMode.if=false;
                            else if(flowDirectorConditionMode.ifValue===true) flowDirectorConditionMode.ifValueAbsolute=flowDirectorConditionMode.ifValue;
                          }
                          else flowDirectorConditionMode.if = (flowDirectorConditionMode.ifValue = null) == null;
                          
                        } else throw 'OrElse without a If statement';
                        break;
                      case 'then':
                        
                        if(flowDirectorConditionMode.run)  flowDirectorConditionMode.hasRunned = !(flowDirectorConditionMode.run=false);
                        if(flowDirectorConditionMode.hasRunned) break;
                        //if(flowDirectorConditionMode.run) break;
                        if(flowDirectorConditionMode.ifValueAbsolute!==null) flowDirectorConditionMode.ifValue = flowDirectorConditionMode.ifValueAbsolute;
                        if(flowDirectorConditionMode && (flowDirectorConditionMode.ifValue===flowDirectorConditionMode.ifTarget)) flowDirectorConditionMode.run = !(flowDirectorConditionMode.if=false) ;
                        else if(flowDirectorConditionMode && (flowDirectorConditionMode.ifValue!==flowDirectorConditionMode.ifTarget)) flowDirectorConditionMode.gotoElse = !(flowDirectorConditionMode.if=false);
                        break;
                      case 'else':
                        if(flowDirectorConditionMode.run)  flowDirectorConditionMode.hasRunned = !(flowDirectorConditionMode.run=false);
                        if(flowDirectorConditionMode.hasRunned) break;

                        if(flowDirectorConditionMode.run) flowDirectorConditionMode.run =flowDirectorConditionMode.if = false;
                        else flowDirectorConditionMode.run =  flowDirectorConditionMode.gotoElse===true;
                      
                          
                        break;
                      case 'elseif':
                        if(flowDirectorConditionMode.run)  flowDirectorConditionMode.hasRunned = !(flowDirectorConditionMode.run=false);
                        if(flowDirectorConditionMode.hasRunned) break;
                        
                        if(!flowDirectorConditionMode.gotoElse)  break;

                        if(flowDirectorConditionMode) {
                          if(flowDirectorConditionMode.ifValueAbsolute!==true) {
                            if(flowDirectorConditionMode.ifValue!==true) flowDirectorConditionMode.if = !(flowDirectorConditionMode.run = flowDirectorConditionMode.gotoElse = (flowDirectorConditionMode.ifValue=null)!=null);                      
                            else if(flowDirectorConditionMode.ifValue===true) flowDirectorConditionMode.if = flowDirectorConditionMode.run = flowDirectorConditionMode.gotoElse = (flowDirectorConditionMode.ifValue=null)!=null;
                          } 
                        }
                        break;
                      case 'endif':
                        flowDirectorConditionModeIndex--;
                        if(flowDirectorConditionMode) flowDirectorConditionMode.ended = true;
                        break;
                    }
                    //this.log('condition flowing: ', conditionManifest.id.split('___')[1], " is ", flowDirectorConditionMode);
                    continue;
                  } 
                }
                if (flowDirectorConditionMode) {
                  if(flowDirectorConditionMode.if===true) {
                    //this.log('flowDirectorConditionMode.if===true');
                    var args = this.getArgs({ args: condition.args, tokens: tokensAsArgs });
                    //this.log('args', args);
                    var result = await runCondition.call(this, {condition, args, tokensAsArgs, conditionManifest, error});

                    //this.log('flowDirectorConditionMode.if===true result: ', result);
                    if(result.error) {
                      result.error.name = result.error.name.replace (' - card:', ' - card '+(conditionI+1) +' from '+ conditionGroup +':')
                      return defer.reject(result.error);
                    }
                    if(flowDirectorConditionMode.ifValue===flowDirectorConditionMode.ifTarget || flowDirectorConditionMode.ifValue===null) flowDirectorConditionMode.ifValue = result.value;
                    if(flowDirectorConditionMode.ifValue!== flowDirectorConditionMode.ifTarget && flowDirectorConditionMode.andAlso) flowDirectorConditionMode.if=false;
                    continue;
                  }
                  else if(flowDirectorConditionMode.run || flowDirectorConditionMode.ended) {
                    //let is run
                  } else continue;
                }
                

                
                //this.log('conditionManifest', conditionManifest)
                if(error) {
                  if(!tokensAsArgs) tokensAsArgs={};
                  tokensAsArgs['homey:app:' +this.app.id + '|error'] = error.name || error || 'error';
                  tokensAsArgs['homey:app:' +this.app.id + '|stacktrace'] = error.stack && error.stack.length>0 ? error.stack[0] :  '';
                }
                
                
                
                //this.log('tokensAsArgs', tokensAsArgs)
                //this.log('conditionManifest', conditionManifest);
                //this.log('condition.args', condition.args);
                //this.log('conditionManifest', conditionManifest);
                var args = this.getArgs({ args: condition.args, tokens: tokensAsArgs });
                //this.log('args', args);
                
                // if(conditionManifest && conditionManifest.uriObj && conditionManifest.uriObj.meta && conditionManifest.uriObj.meta.driverUri==='homey:app:nl.qluster-it.HOOP') {
                //   if(conditionManifest.id.startsWith('actioncards_condition__') ) {
                //     const toTriggerCard = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:args.card.refType.indexOf('Condition') >-1 ? 'conditions' : 'actions' });
                //     //args = this.getArgsForArgs({ args, actionCard: condition, triggerCard:toTriggerCard });
                //     //this.log('triggerArgs', args);
                //   }
                // };
                

                var result = await runCondition.call(this, {condition, args, tokensAsArgs, conditionManifest, error});
                if(result.error) {
                  
                  result.error.name = result.error.name.replace (' - card:', ' - card '+(conditionI+1) +' from '+ conditionGroup +':')
                  return defer.reject(result.error);
                }

                if ((result.value === true && !condition.inverted) || (result.value === false && condition.inverted)) {
                  nextGroup = false;
                  continue;
                }
                if ((result.value === false && !condition.inverted) || (result.value === true && condition.inverted)) {
                  nextGroup = true
                  break;
                }
              } catch (error) {
                this.log('error');
                //How to handle erros?
                return defer.reject('Error was thrown: ' + error);
              }

              if (nextGroup === true) {
                break;
              }
            }
            defer.resolve({ nextGroup: nextGroup });
          }
          catch(err) {
            log('runConditionGroup async inner err', err);
            //flower.error(err);
            return defer.reject(err);
          }
        }).call(this).catch(err=> {
         
        });
        return defer.promise;
      }
      
      //this.log('conditioncardsmode --> ' , conditioncardsmode);
      switch (conditioncardsmode) {
        case 'if-or-or':
          
          var conditionGroups = ['group1', 'group2', 'group3'];
          for (let conditionGroupI = 0; conditionGroupI < conditionGroups.length; conditionGroupI++) {
            const conditionGroup = conditionGroups[conditionGroupI];
            //try {
              
            var conditionResult = await runConditionGroup.call(this, { conditionGroup })
            nextGroup = conditionResult.nextGroup;
            if (nextGroup === false) break;
            //} catch (error) {
            //  this.log('here is the error');
            //  this.error(error);
            //}
          }
          break;
        case 'if-or-finally':
          var conditionGroups = ['group1', 'group2'];
          for (let conditionGroupI = 0; conditionGroupI < conditionGroups.length; conditionGroupI++) {
            const conditionGroup = conditionGroups[conditionGroupI];
            var conditionResult = await runConditionGroup.call(this, { conditionGroup })
            nextGroup = conditionResult.nextGroup;

            if (nextGroup === false) break;
          }
          var conditionResultGroup3 = await runConditionGroup.call(this, { conditionGroup: 'group3' })
          break;        
        case 'try-catch-finally':
          var errorGroup1 = null, errorGroup2 = null, errorGroup3 = null;
          
          var conditionResultGroup1 = await runConditionGroup.call(this, { conditionGroup: 'group1' }).catch(err=> errorGroup1 = err);
          
          if(errorGroup1) await runConditionGroup.call(this, { conditionGroup: 'group2', error:errorGroup1 }).catch(err=> errorGroup2 = err);
          
          if(errorGroup2) return defer.reject(errorGroup2.name);

          var conditionResultGroup3 = await runConditionGroup.call(this, { conditionGroup: 'group3', error:errorGroup1 }).catch(err=> errorGroup3 = err);

          if(errorGroup3) return defer.reject(errorGroup3.name);

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
          //this.log('action.args', action.args, '--> tokens, ', tokensAsArgs );
          const args = this.getArgs({ args: action.args, tokens: tokensAsArgs })
          const toRunCard = this.getRunCard({ card: action, args })
          var promise = (await homeyApi.getHomeyAPI()).flow.runFlowCardAction(toRunCard).catch(err => {
            this.log('err', err);
            anyErrored = CustomError.new(err, 'within ' + flow.name + ' - card: ' + action.uri + '.' + action.id)
          });
          promises.push(promise);
          if (actioncardsmode == 'sync') await promise;
        } catch (error) {
          this.error(error);
        }
      }
      Promise.all(promises).then(x => {
        if (anyErrored) defer.reject(anyErrored.name);
        else defer.resolve(true);
      }).catch(err => {
        //defer.reject(err.name || err);
        defer.reject(err.name + '\r\n' + err.stack);
      });
    } catch (error) {
      this.log('triggerFlow.error');
      this.error(error);
      defer.reject(error);
    }
    return defer.promise;
  }






  static getArgsForAutocomplete({ args, actionCard, triggerCard } = {}) {
    var newArgsStructure = {};
    var count = {};
    _.each(['text', 'number', 'boolean', 'autocomplete', 'range', 'dropdown'], type => {
      count[type] = 0;
      var argsNeeded = _.filter(triggerCard.args, arg => arg.type == type);
      for (let i = 0; i < argsNeeded.length; i++) {
        const arg = argsNeeded[i];
        switch (type) {
          case 'autocomplete':
            count[type]++;
            newArgsStructure[arg.name] = args[type + '_' + count[type].toString()];
            break;
          case 'dropdown':
            
            if(arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' )) {         
              count['boolean']++;
              newArgsStructure[arg.name] = args['boolean' + '_' + count['boolean'].toString()];
              break;
            } else {
              count[type]++;
              newArgsStructure[arg.name] = args[type + '_' + count[type].toString()];
              break;
            }
          case 'checkbox':
            count['boolean']++;
            newArgsStructure[arg.name] = args['boolean' + '_' + count['boolean'].toString()];
            break;
          case 'range':
            count['number']++;
            newArgsStructure[arg.name] = args['number' + '_' + count['number'].toString()];
            break;
          default:
            count[type]++;
            newArgsStructure[arg.name] = args[type + '_' + count[type].toString()]
            break;
        }
      }
    });
    return newArgsStructure;
  }
  
  static getArgsForArgs({ args, actionCard, triggerCard } = {}) {
    var newArgsStructure = {};
    var count = {};
    _.each(['text', 'number', 'boolean', 'autocomplete', 'range', 'dropdown'], type => {
      count[type] = 0;
      var argsNeeded = _.filter(triggerCard.args, arg => arg.type == type);
      for (let i = 0; i < argsNeeded.length; i++) {
        const arg = argsNeeded[i];
        switch (type) {
          case 'autocomplete':
            count[type]++;
            newArgsStructure[arg.name] = args[type + '_' + count[type].toString()];
            break;
          case 'dropdown':
            
            if(arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' )) {         
              count['boolean']++;
              newArgsStructure[arg.name] = args['boolean' + '_' + count['boolean'].toString()].id;
              break;
            } else {
              count[type]++;
              newArgsStructure[arg.name] = args[type + '_' + count[type].toString()].id;
              break;
            }            
          case 'checkbox':
            count['boolean']++;
            newArgsStructure[arg.name] = args['boolean' + '_' + count['boolean'].toString()];
            break;
          case 'range':
            count['number']++;
            newArgsStructure[arg.name] = args['number' + '_' + count['number'].toString()];
            break;
          default:
            count[type]++;
            newArgsStructure[arg.name] = args[type + '_' + count[type].toString()]
            break;
        }
      }
    });

    //Does this need to be on?
    // _.each(triggerCard.args, (argValue, argKey) => { if(Object.keys(newArgsStructure).indexOf(argKey)==-1) {
    //     this.log('setting new argstructure: ', argKey, ' = ', argValue);
    //     newArgsStructure[argKey] = argValue;
    //   }
    //  });

    //this.log('newArgsStructure', newArgsStructure);
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
          case 'dropdown':
            fillArgs('dropdown', args, arg);
            break;
          default:
            //this.log('getArgsForTokens default args:', args, '\r\narg: ', arg);
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
class CustomError {
  static new(err, stack) {
    return {name:err.name, stack: _.isArray(stack) ? stack : stack ? [stack] : undefined}
    var error = new Error(err.name);
    error.stack = stacktrace;
    return error;
  }
}

module.exports = Flower;