'use strict';

const Homey = require('homey');
const homeyApi = require('./lib/homeyApi');
const _ = require('lodash');


class MyApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');
    this.flows = {

    };
    homeyApi.init(this.homey);

    this.initializeTriggers();
    this.initializeActions();


  }

  initializeTriggers() {
    var triggerCards = {};
    this.flows.triggers = triggerCards;
    for (let triggerCardIndex = 0; triggerCardIndex < this.manifest.flow.triggers.length; triggerCardIndex++) {
      const triggerCard = this.manifest.flow.triggers[triggerCardIndex];
      var card = this.homey.flow.getTriggerCard(triggerCard.id);
      triggerCards[triggerCard.id] = {
        id: triggerCard.id,
        card: card,
        flows:[]
      }
      //check if flow is enabled
      card.registerRunListener(async (query, args) => {
        console.log(triggerCard.id + '.registerRunListener: ');
        console.log(query);
        console.log(args);
        return args.id && args.id.id && state.id && state.id.id && args.id.id === state.id.id;
      });
      if (triggerCard.args) {
        if (triggerCard.args.find(x => x.name == 'id' && x.type == 'autocomplete')) {
          card.getArgument('id').registerAutocompleteListener(async (query, args) => {
            try {
              var array = _.map(triggerCards[triggerCard.id].flows, flow=> { return flow.trigger.args && flow.trigger.args.id ? Number.parseInt(flow.trigger.args.id.id) : null });
              var max = _.max(array);
              if(!max) max=1; else max++;
              var res = [{id:max.toString(), name:max.toString()}];
              if(query && query!=max.toString()) res.push( {id:query, name:query});
              return res;              
            } catch (error) {
              this.error(error);
            }
          });
          card.on('update', this.refreshFlowTriggers.bind(this, triggerCards[triggerCard.id]))
          this.refreshFlowTriggers(triggerCards[triggerCard.id]);
        }
      }
    }
  }
  
  
  //Build in notification if double ID!
  async refreshFlowTriggers(trigger) {
    var flows = await homeyApi.getOwnTriggerFlows({refresh:true, triggerCardId:trigger.id});
    trigger.flows = flows || [];
    console.log('refreshFlowTriggers');
    console.log(flows);
  }


  initializeActions() {
    var actionsCards = {};
    this.flows.actions = actionsCards
    for (let actionCardIndex = 0; actionCardIndex < this.manifest.flow.actions.length; actionCardIndex++) {
      const actionCard = this.manifest.flow.actions[actionCardIndex];
      console.log(actionCard);
      var card = this.homey.flow.getActionCard(actionCard.id);
      actionsCards[actionCard.id] = {
        id: actionCard.id,
        card: card
      };
      card.registerRunListener(async (args, state) => {
        console.log(actionCard.id + '.registerRunListener: ');
        console.log(args);
        console.log(state);
        var flow = await homeyApi.getFlow({ id: args.flow.id });
        if (!flow.enabled) return true;
        this.flows.triggers.card.trigger({}, { id: { id: flow.id } });

        console.log('--------------------------flow-----------------------');
        console.log(flow);
        (await homeyApi.getHomeyAPI()).flow.testFlow({ flow: flow, tokens: {} });
      });
      if (actionCard.args) {
        if (actionCard.args.find(x => x.name == 'flow' && x.type == 'autocomplete')) card.getArgument('flow').registerAutocompleteListener(async (query, args) => {
          //console.log(actionCard.id + '.flow.registerAutocompleteListener: ');
          //console.log(query);
          //console.log(args);
          try {

            var flows = await homeyApi.getOwnTriggerFlows({ args: actionCard.args });
            // var flow = flows ? _.find(flows, x=>x.trigger.uri=='homey:app:nl.qluster-it.FlowEnhancer') : null;
            //console.log('flows');
            //console.log(flows);
            if (query) flows = flows.filter(f => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1);
            return flows.map(f => {
              return { id: f.id, name: f.name }
            });
          } catch (error) {
            console.log(actionCard.id + '.flow.registerAutocompleteListener.error :' + error);

          }
          // 	return new Promise((resolve) => {
          // 			this.getSpeakersList((error, speakers) => {
          // 				if (error) {
          // 					return this.error(error);
          // 				}
          // 				console.log("Speaker fetch...");
          // 				console.log(speakers);
          // 				let result = [];
          // 				if (speakers.status == "error"){
          // 					result.push({name: "Something went wrong, please try again!", id: "NA"});
          // 				} else {
          // 					if(speakers) speakers.forEach(entry => {
          // 						const name = entry.coordinator.roomName;
          // 						result.push({name: name, id: name});
          // 					});
          // 				}
          // 				console.log("Speaker fetch...done");
          // 				resolve(result);
          // 			})
          // 	});
        });
      }
    }

    // actionsCards['action_sonos_lock_volume'].registerRunListener(( args, state ) => {
    // 	return new Promise((resolve) => {
    // 		this.lockVolume((error, result) => {
    // 			if (error) return this.error(error);					
    // 			resolve(true);
    // 		})
    // 	});
    // });


  }

}

module.exports = MyApp;