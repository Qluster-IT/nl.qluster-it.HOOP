'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    
const homeyApi = require('../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('../../lib/proto');
const Shared = require('../../lib/shared');

class TriggerCardsDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('TriggerCardsDriver has been initialized');    
        this.flows = {};
        Flower.init(null, this);
    
        this.initializeTriggersConditionsAndActions();    
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
    ['triggercards_trigger__'].forEach((cardName => {
        const cardType = cardName.startsWith('triggercards_condition_') ? 'conditions' : cardName.startsWith('triggercards_trigger_') ? 'triggers' : 'actions';
        const actionsCards = {};
        this.flows[cardType] = actionsCards;
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('triggercards_')) continue;
          const card = this.homey.flow[cardType =='conditions' ? 'getConditionCard': cardType =='actions' ? 'getActionCard': 'getTriggerCard'](actionCard.id);
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
          
          card.registerRunListener((args, state) => {
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
            try {
              var aaa = Shared.registerAutocompleteListenerCard.call(this, {actionCard, cardToUser ,cardType, homeyApi});
              var bbb=aaa;
            } catch (error) {
              
            }
            if (actionCard.args.find(x => x.name == 'card' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(Shared.registerAutocompleteListenerCard.call(this, {actionCard, cardToUser ,cardType, homeyApi}));
            if (actionCard.args.find(x => x.name.indexOf('autocomplete')>-1)) actionCard.args.filter(x => x.name.indexOf('autocomplete')>-1).forEach(arg=>{
              const argName = arg.name;
              card.getArgument(argName).registerAutocompleteListener(async (query, args) => {
                try {
                  if(!args.card || !args.card.refType) return false;
                  const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : args.card.refType.indexOf('Trigger') >-1 ? 'triggers' : 'actions';
                  const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                  if (!card) return false;                  
                  var triggerArgs = Flower.getArgsForAutocomplete({ args, actionCard, triggerCard:card });                  
                  var promise = Flower.getFlowCardAutocomplete({ card, args: triggerArgs, type:type, query, autocompleteNumber:1 });
                  var r = await promise;
                  return r;

                } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
              });
            });
            if (actionCard.args.find(x => x.name.indexOf('dropdown')>-1)) actionCard.args.filter(x => x.name.indexOf('dropdown')>-1).forEach(arg=>{
              const argName = arg.name;
              card.getArgument(argName).registerAutocompleteListener(async (query, args) => {
                try {
                  console.log('registerAutocompleteListener args.card');
                  console.log(args.card);
                  const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : args.card.refType.indexOf('Trigger') >-1 ? 'triggers' : 'actions';
                  const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                  if (!card) return false;
                  //Only first is option right now.
                  this.log('card.args', card.args)
                  var arg = _.find(card.args, a=> a.type=='dropdown');// && !(arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' ))
                  this.log('arg', arg)
                  if(!arg) return false;

                  this.log('arg', arg);
                  return arg.values;

                } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
              });
            }); 
          }
        }
        
      }).bind(this));
  }
}

module.exports = TriggerCardsDriver;