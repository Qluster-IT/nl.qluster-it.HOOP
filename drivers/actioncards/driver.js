'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    
const homeyApi = require('../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('../../lib/proto');
const Shared = require('../../lib/shared');

class CardOverloaderDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('CardOverloaderDriver has been initialized');    
        this.flows = {};
        Flower.init(null, this);
    
        this.initializeTriggersConditionsAndActions();    
    }


    // eslint-disable-next-line no-unused-vars
    async onPairListDevices(data)
    {
      const firstId = 'actioncardsdevice';
      let devices = this.getDevices();
      if(devices && devices.length>0) devices = _.filter(devices, device=> device.getData().id==firstId);
      var id = devices && devices.length>0 ? uuidv4() : firstId;
        return {
            "name": 'Action Cards',
            data:
            {
                "id": id
            }
        };
    }

    
  initializeTriggersConditionsAndActions() {
    ['actioncards_condition__','actioncards_action__'].forEach((cardName => {
        const cardType = cardName.startsWith('actioncards_condition_') ? 'conditions' : cardName.startsWith('actioncards_trigger_') ? 'triggers' : 'actions';
        const actionsCards = {};
        this.flows[cardType] = actionsCards;
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('actioncards_')) continue;
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
          
          if(cardType=='trigger');
          else card.registerRunListener((args, state) => {
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
            if (actionCard.args.find(x => x.name == 'card' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(Shared.registerAutocompleteListenerCard.call(this, {actionCard, cardToUser ,cardType:'actions', homeyApi}));
            Shared.registerAutocompletes.call(this, {actionCard, homeyApi, Flower, card });
            Shared.registerDropdowns.call(this, {actionCard, homeyApi, card });
          }
        }
        
      }).bind(this));
  }
}

module.exports = CardOverloaderDriver;