'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    
const homeyApi = require('../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('../../lib/proto');
const Shared = require('../../lib/shared');
const { HomeyAPI } = require('athom-api');

class TriggerCardsDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('TriggerCardsDriver has been initialized');    
        this.flows = {};
        Flower.init(null, this);
    
        this.initializeTriggersConditionsAndActions();
        this.updateFlows();
    }


    // eslint-disable-next-line no-unused-vars
    async onPairListDevices(data)
    {
      const firstId = 'triggercardsdevice';
      let devices = this.getDevices();
      if(devices && devices.length>0) devices = _.filter(devices, device=> device.getData().id==firstId);
      var id = devices && devices.length>0 ? uuidv4() : firstId;
        return {
            "name": 'Trigger Cards',
            data:
            {
                "id": id
            }
        };
    }

    
  initializeTriggersConditionsAndActions() {
    ['triggercards_trigger_', 'triggercards_condition__', 'triggercards_action__'].forEach((cardName => {
        const cardType = cardName.startsWith('triggercards_condition_') ? 'conditions' : cardName.startsWith('triggercards_trigger_') ? 'triggers' : 'actions';
        const actionsCards = {};
        this.flows[cardType] = actionsCards;
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('triggercards_')) continue;
          const card = this.homey.flow[cardType =='conditions' ? 'getConditionCard': cardType =='actions' ? 'getActionCard': 'getDeviceTriggerCard'](actionCard.id);
          const cardToUser = actionsCards[actionCard.id] = {
            id: actionCard.id,
            card: card,
            manifest: actionCard,
            count: {
              text:0,
              number:0,
              boolean:0,
              autocomplete:0,
              dropdown:0,
              time:0
            }
          };

          if(actionCard.id.indexOf('__')>-1) {
            let types = actionCard.id.split('__')[1].split('_');
            _.forEach(types, t=> {
              if(t.startsWith('text')) cardToUser.count['text']= Number.parseInt( t.replace('text',''));
              else if(t.startsWith('number')) cardToUser.count['number']= Number.parseInt( t.replace('number',''));
              else if(t.startsWith('range')) cardToUser.count['range']= Number.parseInt( t.replace('range',''));            
              else if(t.startsWith('boolean')) cardToUser.count['boolean']= Number.parseInt( t.replace('boolean',''));
              else if(t.startsWith('autocomplete')) cardToUser.count['autocomplete']= Number.parseInt( t.replace('autocomplete',''));
              else if(t.startsWith('dropdown')) cardToUser.count['dropdown']= Number.parseInt( t.replace('dropdown',''));
              else if(t.startsWith('time')) cardToUser.count['time']= Number.parseInt( t.replace('time',''));
            });
            cardToUser.count.number += cardToUser.count.range || 0;
  
          }
          if(cardType=='triggers') {
            card.on('update', this.updateFlows.bind(this));
            card.registerRunListener(async (args, state) => {
              return null;
            });
            //this.log('actionCard.args', actionCard.args);
            if (actionCard.args) {            
              if (actionCard.args.find(x => x.name == 'card' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(Shared.registerAutocompleteListenerCard.call(this, {actionCard, cardToUser ,cardType:'triggers', homeyApi}));
              Shared.registerAutocompletes.call(this, {actionCard, homeyApi, Flower, card });
              Shared.registerDropdowns.call(this, {actionCard, homeyApi, card });            
            }
          } 
          else if(cardType=='conditions') {
            card.on('update', this.updateFlows.bind(this));
            card.registerRunListener(async (args, state) => {
              return null;
            });
            //this.log('actionCard.args', actionCard.args);
            if (actionCard.args) {            
              if (actionCard.args.find(x => x.name == 'card' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(Shared.registerAutocompleteListenerCard.call(this, {actionCard, cardToUser ,cardType:'triggers', homeyApi}));
              Shared.registerAutocompletes.call(this, {actionCard, homeyApi, Flower, card });
              Shared.registerDropdowns.call(this, {actionCard, homeyApi, card });
            }
          } 
          else if(cardType=='actions') {    
            card.registerRunListener(async (args, state) => {
              
              var {triggerFlows, actionFlows, api, triggerArgs } = this.customFlows;
              var toRunActionFlows = _.filter(triggerFlows, (flow,aKey)=> this.stringifyClean(flow.trigger.args) == args.triggercard.value || _.find(flow.conditions, con=> this.stringifyClean(con.args) == args.triggercard.value) );
              for (let i = 0; i < toRunActionFlows.length; i++) toRunActionFlows[i] = await homeyApi.getFlow(toRunActionFlows[i]);
              toRunActionFlows = _.filter(toRunActionFlows, (flow,aKey)=> flow.enabled );
              if(!toRunActionFlows || toRunActionFlows.length==0) return true;
              

              //var json = JSON.parse(args.triggercard.value);
              var tokens = args.tokens;
              var i=-1;
              while ((i = tokens.indexOf('[{|}]'))>-1) {
                var start = tokens.substring(0,i);
                var rest = tokens.substring(i+5);
                var i2 = rest.indexOf('[{|}]');
                var end = rest.substring(i2+5);
                var between = rest.substring(0,i2);
                between = between.replace(new RegExp('"', 'g'), '\\"');

                tokens = start + between + end;
              }
              var filledTokens = null;
              try {
                filledTokens = JSON.parse(tokens);
              } catch (error) { }
              var triggerCard = await api.flow.getFlowCardTrigger({uri:toRunActionFlows[0].trigger.uri, id:toRunActionFlows[0].trigger.id, $skipCache:true});
              var triggerTokens = {};
              var tokenCount = {
                string:0,
                number:0,
                boolean:0
              };
              for (const key in triggerCard.tokens) {
                if (Object.hasOwnProperty.call(triggerCard.tokens, key)) {
                  const token = triggerCard.tokens[key];
                  let val = undefined;
                  let valSet = undefined;
                  tokenCount[token.type]++;

                  if(!token.id.startsWith((token.type=='string'?'text':token.type)+'_') || token.id.endsWith('_hasvalue')) {
                    //triggerTokens[token.id] = val;
                    continue;
                  }
                      
                  switch (token.type) {
                    case 'boolean': {
                      if(filledTokens && filledTokens[token.type] && filledTokens[token.type].length>=tokenCount[token.type]) val = valSet = filledTokens[token.type][tokenCount[token.type]]==='true';
                      else val = false;
                      break;
                    }
                    case 'number': {
                      if(filledTokens && filledTokens[token.type] && filledTokens[token.type].length>=tokenCount[token.type]) val = valSet = Number.parseFloat(filledTokens[token.type][tokenCount[token.type]-1].replace(',','.'));
                      else val = -1;
                      break;
                    }
                    default: {
                      if(filledTokens && filledTokens[token.type] && filledTokens[token.type].length>=tokenCount[token.type]) val = valSet = filledTokens[token.type][tokenCount[token.type]-1];
                      else val = "null";
                      break;
                    }
                  }
                  triggerTokens[token.id] = val;
                  triggerTokens[token.id+'_hasvalue'] = valSet!==undefined;

                }
              }
              triggerTokens.error = 'null';
              triggerTokens.stacktrace = 'null';

              _.each(toRunActionFlows, flow=> 
                Flower.triggerFlow({flow:flow, tokensAsArgs: triggerTokens, refreshedFlow:flow})
              );
            });
            //this.log('actionCard.args', actionCard.args);
            if (actionCard.args) {            
              if (actionCard.args.find(x => x.name == 'triggercard' && x.type == 'autocomplete')) card.getArgument('triggercard').registerAutocompleteListener(async (query, args)=> {
                return [];
              });
              Shared.registerAutocompletes.call(this, {actionCard, homeyApi, Flower, card });
              Shared.registerDropdowns.call(this, {actionCard, homeyApi, card }); 
            }
          }
        }
        
      }).bind(this));
  }


  async getAllFlows() {    
    var api = await homeyApi.getAsync();

    var allDevices = await api.devices.getDevices();
    var device = _.find(allDevices, d => d.driverUri== 'homey:app:nl.qluster-it.HOOP' && d.driverId == 'triggercards');

    /**@type {{[key:string]:HomeyAPI.ManagerFlow.Flow]} */
    var triggerFlows = {};
    /**@type {{[key:string]:HomeyAPI.ManagerFlow.Flow]} */
    var actionFlows = {};

    var triggerArgs = [];
    var folderTriggerCards  = null;
    if(device) {
      var folders = await api.flow.getFlowFolders();
      var folderHoop = _.find(folders, f=>f.name=='HOOPInternal');
      if(!folderHoop) {
        folderHoop = new HomeyAPI.ManagerFlow.FlowFolder();
        folderHoop.name = 'HOOPInternal';
        folderHoop = await api.flow.createFlowFolder({flowfolder:folderHoop});
      }
      folderTriggerCards = _.find(folders, f=>f.name=='Trigger Cards' && f.parent==folderHoop.id );
      if(!folderTriggerCards) {
        folderTriggerCards = new HomeyAPI.ManagerFlow.FlowFolder();
        folderTriggerCards.name = 'Trigger Cards';
        folderTriggerCards.parent = folderHoop.id;
        folderTriggerCards = await api.flow.createFlowFolder({flowfolder:folderTriggerCards});
      }
   
    
      var flows = await api.flow.getFlows();
      var l;
      _.each(flows, (f, key)=> {
        if(f.trigger.uri=='homey:device:' + device.id && f.trigger.id.startsWith('triggercards_trigger__')) {
          triggerFlows[key] = f;
          triggerArgs.push(f.trigger.args);
        }
        
        if( (l = _.filter(f.conditions, con=>  con.uri=='homey:device:' + device.id  && con.id.startsWith('triggercards_condition__')) ) && l.length>0) {          
          triggerFlows[key] = f;
          _.each(l, con=> triggerArgs.push(con.args) );
        }
        if(_.find( f.actions, action=> f.folder==folderTriggerCards.id && action.uri=='homey:device:' + device.id && action.id=='triggercards_action_trigger' )) actionFlows[key] = f ;
      });
    }
    return {triggerFlows, actionFlows, folderTriggerCards, api, device, triggerArgs};
  }
  
  async updateFlows () {
    if(this.updating) return;
    this.log('Updating flows');
    this.updating = true;
    try {        
      
      this.customFlows = await this.getAllFlows();
      var {triggerFlows, actionFlows, folderTriggerCards, api, device, triggerArgs } = this.customFlows;
      var doneTriggerArgs = [];

      for (let i = 0; i < triggerArgs.length; i++) {
        const triggerArg = triggerArgs[i];

        
      // }

      // for (const key in triggerFlows) {
      //   if (Object.hasOwnProperty.call(triggerFlows, key)) {
      //     const triggerFlow = triggerFlows[key];
          //let args = _.clone(triggerArg);
          // delete args.actioncardsmode;
          // delete args.conditioncardsmode;
          //var triggerArgsJson =  JSON.stringify(args);

          var triggerArgsJson = this.stringifyClean(triggerArg);
          if(doneTriggerArgs.indexOf(triggerArgsJson)>-1) continue;
          /**@type {HomeyAPI.ManagerFlow.Flow} */
          var actionFlow = _.find(actionFlows, (aFlow,aKey)=> _.find(aFlow.actions, action=> action.args.triggercard.value == triggerArgsJson ));
          if(!actionFlow || actionFlow.length) {        
            actionFlow = new HomeyAPI.ManagerFlow.Flow();
            actionFlow.name = uuidv4();
            actionFlow.folder = folderTriggerCards.id;
            actionFlow.trigger = await api.flow.getFlowCardTrigger({uri:triggerArg.card.refUri, id:triggerArg.card.refId, $skipCache:true});
            let argsToUse = Flower.getArgsForArgs({args:triggerArg,triggerCard:actionFlow.trigger });
            actionFlow.trigger.args = argsToUse;
            
            var tokens = {
              string:[],
              number:[],
              boolean:[]
            };
            _.each(actionFlow.trigger.tokens, token=> {
              switch (token.type) {
                case "number":
                case "boolean":
                case "string":
                default:                  
                  tokens[token.type].push('[{|}][['+token.id + ']][{|}]');
                  break;
              }
            });
            
            var realAction = await api.flow.getFlowCardAction({uri:'homey:device:' + device.id, id:'triggercards_action_trigger', $skipCache:true});

            var actionToDo = {
              uri:realAction.uri,
              id:realAction.id,
              group:'then',
              delay:null,
              duration:null,
              args: {
                triggercard: {id: realAction.uri + ' - ' + realAction.id, name:realAction.uri + ' - ' + realAction.id, value: triggerArgsJson},
                tokens:JSON.stringify(tokens)
              }
            };
            
            actionFlow.actions = [actionToDo];
            actionFlow = await api.flow.createFlow({flow:actionFlow});
            actionFlows[actionFlows.id] = actionFlow;
          }
          doneTriggerArgs.push(triggerArgsJson);
        //}
      }
      
      for (const key in actionFlows) {
        if (Object.hasOwnProperty.call(actionFlows, key)) {
          const actionFlow = actionFlows[key];
          var action = _.find(actionFlow.actions, action=> action.args.triggercard );
          var exists = doneTriggerArgs.indexOf(action.args.triggercard.value)>-1;
          //var triggerFlow = _.find(triggerFlows, (f,aKey)=> this.stringifyClean(f.trigger.args) == action.args.triggercard.value );
          if(!exists) { //!triggerFlow) {
            delete actionFlows[actionFlow.id];
            api.flow.deleteFlow({id:actionFlow.id});
          }
        }
      }
    } catch (error) {
      this.log('Updating flows error');
      this.error(error);
      
    }
    

    this.updating = false;

    //var a= triggerFlows;
   
    

    //flows = _.filter(flows, flow=> flow.trigger)
  }

  stringifyClean(args) {
    args = _.clone(args);
    delete args.actioncardsmode;
    delete args.conditioncardsmode;
    return JSON.stringify(args);
  }
}

module.exports = TriggerCardsDriver;