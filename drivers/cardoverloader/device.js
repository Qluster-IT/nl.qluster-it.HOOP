'use strict';

const Homey = require('homey');

const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');
const defaults = {
  text: 'null',
  number: -1,
  bool: false
}

class CardOverloaderDevice extends Homey.Device {
  async onInit() {
    this.log('CardOverloaderDevice has been initialized');
    this.flows = {};

    this.initializeConditionsAndActions();


  }




  initializeConditionsAndActions() {
    ['cardoverloader_condition__','cardoverloader_action__'].forEach((cardName => {
      var cardType = cardName.startsWith('cardoverloader_condition_') ? 'conditions' : 'actions';
        var actionsCards = {};
        this.flows[cardType] = actionsCards
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('cardoverloader_')) continue;
          var card = this.homey.flow[cardType =='actions' ? 'getActionCard': 'getConditionCard'](actionCard.id);
          var cardToUser = actionsCards[actionCard.id] = {
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
            else if(t.startsWith('boolean')) cardToUser.count['boolean']= Number.parseInt( t.replace('boolean',''));
            else if(t.startsWith('autocomplete')) cardToUser.count['autocomplete']= Number.parseInt( t.replace('autocomplete',''));
          });
          this.log('cardToUser.count', cardToUser.count);

          card.registerRunListener(async (args, state) => {
            try {
              this.log('args.card', args.card)
              var type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : 'actions';
              this.log('type', type)
              var card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
              if (!card) return false;
                
              // var triggerArgs = Flower.getArgsForTokens({ flow, args, actionCard });
              
              // var promise = Flower.triggerFlow({ flow, tokensAsArgs: triggerArgs });
              // if(cardType=='conditions') return await promise;
              // else return true;
              
              var triggerManifest = await homeyApi.getFlowCard({ uri:  args.card.refUri ,id: args.card.refId, type:type });
              
              var triggerArgs = Flower.getArgsForArgs({ args, actionCard, triggerCard:triggerManifest });
              //var triggerArgs = Flower.getArgsForTokens({ args, actionCard, triggerCard:triggerManifest });

              this.log('triggerArgs -->', triggerArgs);

              //var argsToUse = Flower.getArgsForTokens({ flow, args, actionCard:card, triggerCard:triggerManifest  });
              var promise = Flower.triggerCard({ card, args: triggerArgs, type:type });

              if(cardType=='conditions') return await promise;
              else return true;

            } catch (error) { this.error(error) }
          });
          if (actionCard.args) {
            if (actionCard.args.find(x => x.name == 'card' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(async (query, args) => {
              try {
                var flowCards = await homeyApi.getFlowCards({type:'actions'});
                //var flowCardsConditions = await homeyApi.getFlowCards({type:'conditions'});
                //var flowCardsActions = await homeyApi.getFlowCards({type:'actions'});
                //var flowCards = _.union(flowCardsConditions, flowCardsActions);
                flowCards = flowCards.filter(card => _.every(['text', 'number', 'boolean', 'autocomplete'], type=>  _.sumBy( card.args, arg=> arg.type==type)==cardToUser.count[type]));
                // flowCards = [flowCards[0]];
                // this.log('flowCards', flowCards);
                // flowCards = flowCards.filter(card => _.every(['text', 'number', 'boolean', 'autocomplete'], type=> 
                // { 
                //   var sum = _.sumBy( card.args, arg=> arg.type==type)==cardToUser.count[type]
                //   this.log('type', type, 'sum ', sum);
                //   return sum
                // }));



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

                r = _.orderBy(r, [card => card.order, card => card.name, card => card.name ]);
                return r;
              } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
            });
          }
        }
        
      }).bind(this));
  }

}

module.exports = CardOverloaderDevice;