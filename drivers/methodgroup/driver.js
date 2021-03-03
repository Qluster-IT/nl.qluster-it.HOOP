'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    
const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');

class MethodGroupDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('MethodGroupDriver has been initialized');      

        this.flows = {};
    
        this.initializeTriggers();
        this.initializeConditionsAndActions();  
    }


    async onPairListDevices(data)
    {
        return {
            "name": 'Method Group',
            data:
            {
                "id": uuidv4()
            },
            settings:
            {
                "overloading": "false"
            }
        };
    }

    
  initializeTriggers() {
    var triggerCards = {};
    this.flows.triggers = triggerCards;
    for (let triggerCardIndex = 0; triggerCardIndex < homeyApi.app.manifest.flow.triggers.length; triggerCardIndex++) {
      const triggerCard = homeyApi.app.manifest.flow.triggers[triggerCardIndex];
      if (!triggerCard.id.startsWith('methodgroup_')) continue;
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
        // if (triggerCard.args.find(x => x.name == 'id' && x.type == 'autocomplete')) {
        //   card.getArgument('id').registerAutocompleteListener(async (query, args) => {
        //     try {
        //       var array = _.map(triggerCards[triggerCard.id].flows, flow => { return flow.trigger.args && flow.trigger.args.id ? Number.parseInt(flow.trigger.args.id.id) : null });
        //       var max = _.max(array);
        //       if (!max) max = 1; else max++;
        //       var res = [{ id: max.toString(), name: max.toString() }];
        //       if (query && query != max.toString()) res.push({ id: query, name: query });
        //       return res;
        //     } catch (error) { this.error(triggerCard.id + '.id.registerAutocompleteListener.error :', error); throw error; }
        //   });
        // }
        
        card.on('update', this.refreshFlowTriggers.bind(this, triggerCards[triggerCard.id]))
        this.refreshFlowTriggers(triggerCards[triggerCard.id]);
      }
    }
  }


  // //Build in notification if double ID!
  async refreshFlowTriggers(trigger) {
    var flows = await homeyApi.getOwnTriggerFlows({ device: this, refresh: true, triggerCardId: trigger.id });
    trigger.flows = flows || [];
  }


  initializeConditionsAndActions() {
    ['methodgroup_condition__','methodgroup_action__'].forEach((cardName => {
      var cardType = cardName.startsWith('methodgroup_condition') ? 'conditions' : 'actions';
        var actionsCards = {};
        this.flows[cardType] = actionsCards
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('methodgroup_')) continue;
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
                    defer.reject(err);//'Error triggering MehodGroup Card (1)');
                  });
                else defer.resolve(true);
              }).call(this).then(res=> {
              }).catch(err=> {
                this.log('Error triggering MehodGroup Card 2');this.error(err); defer.reject('Error message');
              })
              //ownFlowItem.card.trigger(args.device, triggerArgs, { id: { id: flow.trigger.args.id.id } });
            } catch (error) { this.log('Error triggering MehodGroup Card (3)');this.error(error); defer.reject('Error message'); }
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

module.exports = MethodGroupDriver;