'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    
const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');

class ArrayAdapterDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('ArrayAdapter has been initialized');      

        this.flows = {};
        Flower.init(null, this);
    
        this.initializeTriggers();
        this.initializeConditionsAndActions();  
    }


    async onPairListDevices(data)
    {
        return {
            "name": 'Array Adapter',
            data:
            {
                "id": uuidv4()
            }            
        };
    }

    
  initializeTriggers() {
    var triggerCards = {};
    this.flows.triggers = triggerCards;
    for (let triggerCardIndex = 0; triggerCardIndex < homeyApi.app.manifest.flow.triggers.length; triggerCardIndex++) {
      const triggerCard = homeyApi.app.manifest.flow.triggers[triggerCardIndex];
      if (!triggerCard.id.startsWith('arrayadapter_')) continue;
      var card = this.homey.flow.getDeviceTriggerCard(triggerCard.id);
      triggerCards[triggerCard.id] = {
        id: triggerCard.id,
        card: card,
        manifest: triggerCard,
        flows: []
      }
      //check if flow is enabled
      card.registerRunListener(async (args, state) => {
        this.log(triggerCard.id + '.registerRunListener: ');
        // console.log(args);
        // console.log(state);
        // console.log('returns ' + args.id && args.id.id && state.id && state.id.id && args.id.id == state.id.id);
        return args.id && args.id.id && state.id && state.id.id && args.id.id == state.id.id;
      });
      if (triggerCard.args) {
        if (triggerCard.args.find(x => x.name == 'uri' && x.type == 'autocomplete')) card.getArgument('uri').registerAutocompleteListener(async (query, args) => {
          try {
            var flowCards = await homeyApi.getFlowCards({type:'actions'});
            //var flowCardsConditions = await homeyApi.getFlowCards({type:'conditions'});
            //var flowCardsActions = await homeyApi.getFlowCards({type:'actions'});
            //var flowCards = _.union(flowCardsConditions, flowCardsActions);            
            // if (query) {
            //   var a = flowCards.filter(f => f.uri.toLowerCase().indexOf(query.toLowerCase()) > -1);
            //   this.log('a', a)
            // }
            var r = flowCards.map(f => {
              /// WHATS OUT, ALL NEED TO BE SAME!
              return { id: f.uri, name: f.uriObj.name, description: f.uriObj.type, order:1, isDevice: true, refUri:f.uri, refId : f.id, refType : 'Action'};//f.__athom_api_type };              
            });
            if (query) r = r.filter(f => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1);
            r = _.uniqBy(r, card => card.id);

            r = _.orderBy(r, [card => card.description, card => card.name ]);
            //this.log('r length ', r)
            return r;
          } catch (error) { this.error(triggerCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
        });
      }
        
        // card.on('update', this.refreshFlowTriggers.bind(this, triggerCards[triggerCard.id]))
        // this.refreshFlowTriggers(triggerCards[triggerCard.id]);
      
    }
  }


  // //Build in notification if double ID!
  // async refreshFlowTriggers(trigger) {
  //   var flows = await homeyApi.getOwnTriggerFlows({ device: this, refresh: true, triggerCardId: trigger.id });
  //   trigger.flows = flows || [];
  // }


  initializeConditionsAndActions() {
    ['arrayadapter_condition__','arrayadapter_action__'].forEach((cardName => {
      var cardType = cardName.startsWith('arrayadapter_condition') ? 'conditions' : 'actions';
        var actionsCards = {};
        this.flows[cardType] = actionsCards
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('arrayadapter_')) continue;
          var card = this.homey.flow[cardType =='actions' ? 'getActionCard': 'getConditionCard'](actionCard.id);
          actionsCards[actionCard.id] = {
            id: actionCard.id,
            card: card,
            manifest: actionCard
          };
          card.registerRunListener((args, state) => {
            var defer = new Defer();
            try {
              (async()=>{
                var flow = await homeyApi.getFlow({ id: args.flow.id });
                if (!flow.enabled) return true;
                
                var triggerManifest = await homeyApi.getFlowCard({ uri:  flow.trigger.uri ,id: flow.trigger.id, type:'triggers' }); 
                var triggerArgs = Flower.getArgsForTokens({ args, actionCard, triggerCard:triggerManifest });
  
                var promise = Flower.triggerFlow({ flow, tokensAsArgs: triggerArgs, actioncardsmode:args.actioncardsmode });
                if(cardType=='conditions') 
                  promise.then(r=> {
                    defer.resolve(r===undefined || r===null ? true : r);
                  }).catch(err=> {
                    defer.reject(err);//'Error triggering ArrayAdapter Card (1)');
                  });
                else defer.resolve(true);
              }).call(this).then(res=> {
              }).catch(err=> {
                this.log('Error triggering ArrayAdapter Card 2');this.error(err); defer.reject(err.name || err);
              })
              //ownFlowItem.card.trigger(args.device, triggerArgs, { id: { id: flow.trigger.args.id.id } });
            } catch (err) { this.log('Error triggering ArrayAdapter Card (3)');this.error(error); defer.reject(err.name || err); }
            return defer.promise;
          });
          if (actionCard.args) {
            if (actionCard.args.find(x => x.name == 'flow' && x.type == 'autocomplete')) card.getArgument('flow').registerAutocompleteListener(async (query, args) => {
              try {
                var flows = await homeyApi.getOwnTriggerFlows({ args: actionCard.args, device: args.device, cardId: actionCard.id.split('__')[1] });
                if (query) flows = flows.filter(f => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1);
                return flows.map(f => {
                  return { id: f.id, name: f.name }
                });
              } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
            });
          }
        }
      }).bind(this));
  }
}

module.exports = ArrayAdapterDriver;