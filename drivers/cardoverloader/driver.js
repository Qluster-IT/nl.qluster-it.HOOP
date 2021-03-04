'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    
const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');

class CardOverloaderDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('CardOverloaderDriver has been initialized');    
        this.flows = {};
    
        this.initializeConditionsAndActions();    
    }


    async onPairListDevices(data)
    {
        return {
            "name": 'Card Overloader',
            data:
            {
                "id": uuidv4()
            }
        };
    }

    
  initializeConditionsAndActions() {
    ['cardoverloader_condition__','cardoverloader_action__'].forEach((cardName => {
        const cardType = cardName.startsWith('cardoverloader_condition_') ? 'conditions' : 'actions';
        const actionsCards = {};
        this.flows[cardType] = actionsCards
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('cardoverloader_')) continue;
          const card = this.homey.flow[cardType =='actions' ? 'getActionCard': 'getConditionCard'](actionCard.id);
          const cardToUser = actionsCards[actionCard.id] = {
            id: actionCard.id,
            card: card,
            manifest: actionCard,
            count: {
              text:0,
              number:0,
              boolean:0,
              autocomplete:0,
            }
          };
          var types = actionCard.id.split('__')[1].split('_');
          _.forEach(types, t=> {
            if(t.startsWith('text')) cardToUser.count['text']= Number.parseInt( t.replace('text',''));
            else if(t.startsWith('number')) cardToUser.count['number']= Number.parseInt( t.replace('number',''));
            else if(t.startsWith('range')) cardToUser.count['range']= Number.parseInt( t.replace('range',''));
            
            else if(t.startsWith('boolean')) cardToUser.count['boolean']= Number.parseInt( t.replace('boolean',''));
            else if(t.startsWith('autocomplete')) cardToUser.count['autocomplete']= Number.parseInt( t.replace('autocomplete',''));
          });
          cardToUser.count.number += cardToUser.count.range || 0;
          
          card.registerRunListener((args, state) => {
            var defer = new Defer();
            try {
              (async ()=>{
                  
                const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : 'actions';
                const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                if (!card) return false;
                  
                // var triggerArgs = Flower.getArgsForTokens({ flow, args, actionCard });
                
                // var promise = Flower.triggerFlow({ flow, tokensAsArgs: triggerArgs });
                // if(cardType=='conditions') return await promise;
                // else return true;
                
                //var triggerManifest = await homeyApi.getFlowCard({ uri:  args.card.refUri ,id: args.card.refId, type:type });
                
                var triggerArgs = Flower.getArgsForArgs({ args, actionCard, triggerCard:card });
                //var triggerArgs = Flower.getArgsForTokens({ args, actionCard, triggerCard:triggerManifest });

                //this.log('triggerArgs -->', triggerArgs);

                //var argsToUse = Flower.getArgsForTokens({ flow, args, actionCard:card, triggerCard:triggerManifest  });
                var promise = Flower.triggerCard({ card, args: triggerArgs, type:type });

                

                if(cardType=='conditions') {
                  promise.then(r=> {
                    defer.resolve(r===undefined || r===null ? true : r);
                  }).catch(err=> {
                    defer.reject(err + ' within ' + card.uri + '.' + card.id);
                  });
                } 
                else return defer.resolve(true);
              }).call(this).then(res=> {
              }).catch(err=> {
                this.log('Error triggering CardOverloader Card 2');this.error(err); defer.reject('Error message');
              })
              

            } catch (error) { this.log('Error triggering CardOverloader Card (3)');this.error(error); defer.reject('Error message'); }
            return defer.promise;
          });
          //this.log('actionCard.args', actionCard.args);
          if (actionCard.args) {
            if (actionCard.args.find(x => x.name == 'card' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(async (query, args) => {
              try {
                var flowCards = await homeyApi.getFlowCards({type:'actions'});
                //var flowCardsConditions = await homeyApi.getFlowCards({type:'conditions'});
                //var flowCardsActions = await homeyApi.getFlowCards({type:'actions'});
                //var flowCards = _.union(flowCardsConditions, flowCardsActions);
                this.log('cardToUser.count', cardToUser.id, cardToUser.count);
                flowCards = flowCards.filter(card => 
                  {
                  return _.every(['text',  'autocomplete'], type=>  _.sumBy( card.args, arg=> arg.type==type)==cardToUser.count[type])
                  && _.sumBy( card.args, arg=> arg.type=='number' || arg.type=='range') == cardToUser.count.number
                  //boolean
                  && _.sumBy( card.args, arg=> arg.type=='dropdown' && arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' )) == cardToUser.count.boolean
                });

                this.log('flowCards has', flowCards);//_.find(flowCards, c=> c.uriObj && c.uriObj.name=='Hoofdlamp badkamer'));
                
                var r = flowCards.map(f => {
                  /// WHATS OUT, ALL NEED TO BE SAME!
                  if(f.uri.startsWith('homey:device:')) {
                    return { id: f.uri, name: f.uriObj.name + ' - ' + f.id, description: f.title, order:1, isDevice: true, refUri:f.uri, refId : f.id, refType : f.__athom_api_type };
                  } if(f.uri.startsWith('homey:zone:')) {
                    return { id: f.uri, name: f.uriObj.name + ' - ' + f.id, description: f.title, order:1, isDevice: true, refUri:f.uri, refId : f.id, refType : f.__athom_api_type };
                  } else return { id: f.uri, name: f.uri + ' - ' + f.id, description: f.title, order:0, refUri:f.uri, refId : f.id, refType : f.__athom_api_type }
                });
                if (query) r = r.filter(f => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1);
                r = _.uniqBy(r, card => card.id);

                r = _.orderBy(r, [card => card.order, card => card.name, card => card.id ]);
                return r;
              } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
            });
            if (actionCard.args.find(x => x.name.indexOf('autocomplete')>-1)) actionCard.args.filter(x => x.name.indexOf('autocomplete')>-1).forEach(arg=>{
              const argName = arg.name;
                card.getArgument(argName).registerAutocompleteListener(async (query, args) => {
                  try {
                    const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : 'actions';
                    const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                    if (!card) return false;
                    
                    var triggerArgs = Flower.getArgsForArgs({ args, actionCard, triggerCard:card });
                    
                    var promise = Flower.getFlowCardAutocomplete({ card, args: triggerArgs, type:type, query, autocompleteNumber:1 });
                    var r = await promise;
                    
                    // var r =  n.map(x=> {
                    //   return {
                    //   id:x.id || x.name,
                    //   name:x.name
                    //   }
                    // });
                    r.forEach(x=> x.id= x.id || x.name);
                    this.log('r------>', r);

                    return r;

                  } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
                });
              });          
          }
        }
        
      }).bind(this));
  }
}

module.exports = CardOverloaderDriver;