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
    ['triggercards_trigger_', 'triggercards_action__'].forEach((cardName => {
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
              dropdown:0
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
            });
            cardToUser.count.number += cardToUser.count.range || 0;
  
          }
          if(cardType=='triggers') {
            card.on('update', this.updateFlows.bind(this));
            card.registerRunListener(async (args, state) => {
              return null;
              //throw 
              const defer = new Defer();
              try {
                (async ()=>{
                    if(!args.card || !args.card.refType) return defer.reject('no uri given');
                    const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : args.card.refType.indexOf('Trigger') >-1 ? 'trigger' : 'actions';
                    const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                    if (!card) return defer.reject('no card found');
                      
                    // var triggerArgs = Flower.getArgsForTokens({ flow, args, actionCard });
                    
                    // var promise = Flower.triggerFlow({ flow, tokensAsArgs: triggerArgs });
                    // if(cardType=='conditions') return await promise;
                    // else return true;
                    
                    //this.log('args -->', args);
                    var manifest = await homeyApi.getFlowCard({ uri:  args.card.refUri ,id: args.card.refId, type:type });
                    
                    this.log('manifest.args -->', manifest.args);
                    if(manifest.args && manifest.args.length>0 ) this.log('manifest.args[0] -->', manifest.args[0]);
                    var triggerArgs = Flower.getArgsForArgs({ args, actionCard, triggerCard:manifest });
                    //var triggerArgs = Flower.getArgsForTokens({ args, actionCard, triggerCard:triggerManifest });

                    this.log('triggerArgs -->', triggerArgs);

                    //var argsToUse = Flower.getArgsForTokens({ flow, args, actionCard:card, triggerCard:triggerManifest  });
                    
                    var promise = Flower.triggerCard({ card, args: triggerArgs, type:type });
                    this.log('flow triggered' ); 
                    

                    if(cardType=='conditions') {
                      promise.then(r=> {
                        this.log('r = ', r);
                        defer.resolve(r===undefined || r===null ? true : r);
                      }).catch(err=> {
                        this.log('err in it', err);
                        this.error(err);
                        defer.reject((err.name || err) + ' within ' + card.uri + '.' + card.id);
                      });
                    } 
                    else return defer.resolve(true);
                }).call(this).then(()=> {
                }).catch(err=> {
                  this.log('Error triggering CardOverloader Card 2');this.error(err); defer.reject('Error message');
                })
                

              } catch (error) { this.log('Error triggering CardOverloader Card (3)');this.error(error); defer.reject('Error message'); }
              return defer.promise;
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
              
              var {triggerFlows, actionFlows, api } = this.customFlows;
              var toRunActionFlows = _.filter(triggerFlows, (flow,aKey)=> JSON.stringify(flow.trigger.args) == args.triggercard.value );
              for (let i = 0; i < toRunActionFlows.length; i++) toRunActionFlows[i] = await homeyApi.getFlow(toRunActionFlows[i]);
              toRunActionFlows = _.filter(toRunActionFlows, (flow,aKey)=> flow.enabled );
              if(!toRunActionFlows || toRunActionFlows.length==0) return true;
              
              
              // for (const key in toRunActionFlows) {
              //   if (Object.hasOwnProperty.call(toRunActionFlows, key)) {
              //     let flow = toRunActionFlows[key];
                  
              //   }
              // }
              
              // HERERERERR ARE WE LEFT
              //const realFlow = await homeyApi.getFlow(flow);              
              //toRunActionFlows = _.map(toRunActionFlows, flow=>  { return await homeyApi.getFlow(flow); } );
              




              //var json = JSON.parse(args.triggercard.value);
              var filledTokens = JSON.parse(args.tokens);
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
    var folders = await api.flow.getFlowFolders();
    var folderHoop = _.find(folders, f=>f.name=='HOOPInternal');
    if(!folderHoop) {
      folderHoop = new HomeyAPI.ManagerFlow.FlowFolder();
      folderHoop.name = 'HOOPInternal';
      folderHoop = await api.flow.createFlowFolder({flowfolder:folderHoop});
    }
    var folderTriggerCards = _.find(folders, f=>f.name=='Trigger Cards' && f.parent==folderHoop.id );
    if(!folderTriggerCards) {
      folderTriggerCards = new HomeyAPI.ManagerFlow.FlowFolder();
      folderTriggerCards.name = 'Trigger Cards';
      folderTriggerCards.parent = folderHoop.id;
      folderTriggerCards = await api.flow.createFlowFolder({flowfolder:folderTriggerCards});
    }
   
    var allDevices = await api.devices.getDevices();
    var device = _.find(allDevices, d => d.driverUri== 'homey:app:nl.qluster-it.HOOP' && d.driverId == 'triggercards');

    /**@type {{[key:string]:HomeyAPI.ManagerFlow.Flow]} */
    var triggerFlows = {};
    /**@type {{[key:string]:HomeyAPI.ManagerFlow.Flow]} */
    var actionFlows = {};
    var flows = await api.flow.getFlows();
    _.each(flows, (f, key)=> {
      if(f.trigger.uri=='homey:device:' + device.id && f.trigger.id.startsWith('triggercards_trigger__')) triggerFlows[key] = f ;
      if(_.find( f.actions, action=> f.folder==folderTriggerCards.id && action.uri=='homey:device:' + device.id && action.id=='triggercards_action_trigger' )) actionFlows[key] = f ;
    });
    return {triggerFlows, actionFlows, folderTriggerCards, api, device};
  }
  
  async updateFlows () {
    if(this.updating) return;
    this.log('Updating flows');
    this.updating = true;
    try {        
      
      this.customFlows = await this.getAllFlows();
      var {triggerFlows, actionFlows, folderTriggerCards, api, device } = this.customFlows;
      var doneTriggerArgs = [];

      for (const key in triggerFlows) {
        if (Object.hasOwnProperty.call(triggerFlows, key)) {
          const triggerFlow = triggerFlows[key];
          var triggerArgsJson =  JSON.stringify(triggerFlow.trigger.args);
          if(doneTriggerArgs.indexOf(triggerArgsJson)>-1) continue;
          /**@type {HomeyAPI.ManagerFlow.Flow} */
          var actionFlow = _.find(actionFlows, (aFlow,aKey)=> _.find(aFlow.actions, action=> action.args.triggercard.value == triggerArgsJson ));
          if(!actionFlow || actionFlow.length) {        
            actionFlow = new HomeyAPI.ManagerFlow.Flow();
            actionFlow.name = uuidv4();
            actionFlow.folder = folderTriggerCards.id;
            actionFlow.trigger = await api.flow.getFlowCardTrigger({uri:triggerFlow.trigger.args.card.refUri, id:triggerFlow.trigger.args.card.refId, $skipCache:true});
            var args = Flower.getArgsForArgs({args:triggerFlow.trigger.args,triggerCard:actionFlow.trigger });
            actionFlow.trigger.args = args;
            
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
                  tokens[token.type].push('[['+token.id + ']]');
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
        }
      }
      
      for (const key in actionFlows) {
        if (Object.hasOwnProperty.call(actionFlows, key)) {
          const actionFlow = actionFlows[key];
          var action = _.find(actionFlow.actions, action=> action.args.triggercard );
          var triggerFlow = _.find(triggerFlows, (f,aKey)=> JSON.stringify(f.trigger.args) == action.args.triggercard.value );
          if(!triggerFlow) {
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
}

module.exports = TriggerCardsDriver;