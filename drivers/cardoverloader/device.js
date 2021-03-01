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
      var cardTargetType = cardName.startsWith('_targetcondition') ? 'conditions' : 'actions';
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
              boolean:0
            }
          };
          var types = actionCard.id.split('__')[1].split('_');
          _.forEach(types, t=> {
            if(t.startsWith('text')) cardToUser.count['text']= Number.parseInt( t.replace('text',''));
            if(t.startsWith('number')) cardToUser.count['text']= Number.parseInt( t.replace('number',''));
            if(t.startsWith('boolean')) cardToUser.count['text']= Number.parseInt( t.replace('boolean',''));
            if(t.startsWith('autocomplete')) cardToUser.count['autocomplete']= Number.parseInt( t.replace('autocomplete',''));
          });
          this.log('cardToUser.count', cardToUser.count);

          card.registerRunListener(async (args, state) => {
            try {
              // var flow = await homeyApi.getFlow({ id: args.flow.id });
              // if (!flow.enabled) return true;
              // var triggerArgs = this.getArgs({ flow, args, actionCard });
              // var promise = Flower.triggerFlow({ flow, tokensAsArgs: triggerArgs });
              // if(cardType=='conditions') return await promise;
              // else return true;
              //ownFlowItem.card.trigger(args.device, triggerArgs, { id: { id: flow.trigger.args.id.id } });
            } catch (error) { this.error(error) }
          });
          if (actionCard.args) {
            if (actionCard.args.find(x => x.name == 'app' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(async (query, args) => {
              try {
                var flowCards = await homeyApi.getFlowCards({type:cardTargetType});
                flowCards = flowCards.filter(card => _.each(['text', 'number', 'boolean', 'autocomplete'], type=> _.sumBy( card.args, arg=> arg.type==type)==cardToUser.count[type]));
                var r = flowCards.map(f => {
                  if(f.uri.startsWith('homey:device:')) {
                    return { id: f.uri, name: f.uriObj.name + ' - ' + f.id, description: f.title, order:1, isDevice: true };
                  } else return { id: f.uri, name: f.uri + ' - ' + f.id, description: f.title, order:0 }
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